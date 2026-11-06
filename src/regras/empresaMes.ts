// Empresa no mês: entradas (clientes e avulsas), saídas (cobranças e gastos), resultado,
// e a ligação com o Pessoal quando o dinheiro sai do meu bolso ou do meu cartão.
import { db, type ClienteEmpresa, type Cobranca, type EntradaEmpresa, type GastoEmpresa, type OrigemPagamento, type PagamentoCobranca, type Plataforma } from '../db'
import { diaDoMes, diasAte, hoje, mesDe, somarMeses } from '../datas'
import { gerarParcelas } from './cartoes'
import { emReais, lerCotacao, plataformaConta, proximaData } from './empresa'

export const ORIGENS: Array<{ valor: OrigemPagamento; rotulo: string; icone: string; dica: string }> = [
  { valor: 'caixa', rotulo: 'Caixa da empresa', icone: '🏢', dica: 'Saiu da conta da empresa. Não mexe no Pessoal.' },
  { valor: 'cartao-empresa', rotulo: 'Cartão da empresa', icone: '💼', dica: 'Cartão corporativo. Não mexe no Pessoal.' },
  { valor: 'bolso', rotulo: 'Do meu bolso', icone: '👤', dica: 'Pix, débito ou dinheiro seu. Entra no Pessoal e a empresa te reembolsa.' },
  { valor: 'cartao-pessoal', rotulo: 'Meu cartão', icone: '💳', dica: 'Entra na fatura do seu cartão pessoal e a empresa te reembolsa.' },
]

export const pagoPorMim = (origem?: OrigemPagamento) => origem === 'bolso' || origem === 'cartao-pessoal'

/** Origem de registros antigos (sem o campo): "pago por mim" vira "do meu bolso". */
export function origemDe(r: { origem?: OrigemPagamento; pagoPorMim: boolean }): OrigemPagamento {
  return r.origem ?? (r.pagoPorMim ? 'bolso' : 'caixa')
}

/** Cria a compra correspondente na fatura do cartão pessoal (à vista). Devolve o id do gasto pessoal. */
export async function lancarNoCartaoPessoal(dados: { descricao: string; valor: number; data: string; cartaoId: number }): Promise<number> {
  const categorias = await db.categorias.where({ modo: 'pessoal' }).toArray()
  const categoriaId = (categorias.find((c) => c.nome === 'Outros') ?? categorias[0])?.id ?? 0
  const gasto = {
    valor: dados.valor,
    descricao: `${dados.descricao} (empresa)`,
    forma: 'credito' as const,
    categoriaId,
    data: dados.data,
    cartaoId: dados.cartaoId,
    parcelas: 1,
    criadoEm: new Date().toISOString(),
  }
  const id = (await db.gastos.add(gasto)) as number
  await gerarParcelas({ ...gasto, id })
  return id
}

export async function removerGastoPessoal(id?: number) {
  if (!id) return
  await db.parcelas.where({ gastoId: id }).delete()
  await db.gastos.delete(id)
}

/** Tabelas usadas ao salvar um gasto/pagamento da empresa que pode criar compra no cartão pessoal. */
export const tabelasLigacao = () => [db.gastos, db.parcelas, db.cartoes, db.categorias, db.pagamentosFatura, db.pagamentosConta, db.contas]

/** Salva (cria ou edita) um gasto avulso da empresa, mantendo a compra no cartão pessoal em dia. */
export async function salvarGastoEmpresa(registro: GastoEmpresa, origem: OrigemPagamento, cartaoId?: number) {
  await db.transaction('rw', [db.gastosEmpresa, ...tabelasLigacao()], async () => {
    // Edição: desfaz a compra no cartão pessoal antiga e cria de novo se ainda for no cartão.
    await removerGastoPessoal(registro.gastoPessoalId)
    let gastoPessoalId: number | undefined
    if (origem === 'cartao-pessoal' && cartaoId) {
      gastoPessoalId = await lancarNoCartaoPessoal({ descricao: registro.descricao, valor: registro.valor, data: registro.data, cartaoId })
    }
    await db.gastosEmpresa.put({
      ...registro,
      origem,
      cartaoId: origem === 'cartao-pessoal' ? cartaoId : undefined,
      gastoPessoalId,
      pagoPorMim: pagoPorMim(origem),
    })
  })
}

