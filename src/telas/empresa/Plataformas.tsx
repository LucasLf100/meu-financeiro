import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Cobranca } from '../../db'
import { formatarDolares, formatarReais } from '../../dinheiro'
import { formatarDia, prazo } from '../../datas'
import { custoMensal, lerCotacao } from '../../regras/empresa'
import { Etiqueta, Folha, Opcoes, Vazio } from '../../componentes/ui'
import { descreverCobranca, NOME_STATUS } from './comum'
import { FormCobranca, FormPagamento, FormPlataforma } from './Formularios'

export function Plataformas() {
  const [filtro, setFiltro] = useState<number>(0)
  const [aberta, setAberta] = useState<number | null>(null)
  const [nova, setNova] = useState(false)
  const dados = useLiveQuery(async () => {
    const [plataformas, produtos, cobrancas, pagamentos, cotacao] = await Promise.all([
      db.plataformas.toArray(),
      db.produtos.toArray(),
      db.cobrancas.toArray(),
      db.pagamentosCobranca.toArray(),
      lerCotacao(),
    ])
    return { plataformas, produtos, cobrancas, pagamentos, cotacao }
  })

  if (!dados) return null
  const { plataformas, produtos, cobrancas, pagamentos, cotacao } = dados
  const ordemStatus = { ativa: 0, teste: 1, planejada: 2, cancelada: 3 }
  const visiveis = plataformas
    .filter((p) => !filtro || p.produtoId === filtro)
    .sort((a, b) => ordemStatus[a.status] - ordemStatus[b.status] || a.nome.localeCompare(b.nome))

  return (
    <div className="tela">
      {produtos.length > 0 && (
        <Opcoes rotulo="Filtrar por produto" opcoes={[{ valor: 0, rotulo: 'Todos' }, ...produtos.map((p) => ({ valor: p.id!, rotulo: p.nome }))]} valor={filtro} aoMudar={setFiltro} />
      )}

      {visiveis.length === 0 && <Vazio icone="🧩" titulo="Nenhuma plataforma" texto="Cadastre hospedagem, domínio, e-mail, banco de dados…" />}

      <div className="lista">
        {visiveis.map((p) => {
          const produto = produtos.find((x) => x.id === p.produtoId)
          const suas = cobrancas.filter((c) => c.plataformaId === p.id)
          const mensal = suas.reduce((s, c) => s + custoMensal(c, pagamentos, cotacao), 0)
          const [rotulo, tipo] = NOME_STATUS[p.status]
          return (
            <button key={p.id} className="item" onClick={() => setAberta(p.id!)}>
              <span className="item-icone" style={{ background: `${produto?.cor ?? '#94a3b8'}22`, color: produto?.cor }}>{p.nome.slice(0, 1).toUpperCase()}</span>
              <span className="item-texto">
                <strong>{p.nome}</strong>
                <small>{[produto?.nome, p.descricao || suas.map(descreverCobranca).join(', ')].filter(Boolean).join(' · ')}</small>
              </span>
              <span className="item-direita">
                <strong className="item-valor">{mensal ? `${formatarReais(mensal)}/mês` : suas.some((c) => c.tipo === 'gratis') ? 'Grátis' : '—'}</strong>
                <Etiqueta tipo={tipo}>{rotulo}</Etiqueta>
              </span>
            </button>
          )
        })}
      </div>

      <button className="botao" onClick={() => setNova(true)}>+ Nova plataforma</button>

      {aberta !== null && <DetalhePlataforma id={aberta} aoFechar={() => setAberta(null)} />}
      {nova && <FormPlataforma aoFechar={() => setNova(false)} aoCriar={(id) => { setNova(false); setAberta(id) }} />}
    </div>
  )
}

