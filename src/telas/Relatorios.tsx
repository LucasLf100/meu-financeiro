import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Categoria } from '../db'
import { formatarReais } from '../dinheiro'
import { mesAtual, nomeMes, nomeMesCurto, somarMeses } from '../datas'
import { contaValeNoMes, infoForma } from '../regras/contas'
import { calcularMes, ESPECIAIS, type MesRelatorio } from '../regras/relatorio'
import { BarraProgresso, SeletorMes } from '../componentes/ui'

/** Parcelas já comprometidas nos próximos meses: cartão (faturas não pagas) + contas com número de parcelas. */
async function comprometidoNosProximos(meses: number) {
  const [parcelas, pagamentos, contas] = await Promise.all([db.parcelas.toArray(), db.pagamentosFatura.toArray(), db.contas.toArray()])
  const pagas = new Set(pagamentos.map((p) => `${p.cartaoId}|${p.fatura}`))
  return Array.from({ length: meses }, (_, i) => {
    const m = somarMeses(mesAtual(), i + 1)
    const cartao = parcelas.filter((p) => p.fatura === m && !pagas.has(`${p.cartaoId}|${m}`)).reduce((s, p) => s + p.valor, 0)
    const financiamentos = contas.filter((c) => c.totalParcelas && contaValeNoMes(c, m)).reduce((s, c) => s + c.valor, 0)
    return { mes: m, cartao, financiamentos, total: cartao + financiamentos }
  })
}

