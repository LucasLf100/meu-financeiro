import { useEffect, useState, type CSSProperties } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Modo } from '../db'

export const CORES = ['#f97316', '#ef4444', '#ec4899', '#d946ef', '#a855f7', '#6366f1', '#0ea5e9', '#14b8a6', '#16a34a', '#65a30d', '#a16207', '#64748b']

/** Grade de categorias, ordenadas pelas mais usadas, com criação rápida. */
export function SeletorCategoria({ modo, valor, aoMudar }: { modo: Modo; valor?: number; aoMudar: (id: number) => void }) {
  const categorias = useLiveQuery(
    async () => {
      const lista = await db.categorias.where({ modo, arquivada: 0 }).toArray()
      const tabela = modo === 'pessoal' ? db.gastos : db.gastosEmpresa
      const uso = new Map<number, number>()
      await tabela.each((g) => uso.set(g.categoriaId, (uso.get(g.categoriaId) ?? 0) + 1))
      return lista.sort((a, b) => (uso.get(b.id!) ?? 0) - (uso.get(a.id!) ?? 0) || a.ordem - b.ordem)
    },
    [modo],
    [],
  )
  const [criando, setCriando] = useState(false)
  const [nome, setNome] = useState('')
  const [icone, setIcone] = useState('🏷️')

  // Se nada foi escolhido, já seleciona a mais usada.
  useEffect(() => {
    if (valor === undefined && categorias.length) aoMudar(categorias[0].id!)
  }, [valor, categorias, aoMudar])

  async function criar() {
    const limpo = nome.trim()
    if (!limpo) return
    const id = await db.categorias.add({
      modo,
      nome: limpo,
      icone: icone.trim() || '🏷️',
      cor: CORES[Math.floor(Math.random() * CORES.length)],
      arquivada: 0,
      ordem: 999,
    })
    aoMudar(id as number)
    setCriando(false)
    setNome('')
    setIcone('🏷️')
  }

  return (
    <div>
      <div className="grade-categorias">
        {categorias.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`categoria ${valor === c.id ? 'ativa' : ''}`}
            style={{ '--cor': c.cor } as CSSProperties}
            onClick={() => aoMudar(c.id!)}
            aria-pressed={valor === c.id}
          >
            <span className="categoria-icone">{c.icone}</span>
            <span className="categoria-nome">{c.nome}</span>
          </button>
        ))}
        <button type="button" className="categoria nova" onClick={() => setCriando(true)}>
          <span className="categoria-icone">＋</span>
          <span className="categoria-nome">Nova</span>
        </button>
      </div>
      {criando && (
        <div className="linha-campos nova-categoria">
          <input className="entrada-icone" value={icone} onChange={(e) => setIcone(e.target.value)} aria-label="Ícone (emoji)" maxLength={4} />
          <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da categoria" maxLength={24} onKeyDown={(e) => e.key === 'Enter' && criar()} />
          <button type="button" className="botao botao-principal botao-curto" onClick={criar}>Criar</button>
        </div>
      )}
    </div>
  )
}
