import { db, type Cartao, type Gasto, type Parcela } from '../db'
import { formaDaConta, ocorrenciasDoMes, type OcorrenciaConta } from './contas'
import { diaDoMes, hoje, mesDe, somarMeses } from '../datas'

/**
 * Em qual fatura (identificada pelo mês do vencimento) cai uma compra.
 * Compra feita no dia do fechamento ou depois vai para a fatura seguinte.
 */
export function faturaDaCompra(cartao: Cartao, diaCompra: string): string {
  const dia = Number(diaCompra.slice(8, 10))
  const mesFechamento = dia < cartao.diaFechamento ? mesDe(diaCompra) : somarMeses(mesDe(diaCompra), 1)
  return cartao.diaVencimento > cartao.diaFechamento ? mesFechamento : somarMeses(mesFechamento, 1)
}

export function datasDaFatura(cartao: Cartao, fatura: string): { fechamento: string; vencimento: string } {
  const mesFechamento = cartao.diaVencimento > cartao.diaFechamento ? fatura : somarMeses(fatura, -1)
  return { fechamento: diaDoMes(mesFechamento, cartao.diaFechamento), vencimento: diaDoMes(fatura, cartao.diaVencimento) }
}

/** Fatura que está recebendo compras hoje. */
export function faturaAberta(cartao: Cartao): string {
  return faturaDaCompra(cartao, hoje())
}

/** Divide em centavos; a diferença de arredondamento fica na primeira parcela. */
export function dividirParcelas(valor: number, quantidade: number): number[] {
  const base = Math.floor(valor / quantidade)
  const resto = valor - base * quantidade
  return Array.from({ length: quantidade }, (_, i) => (i === 0 ? base + resto : base))
}

/** Cria (ou recria) as parcelas de um gasto no crédito. */
export async function gerarParcelas(gasto: Gasto & { id: number }): Promise<void> {
  await db.parcelas.where({ gastoId: gasto.id }).delete()
  if (gasto.forma !== 'credito' || !gasto.cartaoId) return
  const cartao = await db.cartoes.get(gasto.cartaoId)
  if (!cartao) return
  const total = Math.max(1, gasto.parcelas ?? 1)
  const primeira = faturaDaCompra(cartao, gasto.data)
  const valores = dividirParcelas(gasto.valor, total)
  // Fatura já paga (paga antes de fechar, por exemplo) não recebe parcela nova: vai para a seguinte.
  const faturas = distribuir(
    valores.map((_, i) => somarMeses(primeira, i)),
    await faturasPagas(cartao.id!),
  )
  const parcelas: Parcela[] = valores.map((valor, i) => ({
    gastoId: gasto.id,
    cartaoId: cartao.id!,
    numero: i + 1,
    total,
    valor,
    fatura: faturas[i],
  }))
  await db.parcelas.bulkAdd(parcelas)
}

async function faturasPagas(cartaoId: number): Promise<Set<string>> {
  const pagamentos = await db.pagamentosFatura.where({ cartaoId }).toArray()
  return new Set(pagamentos.map((p) => p.fatura))
}

/**
 * Distribui parcelas que ainda não foram pagas: cada uma na fatura prevista,
 * mas sempre depois da anterior e nunca numa fatura já paga.
 */
function distribuir(previstas: string[], pagas: Set<string>, ultimaOcupada?: string): string[] {
  const resultado: string[] = []
  let anterior = ultimaOcupada
  for (const prevista of previstas) {
    let f = anterior && prevista <= anterior ? somarMeses(anterior, 1) : prevista
    while (pagas.has(f)) f = somarMeses(f, 1)
    resultado.push(f)
    anterior = f
  }
  return resultado
}

/**
 * Antes de salvar a edição de um gasto, diz se ela é possível sem bagunçar faturas já pagas.
 * Retorna a mensagem de erro, ou null se estiver tudo certo.
 */
