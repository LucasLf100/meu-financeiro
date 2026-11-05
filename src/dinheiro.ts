// Valores são sempre guardados em centavos (inteiros) para evitar erro de arredondamento.

const formatoBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const formatoUSD = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' })

export function formatarReais(centavos: number): string {
  return formatoBRL.format(centavos / 100)
}

export function formatarDolares(centavos: number): string {
  return formatoUSD.format(centavos / 100)
}

/** Converte "1.234,56", "1234,56" ou "1234.56" em centavos. Retorna null se inválido. */
export function lerValor(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, '').trim()
  if (!limpo) return null
  let normal = limpo
  if (limpo.includes(',')) normal = limpo.replace(/\./g, '').replace(',', '.')
  const numero = Number(normal)
  if (!Number.isFinite(numero)) return null
  return Math.round(numero * 100)
}
