import { db, type Cartao } from '../db'
import { diasAte, mesAtual, mesDe, somarMeses } from '../datas'
import { atrasadasAnteriores, contaValeNoMes, ocorrenciasDoMes } from './contas'
import { limiteUsado, listarFaturas } from './cartoes'
import { reembolsosPendentes } from './empresa'
import { recebimentosDoMes } from './recebimentos'

export interface Compromisso {
  chave: string
  tipo: 'conta' | 'fatura'
  nome: string
  valor: number
  vencimento: string
  atrasado: boolean
  /** true = é dívida (conta com parcelas ou fatura); false = conta recorrente sem fim */
  divida: boolean
}

export interface ItemDivida {
  rotulo: string
  detalhe: string
  valor: number
  quando: 'agora' | 'futuro'
}

export interface ResumoPessoal {
  dividaTotal: number
  detalhesDivida: ItemDivida[]
  venceEsteMes: number
  parcelasFuturas: number
  pagoNoMes: number
  /** Contas fixas recorrentes (sem número de parcelas) deste mês */
  recorrentes: { total: number; pago: number; falta: number; atrasadas: number; quantidade: number }
  atrasados: Compromisso[]
  proximos: Compromisso[]
  cartoes: Array<{ cartao: Cartao; usado: number }>
  grafico: Array<{ mes: string; valor: number }>
  aReceberEmpresa: number
  retiradasDoMes: number
  gastosDoMes: number
  entradasPrevistas: number
  entradasRecebidas: number
  sobraPrevista: number
  /** Tudo o que sai no mês: o que já foi pago e o que falta pagar. */
  saidas: { total: number; pago: number; falta: number; contasFixas: number; parcelasECartao: number; gastosAvulsos: number }
}