export async function validarEdicaoGasto(antigo: Gasto & { id: number }, novo: Gasto): Promise<string | null> {
  const parcelas = await db.parcelas.where({ gastoId: antigo.id }).toArray()
  if (!parcelas.length) return null
  const pagas = await faturasPagas(parcelas[0].cartaoId)
  const travadas = parcelas.filter((p) => pagas.has(p.fatura))
  if (!travadas.length) return null
  const qtd = travadas.length
  const somaTravada = travadas.reduce((s, p) => s + p.valor, 0)
  if (novo.forma !== 'credito' || novo.cartaoId !== antigo.cartaoId) {
    return `Esta compra já tem ${qtd} parcela${qtd > 1 ? 's' : ''} em fatura paga. Não dá para trocar a forma de pagamento nem o cartão.`
  }
  const total = novo.parcelas ?? 1
  if (total < qtd) return `Já ${qtd > 1 ? 'foram pagas' : 'foi paga'} ${qtd} parcela${qtd > 1 ? 's' : ''}: o número de parcelas não pode ser menor que ${qtd}.`
  if (total === qtd && novo.valor !== somaTravada) return 'Todas as parcelas já foram pagas: o valor não pode mudar.'
  if (total > qtd && novo.valor - somaTravada < total - qtd) return 'O valor ficou menor do que o que já foi pago nas faturas.'
  return null
}

/**
 * Atualiza as parcelas de um gasto depois de criado ou editado.
 * Parcelas em faturas já pagas ficam como estão; só as que faltam são recalculadas.
 * Se nada que afeta as parcelas mudou (só descrição ou categoria), não mexe em nada.
 */
export async function atualizarParcelas(novo: Gasto & { id: number }, antigo?: Gasto): Promise<void> {
  const mudouParcelas =
    !antigo ||
    antigo.valor !== novo.valor ||
    antigo.forma !== novo.forma ||
    antigo.cartaoId !== novo.cartaoId ||
    antigo.parcelas !== novo.parcelas ||
    antigo.data !== novo.data
  if (!mudouParcelas) return

  const existentes = await db.parcelas.where({ gastoId: novo.id }).toArray()
  const pagasAntes = existentes.length ? await faturasPagas(existentes[0].cartaoId) : new Set<string>()
  const travadas = existentes.filter((p) => pagasAntes.has(p.fatura)).sort((a, b) => a.numero - b.numero)
  if (!travadas.length) {
    await gerarParcelas(novo)
    return
  }

  const cartao = await db.cartoes.get(novo.cartaoId!)
  if (!cartao) return
  const total = novo.parcelas ?? 1
  const restantes = total - travadas.length
  const valores = restantes > 0 ? dividirParcelas(novo.valor - travadas.reduce((s, p) => s + p.valor, 0), restantes) : []
  const primeira = faturaDaCompra(cartao, novo.data)
  const numeros = valores.map((_, i) => travadas.length + i + 1)
  const faturas = distribuir(
    numeros.map((n) => somarMeses(primeira, n - 1)),
    pagasAntes,
    travadas[travadas.length - 1].fatura,
  )
  const novas: Parcela[] = valores.map((valor, i) => ({
    gastoId: novo.id,
    cartaoId: cartao.id!,
    numero: numeros[i],
    total,
    valor,
    fatura: faturas[i],
  }))
  await db.parcelas.bulkDelete(existentes.filter((p) => !pagasAntes.has(p.fatura)).map((p) => p.id!))
  await db.parcelas.bulkPut([...travadas.map((p) => ({ ...p, total })), ...novas])
}

/**
 * Depois de mudar os dias de fechamento ou vencimento de um cartão,
 * move as parcelas que ainda não estão em fatura paga para a fatura certa.
 */
export async function recalcularFaturasDoCartao(cartao: Cartao & { id: number }): Promise<number> {
  const [parcelas, pagas] = await Promise.all([db.parcelas.where({ cartaoId: cartao.id }).toArray(), faturasPagas(cartao.id)])
  const gastos = await db.gastos.bulkGet([...new Set(parcelas.map((p) => p.gastoId))])
  const mudadas: Parcela[] = []
  for (const gasto of gastos) {
    if (!gasto) continue
    const suas = parcelas.filter((p) => p.gastoId === gasto.id).sort((a, b) => a.numero - b.numero)
    const travadas = suas.filter((p) => pagas.has(p.fatura))
    const livres = suas.filter((p) => !pagas.has(p.fatura))
    if (!livres.length) continue
    const primeira = faturaDaCompra(cartao, gasto.data)
    const faturas = distribuir(
      livres.map((p) => somarMeses(primeira, p.numero - 1)),
      pagas,
      travadas.length ? travadas[travadas.length - 1].fatura : undefined,
    )
    livres.forEach((p, i) => {
      if (faturas[i] !== p.fatura) mudadas.push({ ...p, fatura: faturas[i] })
    })
  }
  if (mudadas.length) await db.parcelas.bulkPut(mudadas)
  return mudadas.length
}