export function DetalhePlataforma({ id, aoFechar }: { id: number; aoFechar: () => void }) {
  const dados = useLiveQuery(async () => {
    const plataforma = await db.plataformas.get(id)
    if (!plataforma) return { plataforma }
    const [produto, cobrancas] = await Promise.all([(plataforma.produtoId ? db.produtos.get(plataforma.produtoId) : undefined), db.cobrancas.where({ plataformaId: id }).toArray()])
    const pagamentos = await db.pagamentosCobranca.where('cobrancaId').anyOf(cobrancas.map((c) => c.id!)).reverse().sortBy('pagoEm')
    return { plataforma, produto, cobrancas, pagamentos }
  }, [id])
  const [editando, setEditando] = useState(false)
  const [cobrancaAberta, setCobrancaAberta] = useState<Cobranca | 'nova' | null>(null)
  const [pagando, setPagando] = useState<(Cobranca & { id: number }) | null>(null)

  if (!dados) return null
  const { plataforma, produto, cobrancas = [], pagamentos = [] } = dados
  if (!plataforma) {
    // Foi excluída.
    queueMicrotask(aoFechar)
    return null
  }

  if (editando) return <FormPlataforma plataforma={plataforma} aoFechar={() => setEditando(false)} />
  if (cobrancaAberta) return <FormCobranca plataformaId={id} cobranca={cobrancaAberta === 'nova' ? undefined : cobrancaAberta} aoFechar={() => setCobrancaAberta(null)} />
  if (pagando) return <FormPagamento cobranca={pagando} nome={plataforma.nome} aoFechar={() => setPagando(null)} />

  const [rotulo, tipo] = NOME_STATUS[plataforma.status]

  return (
    <Folha titulo={plataforma.nome} aoFechar={aoFechar}>
      <div className="linha-resumo">
        <span className="texto-suave">{[produto?.nome, plataforma.descricao].filter(Boolean).join(' · ')}</span>
        <Etiqueta tipo={tipo}>{rotulo}</Etiqueta>
      </div>
      <dl className="ficha">
        {plataforma.plano && (<><dt>Plano</dt><dd>{plataforma.plano}</dd></>)}
        {plataforma.emailConta && (<><dt>Conta</dt><dd>{plataforma.emailConta}</dd></>)}
        {plataforma.link && (<><dt>Painel</dt><dd><a href={plataforma.link} target="_blank" rel="noreferrer">{plataforma.link.replace(/^https?:\/\//, '')}</a></dd></>)}
      </dl>
      {plataforma.observacoes && <p className="nota">{plataforma.observacoes}</p>}

      <h3 className="subtitulo">Cobranças</h3>
      {cobrancas.length === 0 && <p className="texto-suave">Nenhuma cobrança cadastrada.</p>}
      <div className="lista">
        {cobrancas.map((c) => (
          <div key={c.id} className="item item-estatico">
            <span className="item-texto">
              <strong>{descreverCobranca(c)}</strong>
              <small>
                {c.proximaRenovacao ? `Renova ${formatarDia(c.proximaRenovacao)} (${prazo(c.proximaRenovacao)}) · ${c.renovacaoAutomatica ? 'automática' : 'manual'}` : c.tipo === 'gratis' ? 'Sem custo' : 'Sem data de renovação'}
                {c.formaPagamento ? ` · ${c.formaPagamento}` : ''}
              </small>
            </span>
            <span className="item-acoes">
              {c.tipo !== 'gratis' && <button className="botao-link" onClick={() => setPagando(c as Cobranca & { id: number })}>Pagar</button>}
              <button className="botao-link texto-suave" onClick={() => setCobrancaAberta(c)}>Editar</button>
            </span>
          </div>
        ))}
      </div>
      <button className="botao" onClick={() => setCobrancaAberta('nova')}>+ Adicionar cobrança</button>

      {pagamentos.length > 0 && (
        <>
          <h3 className="subtitulo">Pagamentos</h3>
          <div className="lista">
            {pagamentos.map((p) => (
              <div key={p.id} className="item item-estatico">
                <span className="item-texto">
                  <strong>{formatarReais(p.valor)}{p.valorOriginal ? ` (${formatarDolares(p.valorOriginal)})` : ''}</strong>
                  <small>
                    {formatarDia(p.pagoEm)}
                    {p.pagoPorMim ? (p.reembolsadoEm ? ` · reembolsado em ${formatarDia(p.reembolsadoEm)}` : ' · a reembolsar') : ''}
                    {p.comprovante ? ` · ${p.comprovante}` : ''}
                  </small>
                </span>
                <button className="botao-link texto-suave" onClick={() => db.pagamentosCobranca.delete(p.id!)} aria-label="Apagar pagamento">Apagar</button>
              </div>
            ))}
          </div>
        </>
      )}

      <button className="botao" onClick={() => setEditando(true)}>Editar plataforma</button>
    </Folha>
  )
}
