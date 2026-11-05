import { db, TABELAS, salvarConfig, lerConfig } from './db'

const ASSINATURA = 'meu-financeiro'
const VERSAO = 1

export interface ArquivoBackup {
  app: string
  versao: number
  exportadoEm: string
  dados: Record<string, unknown[]>
}

export async function exportarBackup(): Promise<void> {
  const dados: Record<string, unknown[]> = {}
  for (const nome of TABELAS) dados[nome] = await db.table(nome).toArray()
  const agora = new Date()
  const arquivo: ArquivoBackup = { app: ASSINATURA, versao: VERSAO, exportadoEm: agora.toISOString(), dados }
  const blob = new Blob([JSON.stringify(arquivo, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `meu-financeiro-backup-${agora.toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  await salvarConfig('ultimoBackup', agora.toISOString())
}

/** Lê e valida o arquivo, sem gravar nada ainda. */
export async function lerBackup(arquivo: File): Promise<ArquivoBackup> {
  let conteudo: ArquivoBackup
  try {
    conteudo = JSON.parse(await arquivo.text())
  } catch {
    throw new Error('Esse arquivo não é um backup válido.')
  }
  if (conteudo?.app !== ASSINATURA || typeof conteudo.dados !== 'object' || conteudo.dados === null) {
    throw new Error('Esse arquivo não é um backup do Meu Financeiro.')
  }
  if (conteudo.versao > VERSAO) {
    throw new Error('Esse backup é de uma versão mais nova do app. Atualize o app antes.')
  }
  return conteudo
}

export function contarRegistros(backup: ArquivoBackup): number {
  return Object.entries(backup.dados)
    .filter(([nome]) => nome !== 'config')
    .reduce((total, [, linhas]) => total + (Array.isArray(linhas) ? linhas.length : 0), 0)
}

/** Substitui todos os dados do app pelos do backup. */
export async function restaurarBackup(backup: ArquivoBackup): Promise<void> {
  const tabelas = TABELAS.map((n) => db.table(n))
  await db.transaction('rw', tabelas, async () => {
    for (const nome of TABELAS) {
      const tabela = db.table(nome)
      await tabela.clear()
      const linhas = backup.dados[nome]
      if (Array.isArray(linhas) && linhas.length) await tabela.bulkAdd(linhas)
    }
  })
  await salvarConfig('ultimoBackup', backup.exportadoEm)
}

/** true se já existe algum dado lançado e faz mais de 30 dias do último backup (ou nunca houve). */
export async function precisaDeBackup(): Promise<boolean> {
  const ultimo = await lerConfig<string | null>('ultimoBackup', null)
  const total =
    (await db.gastos.count()) + (await db.contas.count()) + (await db.cartoes.count()) +
    (await db.plataformas.count()) + (await db.gastosEmpresa.count())
  if (total === 0) return false
  // Sem backup ainda: conta 30 dias a partir da instalação do app.
  const referencia = ultimo ?? (await lerConfig<string | null>('dadosIniciais', null))
  if (!referencia) return true
  return (Date.now() - new Date(referencia).getTime()) / 86_400_000 > 30
}

/** Pede ao navegador para não apagar os dados quando faltar espaço. */
export async function pedirArmazenamentoPersistente(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}
