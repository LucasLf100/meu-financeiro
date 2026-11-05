import { db, type Categoria, type Modo } from './db'

const PESSOAL: Array<[string, string, string]> = [
  ['Alimentação', '🍽️', '#f97316'],
  ['Mercado', '🛒', '#65a30d'],
  ['Transporte', '🚗', '#0ea5e9'],
  ['Casa', '🏠', '#a16207'],
  ['Saúde', '💊', '#ef4444'],
  ['Lazer', '🎉', '#d946ef'],
  ['Roupas', '👕', '#6366f1'],
  ['Educação', '📚', '#14b8a6'],
  ['Assinaturas', '🔁', '#64748b'],
  ['Presentes', '🎁', '#ec4899'],
  ['Outros', '📦', '#94a3b8'],
]

const EMPRESA: Array<[string, string, string]> = [
  ['Hospedagem', '☁️', '#0ea5e9'],
  ['Domínio', '🌐', '#6366f1'],
  ['E-mail', '✉️', '#f59e0b'],
  ['Banco de dados', '🗄️', '#14b8a6'],
  ['IA', '🤖', '#a855f7'],
  ['Ferramentas', '🧰', '#64748b'],
  ['Impostos e taxas', '🧾', '#ef4444'],
  ['Contador', '📊', '#0d9488'],
  ['Marketing', '📣', '#ec4899'],
  ['Equipamentos', '💻', '#475569'],
  ['Outros', '📦', '#94a3b8'],
]

function montar(modo: Modo, lista: Array<[string, string, string]>): Categoria[] {
  return lista.map(([nome, icone, cor], ordem) => ({ modo, nome, icone, cor, arquivada: 0, ordem }))
}

/** Cria as categorias na primeira vez que o app abre. A empresa começa vazia. */
export async function prepararDadosIniciais(): Promise<void> {
  await db.transaction('rw', db.categorias, db.config, async () => {
    if (await db.config.get('dadosIniciais')) return
    if ((await db.categorias.count()) === 0) {
      await db.categorias.bulkAdd([...montar('pessoal', PESSOAL), ...montar('empresa', EMPRESA)])
    }
    await db.config.put({ chave: 'dadosIniciais', valor: new Date().toISOString() })
  })
}
