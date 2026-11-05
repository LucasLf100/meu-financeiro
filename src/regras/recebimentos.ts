import { db, type Entrada, type RecebimentoFixo } from '../db'
import { diaDoMes, hoje } from '../datas'

export type StatusRecebimento = 'recebido' | 'a-receber' | 'atrasado'

export interface OcorrenciaRecebimento {
  recebimento: RecebimentoFixo & { id: number }
  data: string
  valor: number // previsto, ou o que entrou de fato
  entrada?: Entrada
  status: StatusRecebimento
}

export interface ResumoRecebimentos {
  fixos: OcorrenciaRecebimento[]
  avulsos: Entrada[]
  previsto: number // fixos (previsto ou recebido) + avulsos
  recebido: number
}

export function recebimentoValeNoMes(r: RecebimentoFixo, mes: string): boolean {
  return !!r.ativa && mes >= r.inicio && (!r.fim || mes <= r.fim)
}

export async function recebimentosDoMes(mes: string): Promise<ResumoRecebimentos> {
  const [recebimentos, entradas] = await Promise.all([db.recebimentos.toArray(), db.entradas.where({ competencia: mes }).toArray()])
  const dia = hoje()
  const fixos: OcorrenciaRecebimento[] = recebimentos
    .filter((r) => recebimentoValeNoMes(r, mes))
    .map((r) => {
      const entrada = entradas.find((e) => e.recebimentoId === r.id)
      const data = diaDoMes(mes, r.dia)
      const status: StatusRecebimento = entrada ? 'recebido' : data < dia ? 'atrasado' : 'a-receber'
      return { recebimento: r as RecebimentoFixo & { id: number }, data, valor: entrada?.valor ?? r.valor, entrada, status }
    })
    .sort((a, b) => a.data.localeCompare(b.data))
  const avulsos = entradas.filter((e) => !e.recebimentoId).sort((a, b) => b.data.localeCompare(a.data))
  const somaAvulsos = avulsos.reduce((s, e) => s + e.valor, 0)
  return {
    fixos,
    avulsos,
    previsto: fixos.reduce((s, o) => s + o.valor, 0) + somaAvulsos,
    recebido: fixos.filter((o) => o.entrada).reduce((s, o) => s + o.valor, 0) + somaAvulsos,
  }
}

/** Encerra a partir de um mês (mantém o que já entrou); se for no primeiro mês, apaga. */
export async function encerrarRecebimento(r: RecebimentoFixo & { id: number }, aPartirDe: string, anterior: string) {
  if (aPartirDe <= r.inicio) {
    await db.transaction('rw', db.recebimentos, db.entradas, async () => {
      await db.entradas.where({ recebimentoId: r.id }).delete()
      await db.recebimentos.delete(r.id)
    })
    return
  }
  await db.recebimentos.update(r.id, { fim: anterior })
}
