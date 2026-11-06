import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type GastoEmpresa } from '../../db'
import { formatarReais } from '../../dinheiro'
import { formatarDiaCurto, mesAtual, nomeMes, prazo } from '../../datas'
import { ORIGENS, saidasEmpresaDoMes, type SaidaAPagar, type SaidaPaga } from '../../regras/empresaMes'
import { Etiqueta, Opcoes, SeletorMes, Vazio } from '../../componentes/ui'
import { FormGastoEmpresa, FormPagamento } from './Formularios'
import { DetalhePlataforma } from './Plataformas'

export function MarcaOrigem({ item }: { item: Pick<SaidaPaga, 'origem' | 'reembolsadoEm'> }) {
  const o = ORIGENS.find((x) => x.valor === item.origem)!
  const reembolso = item.origem === 'bolso' || item.origem === 'cartao-pessoal'
  return (
    <span className="marca-origem">
      {o.icone} {o.rotulo}
      {reembolso ? (item.reembolsadoEm ? ' · reembolsado' : ' · a reembolsar') : ''}
    </span>
  )
}

export function Saidas() {
  const [mes, setMes] = useState(mesAtual())
  const [lado, setLado] = useState<'apagar' | 'pagas'>('apagar')
  const dados = useLiveQuery(async () => {
    const [saidas, categorias] = await Promise.all([saidasEmpresaDoMes(mes), db.categorias.where({ modo: 'empresa' }).toArray()])
    return { ...saidas, categorias }
  }, [mes])
  const [pagando, setPagando] = useState<SaidaAPagar | null>(null)
  const [gasto, setGasto] = useState<GastoEmpresa | 'novo' | null>(null)
  const [plataforma, setPlataforma] = useState<number | null>(null)

  if (!dados) return null
  const { aPagar, pagas, totalAPagar, totalPago, categorias } = dados

  function abrirPaga(p: SaidaPaga) {
    if (p.gasto) setGasto(p.gasto)
    else if (p.pagamento) {
      db.cobrancas.get(p.pagamento.cobrancaId).then((c) => c && setPlataforma(c.plataformaId))
    }
  }

  return (
    <div className="tela">
      <SeletorMes mes={mes} aoMudar={setMes} />

      <section className="cartao-destaque cartao-saidas">
        <span className="rotulo">Saídas de {nomeMes(mes)}</span>
        <strong className="valor-grande">{formatarReais(totalPago + totalAPagar)}</strong>
        <div className="divisao">
          <div>
            <span className="rotulo">Já pago</span>
            <strong>{formatarReais(totalPago)}</strong>
          </div>
          <div>
            <span className="rotulo">A pagar</span>
            <strong>{formatarReais(totalAPagar)}</strong>
          </div>
        </div>
      </section>

      <Opcoes
        rotulo="Mostrar"
        opcoes={[
          { valor: 'apagar' as const, rotulo: `A pagar (${aPagar.length})` },
          { valor: 'pagas' as const, rotulo: `Pagas (${pagas.length})` },
        ]}
        valor={lado}
        aoMudar={setLado}
      />

      {lado === 'apagar' && (
        aPagar.length === 0 ? (
          <Vazio icone="✅" titulo="Nada a pagar neste mês" texto="Renovações de plataformas aparecem aqui no mês em que vencem." />
        ) : (
          <div className="lista">
            {aPagar.map((s) => (
              <div key={s.cobranca.id} className="item item-estatico">
                <button className="item-texto botao-sem-estilo" onClick={() => setPlataforma(s.plataforma.id!)}>
                  <strong>{s.plataforma.nome}</strong>
                  <small className={s.atrasada ? 'texto-perigo' : ''}>
                    {formatarDiaCurto(s.data)} · {prazo(s.data)} · {s.cobranca.tipo === 'anual' ? 'anual' : 'mensal'}
                  </small>
                </button>
                <span className="item-direita">
                  <strong className="item-valor">{formatarReais(s.valorReais)}</strong>
                  {s.atrasada ? <Etiqueta tipo="perigo">Venceu</Etiqueta> : null}
                  <button className="botao-link" onClick={() => setPagando(s)}>Paguei</button>
                </span>
              </div>
            ))}
          </div>
        )
      )}

      {lado === 'pagas' && (
        pagas.length === 0 ? (
          <Vazio icone="🧾" titulo="Nada pago neste mês" texto="Pagamentos de plataformas e gastos avulsos da empresa aparecem aqui." />
        ) : (
          <div className="lista">
            {pagas.map((p) => {
              const c = p.gasto ? categorias.find((x) => x.id === p.gasto!.categoriaId) : undefined
              return (
                <button key={`${p.tipo}-${p.id}`} className="item" onClick={() => abrirPaga(p)}>
                  <span className="item-icone" style={{ background: `${c?.cor ?? '#64748b'}22` }}>{p.gasto ? c?.icone ?? '📦' : '🔁'}</span>
                  <span className="item-texto">
                    <strong>{p.descricao}</strong>
                    <small>{formatarDiaCurto(p.data)} · <MarcaOrigem item={p} /></small>
                  </span>
                  <strong className="item-valor">{formatarReais(p.valor)}</strong>
                </button>
              )
            })}
          </div>
        )
      )}

      <button className="botao" onClick={() => setGasto('novo')}>+ Gasto da empresa</button>

      {pagando && <FormPagamento cobranca={pagando.cobranca} nome={pagando.plataforma.nome} aoFechar={() => setPagando(null)} />}
      {gasto && <FormGastoEmpresa gasto={gasto === 'novo' ? undefined : gasto} aoFechar={() => setGasto(null)} />}
      {plataforma !== null && <DetalhePlataforma id={plataforma} aoFechar={() => setPlataforma(null)} />}
    </div>
  )
}
