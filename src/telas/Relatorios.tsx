import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { formatarReais } from '../dinheiro'
import { mesAtual, nomeMes, nomeMesCurto, somarMeses } from '../datas'
import { ocorrenciasDoMes } from '../regras/contas'
import { BarraProgresso, SeletorMes } from '../componentes/ui'

async function dadosDoMes(mes: string) {
  const [gastos, contas, parcelas] = await Promise.all([
    db.gastos.where('data').between(`${mes}-01`, `${mes}-31`, true, true).toArray(),
    ocorrenciasDoMes(mes),
    db.parcelas.where({ fatura: mes }).toArray(),
  ])
  return { gastos, contas, parcelas }
}

export function Relatorios({ aoVoltar }: { aoVoltar: () => void }) {
  const [mes, setMes] = useState(mesAtual())
  const dados = useLiveQuery(async () => {
    const [atual, anterior, categorias, todasParcelas] = await Promise.all([
      dadosDoMes(mes),
      dadosDoMes(somarMeses(mes, -1)),
      db.categorias.toArray(),
      db.parcelas.toArray(),
    ])
    return { atual, anterior, categorias, todasParcelas }
  }, [mes])

  return (
    <div className="app">
      <header className="cabecalho">
        <button className="botao-icone" onClick={aoVoltar} aria-label="Voltar">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h1 className="titulo-cabecalho">Relatórios</h1>
        <span style={{ width: 40 }} />
      </header>
      <main className="conteudo">
        {dados && <Conteudo mes={mes} setMes={setMes} {...dados} />}
      </main>
    </div>
  )
}

type Dados = Awaited<ReturnType<typeof dadosDoMes>>

function Conteudo({
  mes,
  setMes,
  atual,
  anterior,
  categorias,
  todasParcelas,
}: {
  mes: string
  setMes: (m: string) => void
  atual: Dados
  anterior: Dados
  categorias: Array<{ id?: number; nome: string; icone: string; cor: string }>
  todasParcelas: Array<{ fatura: string; valor: number }>
}) {
  const somaPorCategoria = (d: Dados) => {
    const mapa = new Map<number, number>()
    for (const g of d.gastos) mapa.set(g.categoriaId, (mapa.get(g.categoriaId) ?? 0) + g.valor)
    for (const o of d.contas) if (o.conta.categoriaId) mapa.set(o.conta.categoriaId, (mapa.get(o.conta.categoriaId) ?? 0) + o.valor)
    return mapa
  }
  const agora = somaPorCategoria(atual)
  const antes = somaPorCategoria(anterior)
  const linhas = [...new Set([...agora.keys(), ...antes.keys()])]
    .map((id) => ({ id, valor: agora.get(id) ?? 0, antes: antes.get(id) ?? 0, categoria: categorias.find((c) => c.id === id) }))
    .filter((l) => l.valor > 0 || l.antes > 0)
    .sort((a, b) => b.valor - a.valor)
  const totalCategorias = linhas.reduce((s, l) => s + l.valor, 0)
  const totalAntes = linhas.reduce((s, l) => s + l.antes, 0)

  // Para onde foi: contas fixas + faturas do mês + gastos pagos na hora (crédito já está nas faturas).
  const contasFixas = atual.contas.reduce((s, o) => s + o.valor, 0)
  const faturas = atual.parcelas.reduce((s, p) => s + p.valor, 0)
  const aVista = atual.gastos.filter((g) => g.forma !== 'credito').reduce((s, g) => s + g.valor, 0)
  const totalDestino = contasFixas + faturas + aVista

  // Parcelas já comprometidas nos próximos 6 meses.
  const proximos = Array.from({ length: 6 }, (_, i) => {
    const m = somarMeses(mesAtual(), i)
    return { mes: m, valor: todasParcelas.filter((p) => p.fatura === m).reduce((s, p) => s + p.valor, 0) }
  })
  const maiorProximo = Math.max(1, ...proximos.map((p) => p.valor))

  return (
    <div className="tela">
      <SeletorMes mes={mes} aoMudar={setMes} />

      <section className="bloco">
        <h2>Para onde foi o dinheiro</h2>
        <strong className="valor-medio">{formatarReais(totalDestino)}</strong>
        {[
          ['Contas fixas', contasFixas],
          ['Faturas de cartão', faturas],
          ['Gastos pagos na hora', aVista],
        ].map(([rotulo, valor]) => (
          <div key={rotulo as string} className="linha-categoria">
            <span>{rotulo}</span>
            <strong>{formatarReais(valor as number)}</strong>
            <BarraProgresso valor={valor as number} total={totalDestino} />
          </div>
        ))}
        <small className="texto-suave">Compras no crédito entram pela fatura do mês em que vencem.</small>
      </section>

      <section className="bloco">
        <div className="linha-resumo">
          <h2>Por categoria</h2>
          <Variacao agora={totalCategorias} antes={totalAntes} />
        </div>
        <small className="texto-suave">Gastos avulsos + contas fixas, comparando com {nomeMes(somarMeses(mes, -1))}.</small>
        {linhas.length === 0 && <p className="texto-suave">Nada lançado neste mês.</p>}
        {linhas.map((l) => (
          <div key={l.id} className="linha-categoria">
            <span>{l.categoria?.icone} {l.categoria?.nome ?? 'Sem categoria'}</span>
            <span className="valor-com-variacao">
              <strong>{formatarReais(l.valor)}</strong>
              <Variacao agora={l.valor} antes={l.antes} />
            </span>
            <BarraProgresso valor={l.valor} total={totalCategorias} />
          </div>
        ))}
      </section>

      <section className="bloco">
        <h2>Parcelas já comprometidas</h2>
        <div className="grafico" role="img" aria-label="Parcelas de cartão nos próximos 6 meses">
          {proximos.map((p, i) => (
            <div key={p.mes} className={`grafico-coluna ${i === 0 ? 'atual' : ''}`}>
              <small>{p.valor ? formatarReais(p.valor).replace(/,\d\d$/, '') : ''}</small>
              <div className="grafico-barra" style={{ height: `${Math.max(2, (p.valor / maiorProximo) * 100)}%` }} />
              <span>{nomeMesCurto(p.mes)}</span>
            </div>
          ))}
        </div>
        <small className="texto-suave">Quanto das próximas faturas já está comprometido com compras parceladas.</small>
      </section>
    </div>
  )
}

function Variacao({ agora, antes }: { agora: number; antes: number }) {
  if (!antes) return null
  const pct = Math.round(((agora - antes) / antes) * 100)
  if (pct === 0) return <small className="variacao">=</small>
  // Gastar mais é ruim (vermelho); gastar menos é bom (verde).
  return <small className={`variacao ${pct > 0 ? 'texto-perigo' : 'texto-ok'}`}>{pct > 0 ? '▲' : '▼'} {Math.abs(pct)}%</small>
}
