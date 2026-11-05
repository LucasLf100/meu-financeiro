import { db, type AjusteConta, type ContaFixa, type FormaConta, type PagamentoConta } from '../db'
import { diaDoMes, hoje, mesesEntre, somarMeses } from '../datas'

export const FORMAS_CONTA: Array<{ valor: FormaConta; rotulo: string; icone: string }> = [
  { valor: 'cartao', rotulo: 'Cartão', icone: '💳' },
  { valor: 'boleto', rotulo: 'Boleto', icone: '🧾' },
  { valor: 'pix', rotulo: 'Pix', icone: '⚡' },
  { valor: 'debito', rotulo: 'Débito automático', icone: '🏦' },
  { valor: 'dinheiro', rotulo: 'Dinheiro', icone: '💵' },
]

/** Por onde a conta é paga. Sem forma escolhida, "cartão" no nome indica cartão. */
export function formaDaConta(conta: ContaFixa): FormaConta | undefined {
  if (conta.formaPagamento) return conta.formaPagamento
  return /cart[aã]o/i.test(conta.nome) ? 'cartao' : undefined
}

export function infoForma(forma?: FormaConta) {
  return FORMAS_CONTA.find((f) => f.valor === forma)
}

export type StatusConta = 'paga' | 'pendente' | 'atrasada'

export interface OcorrenciaConta {
  conta: ContaFixa & { id: number }
  competencia: string
  valor: number
  vencimento: string
  status: StatusConta
  pagamento?: PagamentoConta
  ajuste?: AjusteConta
  parcela?: { numero: number; total: number }
  valorEstimado: boolean
}

/** A cada quantos meses a conta se repete: 1 (mensal) ou 12 (anual). */
export function intervaloMeses(conta: ContaFixa): number {
  return conta.frequencia === 'anual' ? 12 : 1
}

/** Número da parcela da conta naquele mês (contas com fim definido, ex.: financiamento). */
export function numeroParcela(conta: ContaFixa, mes: string): number {
  return (conta.parcelaInicial ?? 1) + Math.floor(mesesEntre(conta.inicio, mes) / intervaloMeses(conta))
}

/** A conta ainda está em vigor neste mês (começou e não terminou), mesmo que não vença nele. */
export function contaEmVigor(conta: ContaFixa, mes: string): boolean {
  if (!conta.ativa) return false
  if (mes < conta.inicio) return false
  if (conta.fim && mes > conta.fim) return false
  if (conta.totalParcelas && numeroParcela(conta, mes) > conta.totalParcelas) return false
  return true
}

/** A conta vence neste mês (mensal: todo mês; anual: só no mês do ano em que começou). */
export function contaValeNoMes(conta: ContaFixa, mes: string): boolean {
  if (!contaEmVigor(conta, mes)) return false
  return mesesEntre(conta.inicio, mes) % intervaloMeses(conta) === 0
}

/** Valor médio por mês (anual dividido por 12). */
export function valorPorMes(conta: ContaFixa): number {
  return conta.frequencia === 'anual' ? Math.round(conta.valor / 12) : conta.valor
}

/** Todas as contas fixas de um mês, com valor, vencimento e status. */
export async function ocorrenciasDoMes(mes: string): Promise<OcorrenciaConta[]> {
  const [contas, ajustes, pagamentos, todosPagamentos] = await Promise.all([
    db.contas.toArray(),
    db.ajustesConta.where({ competencia: mes }).toArray(),
    db.pagamentosConta.where({ competencia: mes }).toArray(),
    db.pagamentosConta.toArray(),
  ])
  const dia = hoje()
  const resultado: OcorrenciaConta[] = []
  for (const conta of contas) {
    if (!contaValeNoMes(conta, mes)) continue
    const ajuste = ajustes.find((a) => a.contaId === conta.id)
    if (ajuste?.pulada) continue
    const pagamento = pagamentos.find((p) => p.contaId === conta.id)

    let valor = ajuste?.valor ?? conta.valor
    let valorEstimado = false
    if (conta.valorVariavel && ajuste?.valor === undefined && !pagamento) {
      // Valor variável: média dos últimos 3 pagamentos anteriores a este mês.
      const anteriores = todosPagamentos
        .filter((p) => p.contaId === conta.id && p.competencia < mes)
        .sort((a, b) => b.competencia.localeCompare(a.competencia))
        .slice(0, 3)
      if (anteriores.length) valor = Math.round(anteriores.reduce((s, p) => s + p.valor, 0) / anteriores.length)
      valorEstimado = true
    }
    if (pagamento) valor = pagamento.valor

    const vencimento = diaDoMes(mes, ajuste?.diaVencimento ?? conta.diaVencimento)
    const status: StatusConta = pagamento ? 'paga' : vencimento < dia ? 'atrasada' : 'pendente'
    resultado.push({
      conta: conta as ContaFixa & { id: number },
      competencia: mes,
      valor,
      vencimento,
      status,
      pagamento,
      ajuste,
      parcela: conta.totalParcelas ? { numero: numeroParcela(conta, mes), total: conta.totalParcelas } : undefined,
      valorEstimado,
    })
  }
  return resultado.sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.conta.nome.localeCompare(b.conta.nome))
}

