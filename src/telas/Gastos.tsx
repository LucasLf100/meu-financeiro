import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type FormaPagamento, type Gasto } from '../db'
import { formatarReais } from '../dinheiro'
import { mesAtual, tituloDia } from '../datas'
import { BarraProgresso, Opcoes, SeletorMes, Vazio } from '../componentes/ui'
import { FormGasto, NOME_FORMA } from './FormGasto'

type Filtro = 'todas' | FormaPagamento

export function Gastos() {
  const [mes, setMes] = useState(mesAtual())
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [editando, setEditando] = useState<Gasto | null>(null)

  const dados = useLiveQuery(
    async () => {
      const [gastos, categorias] = await Promise.all([
        db.gastos.where('data').between(`${mes}-01`, `${mes}-31`, true, true).toArray(),
        db.categorias.toArray(),
      ])
      return { gastos, categorias }
    },
    [mes],
  )

  if (!dados) return null
  const { gastos, categorias } = dados
  const categoria = (id: number) => categorias.find((c) => c.id === id)
  const total = gastos.reduce((s, g) => s + g.valor, 0)
  const filtrados = gastos.filter((g) => filtro === 'todas' || g.forma === filtro)

  const porCategoria = new Map<number, number>()
  for (const g of gastos) porCategoria.set(g.categoriaId, (porCategoria.get(g.categoriaId) ?? 0) + g.valor)
  const top = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)

  const porDia = new Map<string, Gasto[]>()
  for (const g of [...filtrados].sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm))) {
    porDia.set(g.data, [...(porDia.get(g.data) ?? []), g])
  }

  return (
    <div className="tela">
      <SeletorMes mes={mes} aoMudar={setMes} />

      <section className="bloco">
        <span className="rotulo texto-suave">Gastos fora das contas fixas</span>
        <strong className="valor-medio">{formatarReais(total)}</strong>
        <small className="texto-suave">Os gastos aparecem no mês em que foram feitos. Compras no crédito também entram na fatura do cartão (veja em Contas ou Cartões).</small>
        {top.map(([id, valor]) => {
          const c = categoria(id)
          return (
            <div key={id} className="linha-categoria">
              <span>{c?.icone} {c?.nome ?? 'Sem categoria'}</span>
              <strong>{formatarReais(valor)}</strong>
              <BarraProgresso valor={valor} total={total} />
            </div>
          )
        })}
      </section>

      <Opcoes
        rotulo="Filtrar por forma de pagamento"
        opcoes={[{ valor: 'todas' as Filtro, rotulo: 'Todas' }, ...(['debito', 'pix', 'dinheiro', 'credito'] as const).map((f) => ({ valor: f as Filtro, rotulo: NOME_FORMA[f] }))]}
        valor={filtro}
        aoMudar={setFiltro}
      />

      {filtrados.length === 0 && <Vazio icone="🧾" titulo="Nenhum gasto" texto="Toque no + para lançar um gasto." />}

      {[...porDia.entries()].map(([dia, itens]) => (
        <section key={dia} className="grupo">
          <h3 className="grupo-titulo">
            <span>{tituloDia(dia)}</span>
            <span>{formatarReais(itens.reduce((s, g) => s + g.valor, 0))}</span>
          </h3>
          <div className="lista">
            {itens.map((g) => {
              const c = categoria(g.categoriaId)
              return (
                <button key={g.id} className="item" onClick={() => setEditando(g)}>
                  <span className="item-icone" style={{ background: `${c?.cor ?? '#94a3b8'}22` }}>{c?.icone ?? '📦'}</span>
                  <span className="item-texto">
                    <strong>{g.descricao}</strong>
                    <small>
                      {c?.nome} · {NOME_FORMA[g.forma]}
                      {g.forma === 'credito' && g.parcelas && g.parcelas > 1 ? ` · ${g.parcelas}x` : ''}
                    </small>
                  </span>
                  <strong className="item-valor">{formatarReais(g.valor)}</strong>
                </button>
              )
            })}
          </div>
        </section>
      ))}

      {editando && <FormGasto gasto={editando} aoFechar={() => setEditando(null)} />}
    </div>
  )
}