export async function resumoPessoal(): Promise<ResumoPessoal> {
  const mes = mesAtual()
  const [contasMes, contasAtrasadas, faturas, cartoes, pagamentosFatura, reembolsos, retiradas, gastos, recebimentos, contas] = await Promise.all([
    ocorrenciasDoMes(mes),
    atrasadasAnteriores(mes),
    listarFaturas(),
    db.cartoes.toArray(),
    db.pagamentosFatura.toArray(),
    reembolsosPendentes(),
    db.retiradas.toArray(),
    db.gastos.toArray(),
    recebimentosDoMes(mes),
    db.contas.toArray(),
  ])

  const compromissos: Compromisso[] = []
  for (const o of [...contasAtrasadas, ...contasMes]) {
    if (o.status === 'paga') continue
    compromissos.push({
      chave: `conta-${o.conta.id}-${o.competencia}`,
      tipo: 'conta',
      nome: o.parcela ? `${o.conta.nome} (${o.parcela.numero}/${o.parcela.total})` : o.conta.nome,
      valor: o.valor,
      vencimento: o.vencimento,
      atrasado: o.status === 'atrasada',
      divida: !!o.parcela,
    })
  }

  const detalhesDivida: ItemDivida[] = []
  let parcelasFuturas = 0
  const futurasPorCartao = new Map<string, { valor: number; meses: number }>()
  for (const f of faturas) {
    if (f.paga) continue
    if (f.fatura > mes) {
      parcelasFuturas += f.total
      const atual = futurasPorCartao.get(f.cartao.nome) ?? { valor: 0, meses: 0 }
      futurasPorCartao.set(f.cartao.nome, { valor: atual.valor + f.total, meses: atual.meses + 1 })
      continue
    }
    compromissos.push({
      chave: `fatura-${f.cartao.id}-${f.fatura}`,
      tipo: 'fatura',
      nome: `Fatura ${f.cartao.nome}`,
      valor: f.total,
      vencimento: f.vencimento,
      atrasado: diasAte(f.vencimento) < 0,
      divida: true,
    })
  }

  // Contas fixas com número de parcelas (financiamento, empréstimo): as parcelas depois deste mês também são dívida.
  for (const conta of contas) {
    if (!conta.ativa || !conta.totalParcelas) continue
    let valor = 0
    let quantidade = 0
    for (let m = conta.inicio > mes ? conta.inicio : somarMeses(mes, 1); quantidade < 600; m = somarMeses(m, 1)) {
      if (!contaValeNoMes(conta, m)) break
      valor += conta.valor
      quantidade++
    }
    if (!quantidade) continue
    parcelasFuturas += valor
    detalhesDivida.push({ rotulo: conta.nome, detalhe: `${quantidade} parcela${quantidade > 1 ? 's' : ''} futura${quantidade > 1 ? 's' : ''} da conta fixa`, valor, quando: 'futuro' })
  }
  for (const [nome, { valor, meses }] of futurasPorCartao) {
    detalhesDivida.push({ rotulo: `Cartão ${nome}`, detalhe: `parcelas em ${meses} fatura${meses > 1 ? 's' : ''} futura${meses > 1 ? 's' : ''}`, valor, quando: 'futuro' })
  }
  detalhesDivida.unshift(
    ...compromissos.filter((c) => c.divida).map((c) => ({
      rotulo: c.nome,
      detalhe: `${c.atrasado ? 'atrasada · venceu' : 'vence'} ${c.vencimento.slice(8, 10)}/${c.vencimento.slice(5, 7)}`,
      valor: c.valor,
      quando: 'agora' as const,
    })),
  )

  // Dívida deste mês: só parcelas (de contas com fim e do cartão).
  const venceEsteMes = compromissos.filter((c) => c.divida).reduce((s, c) => s + c.valor, 0)
  const pagoFaturas = pagamentosFatura.filter((p) => p.fatura === mes).reduce((s, p) => s + p.valor, 0)
  const pagoNoMes = contasMes.filter((o) => o.status === 'paga' && o.parcela).reduce((s, o) => s + o.valor, 0) + pagoFaturas

  // Contas recorrentes (luz, água, telefone…): custo do mês, não dívida.
  const recorrentesMes = contasMes.filter((o) => !o.parcela)
  const recorrentesAtrasadasAntes = contasAtrasadas.filter((o) => !o.parcela)
  const recorrentes = {
    total: recorrentesMes.reduce((s, o) => s + o.valor, 0),
    pago: recorrentesMes.filter((o) => o.status === 'paga').reduce((s, o) => s + o.valor, 0),
    falta: [...recorrentesAtrasadasAntes, ...recorrentesMes].filter((o) => o.status !== 'paga').reduce((s, o) => s + o.valor, 0),
    atrasadas: [...recorrentesAtrasadasAntes, ...recorrentesMes].filter((o) => o.status === 'atrasada').length,
    quantidade: recorrentesMes.length,
  }

  // Tudo o que sai no mês (dívida + recorrentes), pago ou não: usado na sobra.
  const pagoTudo = contasMes.filter((o) => o.status === 'paga').reduce((s, o) => s + o.valor, 0) + pagoFaturas
  const pendenteTudo = compromissos.reduce((s, c) => s + c.valor, 0)

  // Gráfico: quanto havia para pagar em cada um dos últimos 6 meses (contas + faturas).
  const grafico: ResumoPessoal['grafico'] = []
  for (let i = 5; i >= 0; i--) {
    const m = somarMeses(mes, -i)
    const contas = i === 0 ? contasMes : await ocorrenciasDoMes(m)
    const valor = contas.reduce((s, o) => s + o.valor, 0) + faturas.filter((f) => f.fatura === m).reduce((s, f) => s + f.total, 0)
    grafico.push({ mes: m, valor })
  }

  const retiradasDoMes = retiradas.filter((r) => mesDe(r.data) === mes).reduce((s, r) => s + r.valor, 0)
  const gastosDoMes = gastos.filter((g) => mesDe(g.data) === mes).reduce((s, g) => s + g.valor, 0)
  const gastosAVista = gastos.filter((g) => mesDe(g.data) === mes && g.forma !== 'credito').reduce((s, g) => s + g.valor, 0)
  const entradasPrevistas = recebimentos.previsto + retiradasDoMes
  const entradasRecebidas = recebimentos.recebido + retiradasDoMes
  // Sobra = o que entra no mês − contas e faturas do mês − gastos pagos na hora (crédito já está nas faturas).
  const sobraPrevista = entradasPrevistas - (pagoTudo + pendenteTudo) - gastosAVista

  // Saídas do mês: tudo o que já saiu ou vai sair (contas, parcelas, faturas e gastos pagos na hora).
  const contasRecorrentesMes = recorrentes.total + recorrentesAtrasadasAntes.filter((o) => o.status !== 'paga').reduce((s, o) => s + o.valor, 0)
  const saidasTotal = pagoTudo + pendenteTudo + gastosAVista
  const saidas = {
    total: saidasTotal,
    pago: pagoTudo + gastosAVista,
    falta: pendenteTudo,
    contasFixas: contasRecorrentesMes,
    parcelasECartao: saidasTotal - contasRecorrentesMes - gastosAVista,
    gastosAvulsos: gastosAVista,
  }

  return {
    dividaTotal: venceEsteMes + parcelasFuturas,
    detalhesDivida,
    venceEsteMes,
    parcelasFuturas,
    pagoNoMes,
    recorrentes,
    atrasados: compromissos.filter((c) => c.atrasado).sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    proximos: compromissos
      .filter((c) => !c.atrasado && diasAte(c.vencimento) <= 7)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    cartoes: cartoes.filter((c) => c.ativo).map((cartao) => ({ cartao, usado: limiteUsado(cartao, faturas) })),
    grafico,
    aReceberEmpresa: reembolsos.reduce((s, r) => s + r.valor, 0),
    retiradasDoMes,
    gastosDoMes,
    entradasPrevistas,
    entradasRecebidas,
    sobraPrevista,
    saidas,
  }
}
