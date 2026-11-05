import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Cobranca, type Plataforma } from '../../db'
import { formatarReais } from '../../dinheiro'
import { diasAte, formatarDia, mesAtual, mesDe, prazo } from '../../datas'
import { antecedenciaAviso, emReais, lerCotacao, plataformaConta } from '../../regras/empresa'
import { Etiqueta, Vazio } from '../../componentes/ui'
import { descreverCobranca } from './comum'
import { FormPagamento } from './Formularios'
import { DetalhePlataforma } from './Plataformas'

type ComPlataforma = { cobranca: Cobranca & { id: number }; plataforma: Plataforma }

export function Cobrancas() {
  const [pagando, setPagando] = useState<ComPlataforma | null>(null)
  const [aberta, setAberta] = useState<number | null>(null)
  const dados = useLiveQuery(async () => {
    const [cobrancas, plataformas, pagamentos, cotacao] = await Promise.all([
      db.cobrancas.toArray(),
      db.plataformas.toArray(),
      db.pagamentosCobranca.toArray(),
      lerCotacao(),
    ])
    return { cobrancas, plataformas, pagamentos, cotacao }
  })

  if (!dados) return null
  const { cobrancas, plataformas, pagamentos, cotacao } = dados
  const mes = mesAtual()

  const itens: ComPlataforma[] = cobrancas
    .map((c) => ({ cobranca: c as Cobranca & { id: number }, plataforma: plataformas.find((p) => p.id === c.plataformaId)! }))
    .filter((x) => plataformaConta(x.plataforma) && x.cobranca.tipo !== 'gratis')

  const recorrentes = itens
    .filter((x) => x.cobranca.tipo === 'mensal' || x.cobranca.tipo === 'anual')
    .sort((a, b) => (a.cobranca.proximaRenovacao ?? '9999').localeCompare(b.cobranca.proximaRenovacao ?? '9999'))
  const porUso = itens.filter((x) => x.cobranca.tipo === 'uso')
  const unicas = itens.filter((x) => x.cobranca.tipo === 'unica')
  const pagosNoMes = (id: number) => pagamentos.filter((p) => p.cobrancaId === id && mesDe(p.pagoEm) === mes).reduce((s, p) => s + p.valor, 0)
  const jaPaga = (id: number) => pagamentos.some((p) => p.cobrancaId === id)

  if (itens.length === 0) {
    return (
      <div className="tela">
        <Vazio icone="🔁" titulo="Nenhuma cobrança" texto="As cobranças das plataformas ativas ou em teste aparecem aqui. Cadastre na aba Plataformas." />
      </div>
    )
  }

  return (
    <div className="tela">
      {recorrentes.length > 0 && (
        <section className="grupo">
          <h3 className="grupo-titulo"><span>Recorrentes</span></h3>
          <div className="lista">
            {recorrentes.map(({ cobranca: c, plataforma: p }) => {
              const dias = c.proximaRenovacao ? diasAte(c.proximaRenovacao) : null
              const alerta = dias !== null && dias <= antecedenciaAviso(c)
              return (
                <div key={c.id} className="item">
                  <button className="item-texto botao-limpo" onClick={() => setAberta(p.id!)}>
                    <strong>{p.nome}</strong>
                    <small className={alerta && dias! < 0 ? 'texto-perigo' : ''}>
                      {c.proximaRenovacao ? `${formatarDia(c.proximaRenovacao)} · ${prazo(c.proximaRenovacao)}` : 'sem data'} · {c.renovacaoAutomatica ? 'automática' : 'manual'}
                    </small>
                  </button>
                  <span className="item-direita">
                    <strong className="item-valor">{descreverCobranca(c).replace(' por mês', '/mês').replace(' por ano', '/ano')}</strong>
                    {alerta ? (
                      <button className="botao-link" onClick={() => setPagando({ cobranca: c, plataforma: p })}>{c.renovacaoAutomatica ? 'Registrar' : 'Renovar'}</button>
                    ) : !c.renovacaoAutomatica ? (
                      <Etiqueta tipo="alerta">Manual</Etiqueta>
                    ) : null}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {porUso.length > 0 && (
        <section className="grupo">
          <h3 className="grupo-titulo"><span>Por uso</span></h3>
          <div className="lista">
            {porUso.map(({ cobranca: c, plataforma: p }) => {
              const doMes = pagosNoMes(c.id)
              const limite = c.limiteEsperado ? emReais(c.limiteEsperado, c.moeda, cotacao) : 0
              return (
                <div key={c.id} className="item">
                  <button className="item-texto botao-limpo" onClick={() => setAberta(p.id!)}>
                    <strong>{p.nome}</strong>
                    <small className={limite && doMes > limite ? 'texto-perigo' : ''}>
                      Neste mês: {formatarReais(doMes)}{limite ? ` de ${formatarReais(limite)}` : ''}
                    </small>
                  </button>
                  <button className="botao-link" onClick={() => setPagando({ cobranca: c, plataforma: p })}>Lançar fatura</button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {unicas.length > 0 && (
        <section className="grupo">
          <h3 className="grupo-titulo"><span>Únicas</span></h3>
          <div className="lista">
            {unicas.map(({ cobranca: c, plataforma: p }) => (
              <div key={c.id} className="item">
                <button className="item-texto botao-limpo" onClick={() => setAberta(p.id!)}>
                  <strong>{p.nome}</strong>
                  <small>{descreverCobranca(c)}</small>
                </button>
                {jaPaga(c.id) ? <Etiqueta tipo="ok">Paga</Etiqueta> : <button className="botao-link" onClick={() => setPagando({ cobranca: c, plataforma: p })}>Pagar</button>}
              </div>
            ))}
          </div>
        </section>
      )}

      {pagando && <FormPagamento cobranca={pagando.cobranca} nome={pagando.plataforma.nome} aoFechar={() => setPagando(null)} />}
      {aberta !== null && <DetalhePlataforma id={aberta} aoFechar={() => setAberta(null)} />}
    </div>
  )
}