/** Contas fixas pagas neste cartão que vencem no mês da fatura (assinaturas, mensalidades…). */
export async function contasDoCartao(cartaoId: number, fatura: string): Promise<OcorrenciaConta[]> {
  const cartao = await db.cartoes.get(cartaoId)
  // Sem cartão escolhido, reconhece pelo nome (ex.: "Anuidade do cartão Bradesco").
  const palavra = cartao?.nome.split(' ')[0]?.toLowerCase() ?? ''
  return (await ocorrenciasDoMes(fatura)).filter(
    (o) =>
      formaDaConta(o.conta) === 'cartao' &&
      (o.conta.cartaoId === cartaoId || (o.conta.cartaoId === undefined && !!palavra && o.conta.nome.toLowerCase().includes(palavra))),
  )
}

/**
 * Paga a fatura: registra o pagamento e marca como pagas as contas fixas desse cartão no mês.
 * O valor registrado é o total: compras e parcelas + contas fixas do cartão.
 */
export async function pagarFatura(cartao: Cartao & { id: number }, fatura: string, totalCompras: number, dia = hoje()) {
  const contas = await contasDoCartao(cartao.id, fatura)
  await db.transaction('rw', db.pagamentosFatura, db.pagamentosConta, async () => {
    await db.pagamentosFatura.add({
      cartaoId: cartao.id,
      fatura,
      valor: totalCompras + contas.reduce((s, o) => s + o.valor, 0),
      pagoEm: dia,
    })
    for (const o of contas) {
      if (o.pagamento) continue
      await db.pagamentosConta.add({ contaId: o.conta.id, competencia: fatura, valor: o.valor, pagoEm: dia, viaFaturaCartaoId: cartao.id, forma: 'cartao', cartaoId: cartao.id })
    }
  })
}

/** Desfaz o pagamento da fatura e das contas fixas que foram marcadas junto com ela. */
export async function desfazerPagamentoFatura(cartaoId: number, fatura: string) {
  await db.transaction('rw', db.pagamentosFatura, db.pagamentosConta, async () => {
    await db.pagamentosFatura.where({ cartaoId, fatura }).delete()
    await db.pagamentosConta.where({ competencia: fatura }).filter((p) => p.viaFaturaCartaoId === cartaoId).delete()
  })
}

export type StatusFatura = 'aberta' | 'fechada' | 'atrasada' | 'paga'

export function statusFatura(cartao: Cartao, fatura: string, paga: boolean): StatusFatura {
  if (paga) return 'paga'
  const { fechamento, vencimento } = datasDaFatura(cartao, fatura)
  const dia = hoje()
  if (dia > vencimento) return 'atrasada'
  if (dia >= fechamento) return 'fechada'
  return 'aberta'
}

export interface ResumoFatura {
  cartao: Cartao
  fatura: string
  total: number
  paga: boolean
  vencimento: string
}

/** Todas as faturas com valor, de todos os cartões, com a informação de pagas ou não. */
export async function listarFaturas(): Promise<ResumoFatura[]> {
  const [cartoes, parcelas, pagamentos] = await Promise.all([
    db.cartoes.toArray(),
    db.parcelas.toArray(),
    db.pagamentosFatura.toArray(),
  ])
  const pagas = new Set(pagamentos.map((p) => `${p.cartaoId}|${p.fatura}`))
  const totais = new Map<string, number>()
  for (const p of parcelas) {
    const chave = `${p.cartaoId}|${p.fatura}`
    totais.set(chave, (totais.get(chave) ?? 0) + p.valor)
  }
  const resultado: ResumoFatura[] = []
  for (const [chave, total] of totais) {
    const [idTexto, fatura] = chave.split('|')
    const cartao = cartoes.find((c) => c.id === Number(idTexto))
    if (!cartao) continue
    resultado.push({ cartao, fatura, total, paga: pagas.has(chave), vencimento: datasDaFatura(cartao, fatura).vencimento })
  }
  return resultado.sort((a, b) => a.vencimento.localeCompare(b.vencimento))
}

/** Quanto do limite está comprometido: tudo o que está em faturas não pagas. */
export function limiteUsado(cartao: Cartao, faturas: ResumoFatura[]): number {
  return faturas.filter((f) => f.cartao.id === cartao.id && !f.paga).reduce((s, f) => s + f.total, 0)
}
