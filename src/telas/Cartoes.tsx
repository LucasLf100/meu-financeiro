import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Cartao } from '../db'
import { formatarReais, lerValor } from '../dinheiro'
import { formatarDia, formatarDiaCurto, hoje, nomeMes } from '../datas'
import { datasDaFatura, faturaAberta, limiteUsado, listarFaturas, recalcularFaturasDoCartao, statusFatura, type StatusFatura } from '../regras/cartoes'
import { BarraProgresso, Campo, Etiqueta, Folha, SeletorMes, Vazio, valorParaTexto, mascararValor } from '../componentes/ui'
import { CORES } from '../componentes/SeletorCategoria'

export function Cartoes() {
  const dados = useLiveQuery(async () => ({ cartoes: await db.cartoes.where({ ativo: 1 }).toArray(), faturas: await listarFaturas() }))
  const [aberto, setAberto] = useState<Cartao | null>(null)
  const [novo, setNovo] = useState(false)

  if (!dados) return null
  const { cartoes, faturas } = dados

  return (
    <div className="tela">
      {cartoes.length === 0 && <Vazio icone="💳" titulo="Nenhum cartão" texto="Cadastre seus cartões para lançar compras no crédito e acompanhar as faturas." />}

      {cartoes.map((cartao) => {
        const ref = faturaAberta(cartao)
        const atual = faturas.find((f) => f.cartao.id === cartao.id && f.fatura === ref)
        const usado = limiteUsado(cartao, faturas)
        const disponivel = cartao.limite - usado
        return (
          <button key={cartao.id} className="cartao-credito" style={{ background: `linear-gradient(135deg, ${cartao.cor}, ${cartao.cor}cc)` }} onClick={() => setAberto(cartao)}>
            <div className="linha-resumo">
              <strong>{cartao.nome}</strong>
              <small>Fecha dia {cartao.diaFechamento} · vence dia {cartao.diaVencimento}</small>
            </div>
            <span className="rotulo">Fatura de {nomeMes(ref)}</span>
            <strong className="valor-medio">{formatarReais(atual?.total ?? 0)}</strong>
            <BarraProgresso valor={usado} total={cartao.limite} perigo={disponivel < 0} />
            <small>Disponível {formatarReais(disponivel)} de {formatarReais(cartao.limite)}</small>
          </button>
        )
      })}

      <button className="botao" onClick={() => setNovo(true)}>+ Novo cartão</button>

      {aberto && <DetalheCartao cartao={aberto} aoFechar={() => setAberto(null)} />}
      {novo && <FormCartao aoFechar={() => setNovo(false)} />}
    </div>
  )
}

const ROTULO_STATUS: Record<StatusFatura, [string, 'ok' | 'alerta' | 'perigo' | 'neutra']> = {
  aberta: ['Aberta', 'neutra'],
  fechada: ['Fechada', 'alerta'],
  atrasada: ['Atrasada', 'perigo'],
  paga: ['Paga', 'ok'],
}

