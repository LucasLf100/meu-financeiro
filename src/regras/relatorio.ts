// Cálculo de tudo o que entrou e saiu num mês: usado pelos Relatórios e pelo gráfico do Início.
import { db, type FormaConta } from '../db'
import { mesDe } from '../datas'
import { formaDaConta, ocorrenciasDoMes } from './contas'
import { contasDoCartao } from './cartoes'
import { empresaNoBolso } from './empresa'
import { recebimentosDoMes } from './recebimentos'

export type FormaRelatorio = Exclude<FormaConta, 'varia'> | 'indefinida'

export interface MesRelatorio {
  contasFixas: number
  faturas: number
  aVista: number
  empresa: number
  saidas: number
  entradas: number
  /** Valor por categoria (id) e itens especiais (chave texto). */
  porCategoria: Map<number | string, number>
  porForma: Map<FormaRelatorio, number>
}

export const ESPECIAIS: Record<string, { nome: string; icone: string }> = {
  empresa: { nome: 'Empresa (do meu bolso)', icone: '💼' },
  cartaoSemDetalhe: { nome: 'Outras compras no cartão', icone: '💳' },
  semCategoria: { nome: 'Sem categoria', icone: '📦' },
}

/** Tudo o que entrou e saiu num mês, sem contar nada duas vezes. */
export async function calcularMes(mes: string): Promise<MesRelatorio> {
  const [contas, gastosDoMes, cartoes, parcelasDoMes, pagamentosFatura, empresa, recebimentos, retiradas] = await Promise.all([
    ocorrenciasDoMes(mes),
    db.gastos.where('data').between(`${mes}-01`, `${mes}-31`, true, true).toArray(),
    db.cartoes.toArray(),
    db.parcelas.where({ fatura: mes }).toArray(),
    db.pagamentosFatura.where({ fatura: mes }).toArray(),
    empresaNoBolso(mes),
    recebimentosDoMes(mes),
    db.retiradas.toArray(),
  ])
  const gastosDasParcelas = await db.gastos.bulkGet([...new Set(parcelasDoMes.map((p) => p.gastoId))])

  const porCategoria = new Map<number | string, number>()
  const porForma = new Map<FormaRelatorio, number>()
  const somar = <K,>(mapa: Map<K, number>, chave: K, valor: number) => valor && mapa.set(chave, (mapa.get(chave) ?? 0) + valor)

  // Contas fixas (recorrentes e parcelas de financiamento).
  let contasFixas = 0
  for (const o of contas) {
    contasFixas += o.valor
    somar(porCategoria, o.conta.categoriaId ?? 'semCategoria', o.valor)
    const forma = o.pagamento?.forma ?? formaDaConta(o.conta)
    somar(porForma, !forma || forma === 'varia' ? 'indefinida' : forma, o.valor)
  }

  // Faturas: compras e parcelas que vencem neste mês. Se a fatura foi paga, vale o valor pago
  // (menos as contas fixas do cartão, que já estão acima).
  let faturas = 0
  for (const cartao of cartoes) {
    const parcelas = parcelasDoMes.filter((p) => p.cartaoId === cartao.id)
    const somaParcelas = parcelas.reduce((s, p) => s + p.valor, 0)
    const pagamento = pagamentosFatura.find((p) => p.cartaoId === cartao.id)
    const contasNoCartao = (await contasDoCartao(cartao.id!, mes)).reduce((s, o) => s + o.valor, 0)
    const valor = pagamento ? Math.max(somaParcelas, pagamento.valor - contasNoCartao) : somaParcelas
    if (!valor) continue
    faturas += valor
    somar(porForma, 'cartao', valor)
    for (const p of parcelas) {
      const gasto = gastosDasParcelas.find((g) => g?.id === p.gastoId)
      somar(porCategoria, gasto?.categoriaId ?? 'semCategoria', p.valor)
    }
    somar(porCategoria, 'cartaoSemDetalhe', valor - somaParcelas)
  }

  // Gastos pagos na hora (no crédito, já entram pela fatura).
  let aVista = 0
  for (const g of gastosDoMes) {
    if (g.forma === 'credito') continue
    aVista += g.valor
    somar(porCategoria, g.categoriaId, g.valor)
    somar(porForma, g.forma, g.valor)
  }

  // Empresa paga do meu bolso (se a opção estiver ligada).
  const valorEmpresa = empresa.ativo ? empresa.pago + empresa.falta : 0
  somar(porCategoria, 'empresa', valorEmpresa)

  const entradas = recebimentos.previsto + retiradas.filter((r) => mesDe(r.data) === mes).reduce((s, r) => s + r.valor, 0)

  return {
    contasFixas,
    faturas,
    aVista,
    empresa: valorEmpresa,
    saidas: contasFixas + faturas + aVista + valorEmpresa,
    entradas,
    porCategoria,
    porForma,
  }
}

