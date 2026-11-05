import type { Cobranca, StatusPlataforma, TipoCobranca } from '../../db'
import { formatarDolares, formatarReais } from '../../dinheiro'

export const NOME_TIPO: Record<TipoCobranca, string> = {
  mensal: 'Mensal',
  anual: 'Anual',
  unica: 'Única',
  uso: 'Por uso',
  gratis: 'Grátis',
}

export const NOME_STATUS: Record<StatusPlataforma, [string, 'ok' | 'alerta' | 'perigo' | 'neutra']> = {
  ativa: ['Ativa', 'ok'],
  teste: ['Em teste', 'alerta'],
  planejada: ['Planejada', 'neutra'],
  cancelada: ['Cancelada', 'perigo'],
}

export function formatarMoeda(valor: number, moeda: 'BRL' | 'USD'): string {
  return moeda === 'USD' ? formatarDolares(valor) : formatarReais(valor)
}

/** "R$ 60,00 por ano", "Por uso (US$)", "Grátis"… */
export function descreverCobranca(c: Cobranca): string {
  switch (c.tipo) {
    case 'mensal':
      return `${formatarMoeda(c.valor, c.moeda)} por mês`
    case 'anual':
      return c.valor ? `${formatarMoeda(c.valor, c.moeda)} por ano` : 'Anual (valor a preencher)'
    case 'unica':
      return `${formatarMoeda(c.valor, c.moeda)} (única)`
    case 'uso':
      return c.limiteEsperado ? `Por uso, até ${formatarMoeda(c.limiteEsperado, c.moeda)}/mês` : `Por uso (${c.moeda === 'USD' ? 'US$' : 'R$'})`
    default:
      return 'Grátis'
  }
}