function DetalheCartao({ cartao: inicial, aoFechar }: { cartao: Cartao; aoFechar: () => void }) {
  const cartao = useLiveQuery(() => db.cartoes.get(inicial.id!), [inicial.id], inicial) ?? inicial
  const [fatura, setFatura] = useState(faturaAberta(inicial))
  const [editando, setEditando] = useState(false)

  const dados = useLiveQuery(async () => {
    const [parcelas, pagamento, todasParcelas] = await Promise.all([
      db.parcelas.where({ cartaoId: cartao.id!, fatura }).toArray(),
      db.pagamentosFatura.where({ cartaoId: cartao.id!, fatura }).first(),
      db.parcelas.where({ cartaoId: cartao.id! }).toArray(),
    ])
    const gastos = await db.gastos.bulkGet([...new Set(todasParcelas.map((p) => p.gastoId))])
    return { parcelas, pagamento, todasParcelas, gastos: gastos.filter((g) => !!g) }
  }, [cartao.id, fatura])

  if (editando) return <FormCartao cartao={cartao} aoFechar={() => setEditando(false)} aoRemover={aoFechar} />
  if (!dados) return null

  const { parcelas, pagamento, todasParcelas, gastos } = dados
  const total = parcelas.reduce((s, p) => s + p.valor, 0)
  const status = statusFatura(cartao, fatura, !!pagamento)
  const { fechamento, vencimento } = datasDaFatura(cartao, fatura)
  const [rotulo, tipo] = ROTULO_STATUS[status]
  const gasto = (id: number) => gastos.find((g) => g.id === id)

  // Compras parceladas que ainda têm parcelas da fatura aberta em diante.
  const aberta = faturaAberta(cartao)
  const parceladas = gastos
    .filter((g) => (g.parcelas ?? 1) > 1)
    .map((g) => {
      const suas = todasParcelas.filter((p) => p.gastoId === g.id)
      const restantes = suas.filter((p) => p.fatura >= aberta)
      const atual = suas.find((p) => p.fatura === aberta) ?? restantes[0]
      return { gasto: g, restantes, atual }
    })
    .filter((x) => x.restantes.length > 0)

  async function pagar() {
    await db.pagamentosFatura.add({ cartaoId: cartao.id!, fatura, valor: total, pagoEm: hoje() })
  }

  return (
    <Folha titulo={cartao.nome} aoFechar={aoFechar}>
      <SeletorMes mes={fatura} aoMudar={setFatura} />
      <div className="linha-resumo">
        <div>
          <span className="rotulo texto-suave">Fatura de {nomeMes(fatura)}</span>
          <strong className="valor-medio">{formatarReais(total)}</strong>
        </div>
        <Etiqueta tipo={tipo}>{rotulo}</Etiqueta>
      </div>
      <p className="texto-suave">Fecha em {formatarDia(fechamento)} · vence em {formatarDia(vencimento)}</p>

      {pagamento ? (
        <>
          <p className="linha-info">Paga em {formatarDia(pagamento.pagoEm)}: <strong>{formatarReais(pagamento.valor)}</strong></p>
          <button className="botao" onClick={() => db.pagamentosFatura.delete(pagamento.id!)}>Desfazer pagamento</button>
        </>
      ) : (
        total > 0 && <button className="botao botao-principal" onClick={pagar}>Pagar fatura ({formatarReais(total)})</button>
      )}

      <h3 className="subtitulo">Compras nesta fatura</h3>
      {parcelas.length === 0 && <p className="texto-suave">Nenhuma compra nesta fatura.</p>}
      <div className="lista">
        {parcelas.map((p) => {
          const g = gasto(p.gastoId)
          return (
            <div key={p.id} className="item item-estatico">
              <span className="item-texto">
                <strong>{g?.descricao ?? 'Compra'}</strong>
                <small>{g ? formatarDiaCurto(g.data) : ''}{p.total > 1 ? ` · parcela ${p.numero} de ${p.total}` : ''}</small>
              </span>
              <strong className="item-valor">{formatarReais(p.valor)}</strong>
            </div>
          )
        })}
      </div>

      {parceladas.length > 0 && (
        <>
          <h3 className="subtitulo">Compras parceladas</h3>
          <div className="lista">
            {parceladas.map(({ gasto: g, restantes, atual }) => (
              <div key={g.id} className="item item-estatico">
                <span className="item-texto">
                  <strong>{g.descricao}</strong>
                  <small>parcela {atual?.numero} de {g.parcelas} · faltam {formatarReais(restantes.reduce((s, p) => s + p.valor, 0))}</small>
                </span>
                <strong className="item-valor">{formatarReais(atual?.valor ?? 0)}</strong>
              </div>
            ))}
          </div>
        </>
      )}

      <button className="botao" onClick={() => setEditando(true)}>Editar cartão</button>
    </Folha>
  )
}

