import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Retirada } from '../../db'
import { formatarReais } from '../../dinheiro'
import { formatarDia, hoje, mesAtual, mesDe } from '../../datas'
import { Vazio } from '../../componentes/ui'
import { FormRetirada } from './Formularios'

export function Retiradas() {
  const retiradas = useLiveQuery(() => db.retiradas.orderBy('data').reverse().toArray(), [], [])
  const [editando, setEditando] = useState<Retirada | 'nova' | null>(null)
  const mes = mesAtual()
  const ano = hoje().slice(0, 4)
  const doMes = retiradas.filter((r) => mesDe(r.data) === mes).reduce((s, r) => s + r.valor, 0)
  const doAno = retiradas.filter((r) => r.data.startsWith(ano)).reduce((s, r) => s + r.valor, 0)

  return (
    <div className="tela">
      <section className="bloco">
        <div className="linha-resumo">
          <div>
            <span className="rotulo texto-suave">Retirado neste mês</span>
            <strong className="valor-medio">{formatarReais(doMes)}</strong>
          </div>
          <div className="direita">
            <span className="rotulo texto-suave">Em {ano}</span>
            <strong>{formatarReais(doAno)}</strong>
          </div>
        </div>
        <p className="texto-suave">Pró-labore e outras retiradas: saem da empresa e aparecem como entrada no modo Pessoal.</p>
      </section>

      {retiradas.length === 0 && <Vazio icone="💸" titulo="Nenhuma retirada" texto="Quando a empresa começar a faturar, registre aqui o que você tirar para você." />}

      <div className="lista">
        {retiradas.map((r) => (
          <button key={r.id} className="item" onClick={() => setEditando(r)}>
            <span className="item-texto">
              <strong>{r.observacao || 'Retirada'}</strong>
              <small>{formatarDia(r.data)}</small>
            </span>
            <strong className="item-valor">{formatarReais(r.valor)}</strong>
          </button>
        ))}
      </div>

      <button className="botao" onClick={() => setEditando('nova')}>+ Nova retirada</button>
      {editando && <FormRetirada retirada={editando === 'nova' ? undefined : editando} aoFechar={() => setEditando(null)} />}
    </div>
  )
}
