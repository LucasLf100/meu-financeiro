import { db, lerConfig, type Cobranca, type PagamentoCobranca, type Plataforma } from '../db'
import { diasAte, hoje, mesAtual, mesDe, somarAnos, somarMesesDia } from '../datas'

export const COTACAO_PADRAO = 550 // R$ 5,50 em centavos

export async function lerCotacao(): Promise<number> {
  return lerConfig<number>('cotacaoDolar', COTACAO_PADRAO)
}

/** Converte para reais (centavos), usando a cotação (centavos de real por 1 dólar). */
export function emReais(valor: number, moeda: 'BRL' | 'USD', cotacao: number): number {
  return moeda === 'USD' ? Math.round((valor * cotacao) / 100) : valor
}

/** Plataformas que geram custo (ativas ou em teste). */
export function plataformaConta(p: Plataforma | undefined): boolean {
  return !!p && (p.status === 'ativa' || p.status === 'teste')
}

/** Custo mensal previsto de uma cobrança, em reais. */
export function custoMensal(c: Cobranca, pagamentos: PagamentoCobranca[], cotacao: number): number {
  switch (c.tipo) {
    case 'mensal':
      return emReais(c.valor, c.moeda, cotacao)
    case 'anual':
      return Math.round(emReais(c.valor, c.moeda, cotacao) / 12)
    case 'uso': {
      const ultimos = pagamentos
        .filter((p) => p.cobrancaId === c.id)
        .sort((a, b) => b.pagoEm.localeCompare(a.pagoEm))
        .slice(0, 3)
      if (ultimos.length) return Math.round(ultimos.reduce((s, p) => s + p.valor, 0) / ultimos.length)
      return c.limiteEsperado ? emReais(c.limiteEsperado, c.moeda, cotacao) : 0
    }
    default:
      return 0
  }
}

/** Próxima data depois de pagar uma cobrança recorrente. */
export function proximaData(c: Cobranca, depoisDe: string): string | undefined {
  if (c.tipo !== 'mensal' && c.tipo !== 'anual') return c.proximaRenovacao
  let data = c.proximaRenovacao ?? depoisDe
  // Avança pelo menos uma vez e até ficar depois da data do pagamento.
  do {
    data = c.tipo === 'mensal' ? somarMesesDia(data, 1) : somarAnos(data, 1)
  } while (data <= depoisDe)
  return data
}

export interface DadosPagamento {
  valor: number // reais
  valorOriginal?: number // dólares
  pagoEm: string
  pagoPorMim: boolean
  comprovante?: string
}

export async function registrarPagamento(c: Cobranca & { id: number }, dados: DadosPagamento) {
  await db.transaction('rw', db.pagamentosCobranca, db.cobrancas, async () => {
    await db.pagamentosCobranca.add({ cobrancaId: c.id, ...dados })
    if (c.tipo === 'mensal' || c.tipo === 'anual') {
      await db.cobrancas.update(c.id, { proximaRenovacao: proximaData(c, dados.pagoEm) })
    }
  })
}

/** Dias de antecedência para avisar: renovação manual avisa mais cedo. */
export function antecedenciaAviso(c: Cobranca): number {
  return c.renovacaoAutomatica ? 30 : 45
}

export interface Renovacao {
  cobranca: Cobranca & { id: number }
  plataforma: Plataforma
  data: string
  dias: number
  valorReais: number
  alerta: boolean
}

export async function proximasRenovacoes(dias = 60): Promise<Renovacao[]> {
  const [cobrancas, plataformas, cotacao] = await Promise.all([db.cobrancas.toArray(), db.plataformas.toArray(), lerCotacao()])
  const resultado: Renovacao[] = []
  for (const c of cobrancas) {
    if (!c.proximaRenovacao || (c.tipo !== 'mensal' && c.tipo !== 'anual')) continue
    const plataforma = plataformas.find((p) => p.id === c.plataformaId)
    if (!plataformaConta(plataforma)) continue
    const faltam = diasAte(c.proximaRenovacao)
    if (faltam > dias) continue
    resultado.push({
      cobranca: c as Cobranca & { id: number },
      plataforma: plataforma!,
      data: c.proximaRenovacao,
      dias: faltam,
      valorReais: emReais(c.valor, c.moeda, cotacao),
      alerta: faltam <= antecedenciaAviso(c),
    })
  }
  return resultado.sort((a, b) => a.data.localeCompare(b.data))
}