function FormCartao({ cartao, aoFechar, aoRemover }: { cartao?: Cartao; aoFechar: () => void; aoRemover?: () => void }) {
  const [nome, setNome] = useState(cartao?.nome ?? '')
  const [textoLimite, setTextoLimite] = useState(valorParaTexto(cartao?.limite))
  const [fechamento, setFechamento] = useState(cartao?.diaFechamento ?? 1)
  const [vencimento, setVencimento] = useState(cartao?.diaVencimento ?? 10)
  const [cor, setCor] = useState(cartao?.cor ?? '#6366f1')
  const [erro, setErro] = useState('')
  const [removendo, setRemovendo] = useState(false)

  async function salvar() {
    const limite = lerValor(textoLimite)
    if (!nome.trim()) return setErro('Dê um nome para o cartão.')
    if (limite === null || limite < 0) return setErro('Informe o limite.')
    if (fechamento < 1 || fechamento > 31 || vencimento < 1 || vencimento > 31) return setErro('Os dias vão de 1 a 31.')
    const registro: Cartao = { ...(cartao ?? {}), nome: nome.trim(), limite, diaFechamento: fechamento, diaVencimento: vencimento, cor, ativo: 1 }
    const mudouDias = !!cartao && (cartao.diaFechamento !== fechamento || cartao.diaVencimento !== vencimento)
    await db.transaction('rw', [db.cartoes, db.parcelas, db.gastos, db.pagamentosFatura], async () => {
      const id = (await db.cartoes.put(registro)) as number
      if (mudouDias) await recalcularFaturasDoCartao({ ...registro, id })
    })
    aoFechar()
  }

  async function remover() {
    if (!cartao?.id) return
    const usado = await db.parcelas.where({ cartaoId: cartao.id }).count()
    // Com compras, só esconde (o histórico continua); sem compras, apaga.
    if (usado) await db.cartoes.update(cartao.id, { ativo: 0 })
    else await db.cartoes.delete(cartao.id)
    ;(aoRemover ?? aoFechar)()
  }

  return (
    <Folha titulo={cartao ? 'Editar cartão' : 'Novo cartão'} aoFechar={aoFechar}>
      <Campo rotulo="Nome">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Nubank" maxLength={30} autoFocus={!cartao} />
      </Campo>
      <Campo rotulo="Limite">
        <input inputMode="numeric" placeholder="0,00" value={textoLimite} onChange={(e) => setTextoLimite(mascararValor(e.target.value))} />
      </Campo>
      <div className="linha-campos">
        <Campo rotulo="Dia do fechamento">
          <input type="number" inputMode="numeric" min={1} max={31} value={fechamento} onChange={(e) => setFechamento(Number(e.target.value))} />
        </Campo>
        <Campo rotulo="Dia do vencimento">
          <input type="number" inputMode="numeric" min={1} max={31} value={vencimento} onChange={(e) => setVencimento(Number(e.target.value))} />
        </Campo>
      </div>
      {cartao && (
        <p className="texto-suave">Se mudar os dias, as compras que ainda não estão em fatura paga vão para a fatura certa.</p>
      )}
      <Campo rotulo="Cor">
        <div className="cores">
          {CORES.map((c) => (
            <button key={c} type="button" className={`cor ${cor === c ? 'ativa' : ''}`} style={{ background: c }} onClick={() => setCor(c)} aria-label={`Cor ${c}`} />
          ))}
        </div>
      </Campo>
      {erro && <p className="aviso aviso-erro">{erro}</p>}
      <button className="botao botao-principal" onClick={salvar}>Salvar</button>
      {cartao && !removendo && <button className="botao botao-texto-perigo" onClick={() => setRemovendo(true)}>Remover cartão</button>}
      {removendo && (
        <div className="confirmacao">
          <p>Remover “{cartao?.nome}”? Se ele tiver compras, elas continuam no histórico.</p>
          <div className="linha-campos">
            <button className="botao" onClick={() => setRemovendo(false)}>Cancelar</button>
            <button className="botao botao-perigo" onClick={remover}>Remover</button>
          </div>
        </div>
      )}
    </Folha>
  )
}