export function Relatorios({ aoVoltar }: { aoVoltar: () => void }) {
  const [mes, setMes] = useState(mesAtual())
  const dados = useLiveQuery(async () => {
    const [atual, anterior, categorias, proximos] = await Promise.all([
      calcularMes(mes),
      calcularMes(somarMeses(mes, -1)),
      db.categorias.toArray(),
      comprometidoNosProximos(6),
    ])
    return { atual, anterior, categorias, proximos }
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
        <div className="tela">
          <SeletorMes mes={mes} aoMudar={setMes} />
          {dados && <Conteudo mes={mes} {...dados} />}
        </div>
      </main>
    </div>
  )
}

function Conteudo({
  mes,
  atual,
  anterior,
  categorias,
  proximos,
}: {
  mes: string
  atual: MesRelatorio
  anterior: MesRelatorio
  categorias: Categoria[]
  proximos: Awaited<ReturnType<typeof comprometidoNosProximos>>
}) {
  const sobra = atual.entradas - atual.saidas

  const nomeCategoria = (chave: number | string) => {
    if (typeof chave === 'string') return ESPECIAIS[chave]
    const c = categorias.find((x) => x.id === chave)
    return c ? { nome: c.nome, icone: c.icone } : ESPECIAIS.semCategoria
  }
  const linhasCategoria = [...new Set([...atual.porCategoria.keys(), ...anterior.porCategoria.keys()])]
    .map((chave) => ({ chave, valor: atual.porCategoria.get(chave) ?? 0, antes: anterior.porCategoria.get(chave) ?? 0, ...nomeCategoria(chave) }))
    .filter((l) => l.valor > 0)
    .sort((a, b) => b.valor - a.valor)

  const formas = [...atual.porForma.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const maiorProximo = Math.max(1, ...proximos.map((p) => p.total))

  if (atual.saidas === 0 && atual.entradas === 0) {
    return <p className="texto-suave centro">Nada lançado em {nomeMes(mes)}.</p>
  }

  return (
    <>
      <section className="bloco">
        <h2>Entradas × saídas</h2>
        <div className="linha-resumo">
          <span>Entrou</span>
          <strong className="texto-ok">{formatarReais(atual.entradas)}</strong>
        </div>
        <div className="linha-resumo">
          <span>Saiu</span>
          <strong className="texto-perigo">{formatarReais(atual.saidas)}</strong>
        </div>
        <div className="linha-resumo">
          <strong>{sobra >= 0 ? 'Sobrou' : 'Faltou'}</strong>
          <strong className={sobra >= 0 ? 'texto-ok' : 'texto-perigo'}>{formatarReais(Math.abs(sobra))}</strong>
        </div>
        {atual.entradas === 0 && <small className="texto-suave">Cadastre o salário em Contas → A receber para ver a sobra.</small>}
      </section>

      <section className="bloco">
        <div className="linha-resumo">
          <h2>Para onde foi o dinheiro</h2>
          <Variacao agora={atual.saidas} antes={anterior.saidas} />
        </div>
        <strong className="valor-medio">{formatarReais(atual.saidas)}</strong>
        {(
          [
            ['Contas fixas', atual.contasFixas],
            ['Faturas de cartão (compras e parcelas)', atual.faturas],
            ['Gastos pagos na hora', atual.aVista],
            ['Empresa, do meu bolso', atual.empresa],
          ] as const
        )
          .filter(([, v]) => v > 0)
          .map(([rotulo, valor]) => (
            <div key={rotulo} className="linha-categoria">
              <span>{rotulo}</span>
              <strong>{formatarReais(valor)}</strong>
              <BarraProgresso valor={valor} total={atual.saidas} />
            </div>
          ))}
        <small className="texto-suave">
          Compras no crédito entram pela fatura do mês em que vencem. Fatura paga vale pelo valor pago. Assinaturas do cartão contam em “Contas fixas”.
        </small>
      </section>

      <section className="bloco">
        <h2>Por categoria</h2>
        <small className="texto-suave">Comparando com {nomeMes(somarMeses(mes, -1))}.</small>
        {linhasCategoria.map((l) => (
          <div key={String(l.chave)} className="linha-categoria">
            <span>{l.icone} {l.nome}</span>
            <span className="valor-com-variacao">
              <strong>{formatarReais(l.valor)}</strong>
              <Variacao agora={l.valor} antes={l.antes} />
            </span>
            <BarraProgresso valor={l.valor} total={atual.saidas} />
          </div>
        ))}
      </section>

      {formas.length > 0 && (
        <section className="bloco">
          <h2>Como você pagou</h2>
          {formas.map(([forma, valor]) => {
            const info = forma === 'indefinida' ? { icone: '🔀', rotulo: 'A definir (escolho ao pagar)' } : infoForma(forma)
            return (
              <div key={forma} className="linha-categoria">
                <span>{info?.icone} {info?.rotulo}</span>
                <strong>{formatarReais(valor)}</strong>
                <BarraProgresso valor={valor} total={atual.saidas - atual.empresa} />
              </div>
            )
          })}
        </section>
      )}

      <section className="bloco">
        <h2>Parcelas já comprometidas</h2>
        <div className="grafico" role="img" aria-label="Parcelas dos próximos 6 meses">
          {proximos.map((p) => (
            <div key={p.mes} className="grafico-coluna">
              <small>{p.total ? formatarReais(p.total).replace(/,\d\d$/, '') : ''}</small>
              <div className="grafico-barra" style={{ height: `${Math.max(2, (p.total / maiorProximo) * 100)}%` }} />
              <span>{nomeMesCurto(p.mes)}</span>
            </div>
          ))}
        </div>
        <small className="texto-suave">
          Próximos 6 meses: parcelas do cartão ainda não pagas + contas com número de parcelas (carro, moto, financiamentos).
        </small>
      </section>
    </>
  )
}

function Variacao({ agora, antes }: { agora: number; antes: number }) {
  if (!antes) return null
  const pct = Math.round(((agora - antes) / antes) * 100)
  if (pct === 0) return <small className="variacao">=</small>
  // Gastar mais é ruim (vermelho); gastar menos é bom (verde).
  return <small className={`variacao ${pct > 0 ? 'texto-perigo' : 'texto-ok'}`}>{pct > 0 ? '▲' : '▼'} {Math.abs(pct)}%</small>
}
