// Datas como texto: dia = 'AAAA-MM-DD', mês = 'AAAA-MM'. Sempre no fuso local.

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

const doisDigitos = (n: number) => String(n).padStart(2, '0')

export function paraDia(data: Date): string {
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`
}

export function hoje(): string {
  return paraDia(new Date())
}

export function mesAtual(): string {
  return hoje().slice(0, 7)
}

export function mesDe(dia: string): string {
  return dia.slice(0, 7)
}

export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number)
  const total = a * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${doisDigitos((total % 12) + 1)}`
}

/** Diferença em meses: b - a. */
export function mesesEntre(a: string, b: string): number {
  const [aa, am] = a.split('-').map(Number)
  const [ba, bm] = b.split('-').map(Number)
  return (ba * 12 + bm) - (aa * 12 + am)
}

export function diasNoMes(mes: string): number {
  const [a, m] = mes.split('-').map(Number)
  return new Date(a, m, 0).getDate()
}

/** Monta 'AAAA-MM-DD' ajustando o dia ao tamanho do mês (dia 31 em fevereiro vira 28/29). */
export function diaDoMes(mes: string, dia: number): string {
  return `${mes}-${doisDigitos(Math.min(dia, diasNoMes(mes)))}`
}

export function somarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number)
  return paraDia(new Date(a, m - 1, d + n))
}

/** Somar anos mantendo o dia (29/02 vira 28/02). */
export function somarAnos(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number)
  const mes = `${a + n}-${doisDigitos(m)}`
  return diaDoMes(mes, d)
}

export function somarMesesDia(dia: string, n: number): string {
  return diaDoMes(somarMeses(mesDe(dia), n), Number(dia.slice(8, 10)))
}

/** Dias de `de` até `ate` (negativo se já passou). */
export function diasAte(ate: string, de = hoje()): number {
  const [a1, m1, d1] = de.split('-').map(Number)
  const [a2, m2, d2] = ate.split('-').map(Number)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000)
}

export function nomeMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return `${MESES[m - 1]} ${a}`
}

export function nomeMesCurto(mes: string): string {
  return MESES_CURTOS[Number(mes.slice(5, 7)) - 1]
}

export function formatarDia(dia: string): string {
  const [a, m, d] = dia.split('-')
  return `${d}/${m}/${a}`
}

export function formatarDiaCurto(dia: string): string {
  return `${Number(dia.slice(8, 10))} ${MESES_CURTOS[Number(dia.slice(5, 7)) - 1]}`
}

/** "Hoje", "Ontem" ou "quarta, 5 nov". */
export function tituloDia(dia: string): string {
  const diferenca = diasAte(dia)
  if (diferenca === 0) return 'Hoje'
  if (diferenca === -1) return 'Ontem'
  const [a, m, d] = dia.split('-').map(Number)
  return `${DIAS_SEMANA[new Date(a, m - 1, d).getDay()]}, ${formatarDiaCurto(dia)}`
}

/** "hoje", "amanhã", "em 5 dias", "há 3 dias". */
export function prazo(dia: string): string {
  const n = diasAte(dia)
  if (n === 0) return 'hoje'
  if (n === 1) return 'amanhã'
  if (n === -1) return 'ontem'
  return n > 0 ? `em ${n} dias` : `há ${-n} dias`
}
