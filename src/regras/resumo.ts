import { db, type Cartao } from '../db'
import { diasAte, mesAtual, mesDe, somarMeses } from '../datas'
import { atrasadasAnteriores, ocorrenciasDoMes } from './contas'
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
}

export interface ResumoPessoal {
  dividaTotal: number
  venceEsteMes: number
  parcelasFuturas: number
  pagoNoMes: number
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
}

export async function resumoPessoal(): Promise<ResumoPessoal> {
  const mes = mesAtual()
  const [contasMes, contasAtrasadas, faturas, cartoes, pagamentosFatura, reembolsos, retiradas, gastos, recebimentos] = await Promise.all([
    ocorrenciasDoMes(mes),
    atrasadasAnteriores(mes),
    listarFaturas(),
    db.cartoes.toArray(),
    db.pagamentosFatura.toArray(),
    reembolsosPendentes(),
    db.retiradas.toArray(),
    db.gastos.toArray(),
    recebimentosDoMes(mes),
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
    })
  }

  let parcelasFuturas = 0
  for (const f of faturas) {
    if (f.paga) continue
    if (f.fatura > mes) {
      parcelasFuturas += f.total
      continue
    }
    compromissos.push({
      chave: `fatura-${f.cartao.id}-${f.fatura}`,
      tipo: 'fatura',
      nome: `Fatura ${f.cartao.nome}`,
      valor: f.total,
      vencimento: f.vencimento,
      atrasado: diasAte(f.vencimento) < 0,
    })
  }

  const venceEsteMes = compromissos.reduce((s, c) => s + c.valor, 0)
  const pagoNoMes =
    contasMes.filter((o) => o.status === 'paga').reduce((s, o) => s + o.valor, 0) +
    pagamentosFatura.filter((p) => p.fatura === mes).reduce((s, p) => s + p.valor, 0)

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
  const sobraPrevista = entradasPrevistas - (pagoNoMes + venceEsteMes) - gastosAVista

  return {
    dividaTotal: venceEsteMes + parcelasFuturas,
    venceEsteMes,
    parcelasFuturas,
    pagoNoMes,
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
  }
}