/** Contas não pagas de meses anteriores (até 12 meses para trás). */
export async function atrasadasAnteriores(mes: string): Promise<OcorrenciaConta[]> {
  const resultado: OcorrenciaConta[] = []
  for (let i = 12; i >= 1; i--) {
    const anterior = somarMeses(mes, -i)
    resultado.push(...(await ocorrenciasDoMes(anterior)).filter((o) => o.status === 'atrasada'))
  }
  return resultado
}

export type ModoEdicao = 'so-este' | 'este-e-proximos' | 'futuros'

export interface MudancasConta {
  nome: string
  valor: number
  diaVencimento: number
  categoriaId?: number
  valorVariavel: boolean
  totalParcelas?: number
  formaPagamento?: FormaConta
  frequencia?: 'mensal' | 'anual'
}

/**
 * Aplica uma edição a partir de um mês.
 * - 'so-este': vale só para o mês (valor e dia de vencimento).
 * - 'este-e-proximos': a partir deste mês.
 * - 'futuros': a partir do mês seguinte (este mês fica como está).
 */
export async function editarConta(conta: ContaFixa & { id: number }, mes: string, modo: ModoEdicao, mudancas: MudancasConta) {
  if (modo === 'so-este') {
    const existente = await db.ajustesConta.where({ contaId: conta.id, competencia: mes }).first()
    const ajuste: AjusteConta = { ...existente, contaId: conta.id, competencia: mes, valor: mudancas.valor, diaVencimento: mudancas.diaVencimento }
    await db.ajustesConta.put(ajuste)
    // Nome e categoria não mudam "só neste mês": valem para a conta toda.
    await db.contas.update(conta.id, { nome: mudancas.nome, categoriaId: mudancas.categoriaId, formaPagamento: mudancas.formaPagamento })
    return
  }

  const aPartirDe = modo === 'futuros' ? somarMeses(mes, 1) : mes
  await db.transaction('rw', db.contas, db.pagamentosConta, db.ajustesConta, async () => {
    if (aPartirDe <= conta.inicio) {
      await db.contas.update(conta.id, { ...mudancas })
      await db.ajustesConta.where('contaId').equals(conta.id).filter((a) => a.competencia >= aPartirDe).delete()
      return
    }
    // Divide a conta em duas: a antiga termina no mês anterior e a nova começa em `aPartirDe`.
    const nova: ContaFixa = {
      ...conta,
      ...mudancas,
      id: undefined,
      inicio: aPartirDe,
      fim: conta.fim,
      parcelaInicial: mudancas.totalParcelas ? numeroParcela({ ...conta, ...mudancas }, aPartirDe) : undefined,
    }
    const novoId = await db.contas.add(nova)
    await db.contas.update(conta.id, { fim: somarMeses(aPartirDe, -1) })
    await db.pagamentosConta.where('contaId').equals(conta.id).filter((p) => p.competencia >= aPartirDe).modify({ contaId: novoId })
    await db.ajustesConta.where('contaId').equals(conta.id).filter((a) => a.competencia >= aPartirDe).delete()
  })
}

/** Encerra a conta: some a partir do mês informado, mas o histórico fica. */
export async function encerrarConta(conta: ContaFixa & { id: number }, aPartirDe: string) {
  if (aPartirDe <= conta.inicio) {
    await apagarConta(conta.id)
    return
  }
  await db.contas.update(conta.id, { fim: somarMeses(aPartirDe, -1) })
}

export async function apagarConta(id: number) {
  await db.transaction('rw', db.contas, db.pagamentosConta, db.ajustesConta, async () => {
    await db.pagamentosConta.where({ contaId: id }).delete()
    await db.ajustesConta.where({ contaId: id }).delete()
    await db.contas.delete(id)
  })
}