export async function apagarGastoEmpresa(g: GastoEmpresa) {
  await db.transaction('rw', [db.gastosEmpresa, db.gastos, db.parcelas], async () => {
    await removerGastoPessoal(g.gastoPessoalId)
    await db.gastosEmpresa.delete(g.id!)
  })
}

export async function apagarPagamentoCobranca(p: PagamentoCobranca) {
  await db.transaction('rw', [db.pagamentosCobranca, db.gastos, db.parcelas], async () => {
    await removerGastoPessoal(p.gastoPessoalId)
    await db.pagamentosCobranca.delete(p.id!)
  })
}

/* ---------------- Clientes (entradas recorrentes) ---------------- */

export interface OcorrenciaCliente {
  cliente: ClienteEmpresa & { id: number }
  data: string
  valor: number
  entrada?: EntradaEmpresa
  status: 'recebido' | 'a-receber' | 'atrasado'
}

const clienteNoMes = (c: ClienteEmpresa, mes: string) => !!c.ativa && mes >= c.inicio && (!c.fim || mes <= c.fim)

export async function entradasEmpresaDoMes(mes: string) {
  const [clientes, entradas] = await Promise.all([db.clientes.toArray(), db.entradasEmpresa.where({ competencia: mes }).toArray()])
  const dia = hoje()
  const recorrentes: OcorrenciaCliente[] = clientes
    .filter((c) => clienteNoMes(c, mes))
    .map((c) => {
      const entrada = entradas.find((e) => e.clienteId === c.id)
      const data = diaDoMes(mes, c.dia)
      return {
        cliente: c as ClienteEmpresa & { id: number },
        data,
        valor: entrada?.valor ?? c.valor,
        entrada,
        status: entrada ? ('recebido' as const) : data < dia ? ('atrasado' as const) : ('a-receber' as const),
      }
    })
    .sort((a, b) => a.data.localeCompare(b.data))
  const avulsas = entradas.filter((e) => !e.clienteId).sort((a, b) => b.data.localeCompare(a.data))
  const somaAvulsas = avulsas.reduce((s, e) => s + e.valor, 0)
  return {
    recorrentes,
    avulsas,
    previsto: recorrentes.reduce((s, o) => s + o.valor, 0) + somaAvulsas,
    recebido: recorrentes.filter((o) => o.entrada).reduce((s, o) => s + o.valor, 0) + somaAvulsas,
  }
}

export async function encerrarCliente(c: ClienteEmpresa & { id: number }, aPartirDe: string) {
  if (aPartirDe <= c.inicio) {
    await db.transaction('rw', db.clientes, db.entradasEmpresa, async () => {
      await db.entradasEmpresa.where({ clienteId: c.id }).delete()
      await db.clientes.delete(c.id)
    })
    return
  }
  await db.clientes.update(c.id, { fim: somarMeses(aPartirDe, -1) })
}

/* ---------------- Saídas do mês ---------------- */

export interface SaidaAPagar {
  cobranca: Cobranca & { id: number }
  plataforma: Plataforma
  data: string
  valorReais: number
  atrasada: boolean
}

export interface SaidaPaga {
  tipo: 'pagamento' | 'gasto'
  id: number
  descricao: string
  valor: number
  data: string
  origem: OrigemPagamento
  reembolsadoEm?: string
  pagamento?: PagamentoCobranca
  gasto?: GastoEmpresa
}