export interface ItemReembolso {
  tipo: 'cobranca' | 'gasto'
  id: number
  descricao: string
  valor: number
  data: string
  comprovante?: string
}

export async function reembolsosPendentes(): Promise<ItemReembolso[]> {
  const [pagamentos, gastos, cobrancas, plataformas] = await Promise.all([
    db.pagamentosCobranca.toArray(),
    db.gastosEmpresa.toArray(),
    db.cobrancas.toArray(),
    db.plataformas.toArray(),
  ])
  const nomePlataforma = (cobrancaId: number) => {
    const c = cobrancas.find((x) => x.id === cobrancaId)
    return plataformas.find((p) => p.id === c?.plataformaId)?.nome ?? 'Cobrança'
  }
  const itens: ItemReembolso[] = [
    ...pagamentos
      .filter((p) => p.pagoPorMim && !p.reembolsadoEm)
      .map((p) => ({ tipo: 'cobranca' as const, id: p.id!, descricao: nomePlataforma(p.cobrancaId), valor: p.valor, data: p.pagoEm, comprovante: p.comprovante })),
    ...gastos
      .filter((g) => g.pagoPorMim && !g.reembolsadoEm)
      .map((g) => ({ tipo: 'gasto' as const, id: g.id!, descricao: g.descricao, valor: g.valor, data: g.data, comprovante: g.comprovante })),
  ]
  return itens.sort((a, b) => a.data.localeCompare(b.data))
}

export async function marcarReembolsado(itens: ItemReembolso[], data = hoje()) {
  await db.transaction('rw', db.pagamentosCobranca, db.gastosEmpresa, async () => {
    for (const item of itens) {
      if (item.tipo === 'cobranca') await db.pagamentosCobranca.update(item.id, { reembolsadoEm: data })
      else await db.gastosEmpresa.update(item.id, { reembolsadoEm: data })
    }
  })
}

export interface ResumoEmpresa {
  custoMensal: number
  gastoDoMes: number
  aReembolsar: number
  porProduto: Array<{ id: number; nome: string; cor: string; valor: number }>
  usoAcimaDoLimite: Array<{ plataforma: string; valor: number; limite: number }>
}

export async function resumoEmpresa(): Promise<ResumoEmpresa> {
  const [cobrancas, plataformas, produtos, pagamentos, gastos, cotacao, reembolsos] = await Promise.all([
    db.cobrancas.toArray(),
    db.plataformas.toArray(),
    db.produtos.toArray(),
    db.pagamentosCobranca.toArray(),
    db.gastosEmpresa.toArray(),
    lerCotacao(),
    reembolsosPendentes(),
  ])
  const mes = mesAtual()
  const porProduto = new Map<number, number>()
  let total = 0
  for (const c of cobrancas) {
    const plataforma = plataformas.find((p) => p.id === c.plataformaId)
    if (!plataformaConta(plataforma)) continue
    const valor = custoMensal(c, pagamentos, cotacao)
    total += valor
    porProduto.set(plataforma!.produtoId, (porProduto.get(plataforma!.produtoId) ?? 0) + valor)
  }

  const gastoDoMes =
    pagamentos.filter((p) => mesDe(p.pagoEm) === mes).reduce((s, p) => s + p.valor, 0) +
    gastos.filter((g) => mesDe(g.data) === mes).reduce((s, g) => s + g.valor, 0)

  const usoAcimaDoLimite: ResumoEmpresa['usoAcimaDoLimite'] = []
  for (const c of cobrancas) {
    if (c.tipo !== 'uso' || !c.limiteEsperado) continue
    const limite = emReais(c.limiteEsperado, c.moeda, cotacao)
    const doMes = pagamentos.filter((p) => p.cobrancaId === c.id && mesDe(p.pagoEm) === mes).reduce((s, p) => s + p.valor, 0)
    if (doMes > limite) {
      usoAcimaDoLimite.push({ plataforma: plataformas.find((p) => p.id === c.plataformaId)?.nome ?? '?', valor: doMes, limite })
    }
  }

  return {
    custoMensal: total,
    gastoDoMes,
    aReembolsar: reembolsos.reduce((s, r) => s + r.valor, 0),
    porProduto: produtos.map((p) => ({ id: p.id!, nome: p.nome, cor: p.cor, valor: porProduto.get(p.id!) ?? 0 })),
    usoAcimaDoLimite,
  }
}
