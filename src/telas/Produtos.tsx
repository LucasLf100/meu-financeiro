import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Produto } from '../db'
import { Campo, Folha } from '../componentes/ui'
import { CORES } from '../componentes/SeletorCategoria'

/** Produtos ou projetos da empresa (opcional): servem para ver o custo de cada um. */
export function Produtos() {
  const produtos = useLiveQuery(() => db.produtos.toArray(), [], [])
  const [editando, setEditando] = useState<Produto | null>(null)

  return (
    <div className="grupo">
      <span className="rotulo">Produtos ou projetos</span>
      <p className="texto-suave">Opcional. Cadastre se quiser separar o custo de cada produto ou projeto da empresa.</p>
      {produtos.length > 0 && (
        <div className="lista">
          {produtos.map((p) => (
            <button key={p.id} className="item" onClick={() => setEditando(p)}>
              <span className="item-icone" style={{ background: `${p.cor}22`, color: p.cor }}>{p.nome.slice(0, 1).toUpperCase()}</span>
              <span className="item-texto"><strong>{p.nome}</strong></span>
              <span className="botao-link">Editar</span>
            </button>
          ))}
        </div>
      )}
      <button className="botao" onClick={() => setEditando({ nome: '', cor: CORES[6] })}>+ Produto ou projeto</button>
      {editando && <FormProduto produto={editando} aoFechar={() => setEditando(null)} />}
    </div>
  )
}

function FormProduto({ produto, aoFechar }: { produto: Produto; aoFechar: () => void }) {
  const [nome, setNome] = useState(produto.nome)
  const [cor, setCor] = useState(produto.cor)
  const [erro, setErro] = useState('')
  const [excluindo, setExcluindo] = useState(false)

  async function salvar() {
    if (!nome.trim()) return setErro('Dê um nome.')
    await db.produtos.put({ ...produto, nome: nome.trim(), cor })
    aoFechar()
  }

  async function excluir() {
    if (!produto.id) return
    // O que era desse produto passa para "Geral"; nada é apagado.
    await db.transaction('rw', db.produtos, db.plataformas, db.gastosEmpresa, async () => {
      await db.plataformas.where({ produtoId: produto.id! }).modify({ produtoId: undefined })
      await db.gastosEmpresa.where({ produtoId: produto.id! }).modify({ produtoId: undefined })
      await db.produtos.delete(produto.id!)
    })
    aoFechar()
  }

  return (
    <Folha titulo={produto.id ? 'Editar produto' : 'Novo produto ou projeto'} aoFechar={aoFechar}>
      <Campo rotulo="Nome">
        <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={30} autoFocus={!produto.id} />
      </Campo>
      <Campo rotulo="Cor">
        <div className="cores">
          {CORES.map((c) => (
            <button key={c} type="button" className={`cor ${cor === c ? 'ativa' : ''}`} style={{ background: c }} onClick={() => setCor(c)} aria-label={`Cor ${c}`} />
          ))}
        </div>
      </Campo>
      {erro && <p className="aviso aviso-erro">{erro}</p>}
      <button className="botao botao-principal" onClick={salvar}>Salvar</button>
      {produto.id && !excluindo && <button className="botao botao-texto-perigo" onClick={() => setExcluindo(true)}>Excluir</button>}
      {excluindo && (
        <div className="confirmacao">
          <p>Excluir “{produto.nome}”? As plataformas e gastos dele passam para “Geral”.</p>
          <div className="linha-campos">
            <button className="botao" onClick={() => setExcluindo(false)}>Cancelar</button>
            <button className="botao botao-perigo" onClick={excluir}>Excluir</button>
          </div>
        </div>
      )}
    </Folha>
  )
}