/** O que a empresa tem a pagar (renovações no mês ainda não pagas) e o que já saiu no mês. */
export async function saidasEmpresaDoMes(mes: string) {
  const [cobrancas, plataformas, pagamentos, gastos, cotacao] = await Promise.all([
    db.cobrancas.toArray(),
    db.plataformas.toArray(),
    db.pagamentosCobranca.toArray(),
    db.gastosEmpresa.toArray(),
    lerCotacao(),
  ])
  const aPagar: SaidaAPagar[] = []
  for (const c of cobrancas) {
    if (!c.proximaRenovacao || (c.tipo !== 'mensal' && c.tipo !== 'anual')) continue
    const plataforma = plataformas.find((p) => p.id === c.plataformaId)
    if (!plataformaConta(plataforma)) continue
    // Entra se renova neste mês; no mês atual, entram também as que já venceram e não foram pagas.
    const mesRenovacao = mesDe(c.proximaRenovacao)
    const atual = mesDe(hoje())
    const venceNoMes = mesRenovacao === mes
    const atrasadaDeAntes = mes === atual && mesRenovacao < atual
    if (!venceNoMes && !atrasadaDeAntes) continue
    aPagar.push({
      cobranca: c as Cobranca & { id: number },
      plataforma: plataforma!,
      data: c.proximaRenovacao,
      valorReais: emReais(c.valor, c.moeda, cotacao),
      atrasada: diasAte(c.proximaRenovacao) < 0,
    })
  }
  const nomePlataforma = (cobrancaId: number) => {
    const c = cobrancas.find((x) => x.id === cobrancaId)
    return plataformas.find((p) => p.id === c?.plataformaId)?.nome ?? 'Cobrança'
  }
  const pagas: SaidaPaga[] = [
    ...pagamentos
      .filter((p) => mesDe(p.pagoEm) === mes)
      .map((p) => ({ tipo: 'pagamento' as const, id: p.id!, descricao: nomePlataforma(p.cobrancaId), valor: p.valor, data: p.pagoEm, origem: origemDe(p), reembolsadoEm: p.reembolsadoEm, pagamento: p })),
    ...gastos
      .filter((g) => mesDe(g.data) === mes)
      .map((g) => ({ tipo: 'gasto' as const, id: g.id!, descricao: g.descricao, valor: g.valor, data: g.data, origem: origemDe(g), reembolsadoEm: g.reembolsadoEm, gasto: g })),
  ].sort((a, b) => b.data.localeCompare(a.data))
  return {
    aPagar: aPagar.sort((a, b) => a.data.localeCompare(b.data)),
    pagas,
    totalAPagar: aPagar.reduce((s, x) => s + x.valorReais, 0),
    totalPago: pagas.reduce((s, x) => s + x.valor, 0),
  }
}

/** Resultado do mês: o que entrou − o que saiu (pago + a pagar). */
export async function resultadoEmpresa(mes: string) {
  const [entradas, saidas] = await Promise.all([entradasEmpresaDoMes(mes), saidasEmpresaDoMes(mes)])
  const saiu = saidas.totalPago + saidas.totalAPagar
  return { entradas, saidas, entrou: entradas.previsto, saiu, resultado: entradas.previsto - saiu }
}

/** Registra o pagamento de uma cobrança com a origem do dinheiro; se foi no meu cartão, entra na fatura dele. */
export async function registrarPagamentoCobranca(
  c: Cobranca & { id: number },
  nomePlataforma: string,
  dados: { valor: number; valorOriginal?: number; pagoEm: string; comprovante?: string; origem: OrigemPagamento; cartaoId?: number },
) {
  await db.transaction('rw', [db.pagamentosCobranca, db.cobrancas, ...tabelasLigacao()], async () => {
    let gastoPessoalId: number | undefined
    if (dados.origem === 'cartao-pessoal' && dados.cartaoId) {
      gastoPessoalId = await lancarNoCartaoPessoal({ descricao: nomePlataforma, valor: dados.valor, data: dados.pagoEm, cartaoId: dados.cartaoId })
    }
    await db.pagamentosCobranca.add({
      cobrancaId: c.id,
      valor: dados.valor,
      valorOriginal: dados.valorOriginal,
      pagoEm: dados.pagoEm,
      comprovante: dados.comprovante,
      origem: dados.origem,
      cartaoId: dados.origem === 'cartao-pessoal' ? dados.cartaoId : undefined,
      gastoPessoalId,
      pagoPorMim: pagoPorMim(dados.origem),
    })
    if (c.tipo === 'mensal' || c.tipo === 'anual') {
      await db.cobrancas.update(c.id, { proximaRenovacao: proximaData(c, dados.pagoEm) })
    }
  })
}
