import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Categoria, type Modo } from '../db'
import { Campo, Folha, Opcoes } from '../componentes/ui'
import { CORES } from '../componentes/SeletorCategoria'

/** Lista de categorias com adicionar, editar e arquivar. */
export function Categorias() {
  const [modo, setModo] = useState<Modo>('pessoal')
  const [editando, setEditando] = useState<Categoria | null>(null)
  const [verArquivadas, setVerArquivadas] = useState(false)
  const categorias = useLiveQuery(() => db.categorias.where({ modo }).sortBy('ordem'), [modo], [])
  const ativas = categorias.filter((c) => !c.arquivada)
  const arquivadas = categorias.filter((c) => c.arquivada)

  async function alternarArquivo(c: Categoria) {
    await db.categorias.update(c.id!, { arquivada: c.arquivada ? 0 : 1 })
  }

  return (
    <section className="bloco">
      <h2>Categorias</h2>
      <Opcoes rotulo="Modo" opcoes={[{ valor: 'pessoal' as Modo, rotulo: 'Pessoal' }, { valor: 'empresa' as Modo, rotulo: 'Empresa' }]} valor={modo} aoMudar={setModo} />
      <div className="lista">
        {ativas.map((c) => (
          <div key={c.id} className="item item-estatico">
            <span className="item-icone" style={{ background: `${c.cor}22` }}>{c.icone}</span>
            <span className="item-texto"><strong>{c.nome}</strong></span>
            <button className="botao-link" onClick={() => setEditando(c)}>Editar</button>
            <button className="botao-link texto-suave" onClick={() => alternarArquivo(c)}>Arquivar</button>
          </div>
        ))}
      </div>
      <button
        className="botao"
        onClick={() => setEditando({ modo, nome: '', icone: '🏷️', cor: CORES[0], arquivada: 0, ordem: categorias.length })}
      >
        + Nova categoria
      </button>
      {arquivadas.length > 0 && (
        <>
          <button className="botao-link" onClick={() => setVerArquivadas(!verArquivadas)}>
            {verArquivadas ? 'Esconder' : 'Ver'} arquivadas ({arquivadas.length})
          </button>
          {verArquivadas && (
            <div className="lista">
              {arquivadas.map((c) => (
                <div key={c.id} className="item item-estatico arquivada">
                  <span className="item-icone">{c.icone}</span>
                  <span className="item-texto"><strong>{c.nome}</strong></span>
                  <button className="botao-link" onClick={() => alternarArquivo(c)}>Reativar</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <p className="texto-suave">Arquivar tira a categoria das opções, mas os gastos antigos continuam com ela.</p>
      {editando && <FormCategoria categoria={editando} aoFechar={() => setEditando(null)} />}
    </section>
  )
}

function FormCategoria({ categoria, aoFechar }: { categoria: Categoria; aoFechar: () => void }) {
  const [nome, setNome] = useState(categoria.nome)
  const [icone, setIcone] = useState(categoria.icone)
  const [cor, setCor] = useState(categoria.cor)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!nome.trim()) return setErro('Dê um nome para a categoria.')
    await db.categorias.put({ ...categoria, nome: nome.trim(), icone: icone.trim() || '🏷️', cor })
    aoFechar()
  }

  return (
    <Folha titulo={categoria.id ? 'Editar categoria' : 'Nova categoria'} aoFechar={aoFechar}>
      <div className="linha-campos">
        <Campo rotulo="Ícone">
          <input className="entrada-icone" value={icone} onChange={(e) => setIcone(e.target.value)} maxLength={4} />
        </Campo>
        <Campo rotulo="Nome">
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={24} autoFocus={!categoria.id} />
        </Campo>
      </div>
      <Campo rotulo="Cor">
        <div className="cores">
          {CORES.map((c) => (
            <button key={c} type="button" className={`cor ${cor === c ? 'ativa' : ''}`} style={{ background: c }} onClick={() => setCor(c)} aria-label={`Cor ${c}`} />
          ))}
        </div>
      </Campo>
      <p className="texto-suave">Dica: no celular, use o teclado de emojis para escolher o ícone.</p>
      {erro && <p className="aviso aviso-erro">{erro}</p>}
      <button className="botao botao-principal" onClick={salvar}>Salvar</button>
    </Folha>
  )
}
