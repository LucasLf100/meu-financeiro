import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ContaFixa } from '../db'
import { formatarReais, lerValor } from '../dinheiro'
import { formatarDia, formatarDiaCurto, hoje, mesAtual, nomeMes, prazo, somarMeses } from '../datas'
import { apagarConta, contaValeNoMes, editarConta, encerrarConta, ocorrenciasDoMes, type ModoEdicao, type OcorrenciaConta } from '../regras/contas'
import { BarraProgresso, Campo, Etiqueta, Folha, Interruptor, Opcoes, SeletorMes, Vazio, valorParaTexto, mascararValor } from '../componentes/ui'
import { SeletorCategoria } from '../componentes/SeletorCategoria'
import { empresaNoBolso } from '../regras/empresa'

export function Contas() {
  const [mes, setMes] = useState(mesAtual())
  const [aberta, setAberta] = useState<OcorrenciaConta | null>(null)
  const [nova, setNova] = useState(false)
  const [editando, setEditando] = useState<{ conta: ContaFixa & { id: number }; mes: string } | null>(null)
  const ocorrencias = useLiveQuery(() => ocorrenciasDoMes(mes), [mes])
  const categorias = useLiveQuery(() => db.categorias.toArray(), [], [])

  if (!ocorrencias) return null
  const total = ocorrencias.reduce((s, o) => s + o.valor, 0)
  const pago = ocorrencias.filter((o) => o.status === 'paga').reduce((s, o) => s + o.valor, 0)
  const atrasadas = ocorrencias.filter((o) => o.status === 'atrasada').length

  return (
    <div className="tela">
      <TodasAsContas aoEditar={setEditando} />

      <h3 className="titulo-secao">Mês a mês</h3>
      <SeletorMes mes={mes} aoMudar={setMes} />

      <section className="bloco">
        <div className="linha-resumo">
          <div>
            <span className="rotulo texto-suave">Total do mês</span>
            <strong className="valor-medio">{formatarReais(total)}</strong>
          </div>
          <div className="direita">
            <span className="rotulo texto-suave">Falta pagar</span>
            <strong className={atrasadas ? 'texto-perigo' : ''}>{formatarReais(total - pago)}</strong>
          </div>
        </div>
        <BarraProgresso valor={pago} total={total} />
        <small className="texto-suave">
          {formatarReais(pago)} pagos{atrasadas ? ` · ${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}` : ''}
        </small>
      </section>

      {ocorrencias.length === 0 && <Vazio icone="📅" titulo="Nenhuma conta fixa" texto="Cadastre aluguel, luz, internet, assinaturas…" />}

      <div className="lista">
        {ocorrencias.map((o) => {
          const c = categorias.find((x) => x.id === o.conta.categoriaId)
          return (
            <button key={o.conta.id} className="item" onClick={() => setAberta(o)}>
              <span className="item-icone" style={{ background: `${c?.cor ?? '#94a3b8'}22` }}>{c?.icone ?? '📄'}</span>
              <span className="item-texto">
                <strong>{o.conta.nome}</strong>
                <small>
                  {o.parcela ? `Parcela ${o.parcela.numero} de ${o.parcela.total} · ` : ''}
                  {o.status === 'paga' ? `Paga em ${formatarDiaCurto(o.pagamento!.pagoEm)}` : `Vence ${formatarDiaCurto(o.vencimento)}`}
                </small>
              </span>
              <span className="item-direita">
                <strong className="item-valor">{o.valorEstimado ? '~' : ''}{formatarReais(o.valor)}</strong>
                <EtiquetaStatus status={o.status} />
              </span>
            </button>
          )
        })}
      </div>

      <button className="botao" onClick={() => setNova(true)}>+ Nova conta fixa</button>

      {aberta && <AcoesConta ocorrencia={aberta} aoFechar={() => setAberta(null)} />}
      {nova && <FormConta mes={mes} aoFechar={() => setNova(false)} />}
      {editando && <FormConta conta={editando.conta} mes={editando.mes} aoFechar={() => setEditando(null)} />}
    </div>
  )
}

interface ContaResumo {
  conta: ContaFixa & { id: number }
  aPartirDe: string // primeiro mês que ainda conta (este mês ou o início, se for no futuro)
  restantes?: number // parcelas que faltam, contando a deste mês
}

/** Visão geral: todas as contas fixas em vigor, com o total por mês. */
function TodasAsContas({ aoEditar }: { aoEditar: (e: { conta: ContaFixa & { id: number }; mes: string }) => void }) {
  const dados = useLiveQuery(async () => {
    const [contas, categorias, empresa] = await Promise.all([db.contas.toArray(), db.categorias.toArray(), empresaNoBolso()])
    const atual = mesAtual()
    const lista: ContaResumo[] = []
    for (const conta of contas) {
      const aPartirDe = conta.inicio > atual ? conta.inicio : atual
      if (!contaValeNoMes(conta, aPartirDe)) continue // encerrada ou já quitada
      let restantes: number | undefined
      if (conta.totalParcelas) {
        restantes = 0
        for (let m = aPartirDe; restantes < 600 && contaValeNoMes(conta, m); m = somarMeses(m, 1)) restantes++
      }
      lista.push({ conta: conta as ContaFixa & { id: number }, aPartirDe, restantes })
    }
    return { lista: lista.sort((a, b) => b.conta.valor - a.conta.valor), categorias, atual, empresa }
  })

  if (!dados) return null
  const { lista, categorias, atual, empresa } = dados
  // Cobranças da empresa pagas do meu bolso, em média por mês (anual ÷ 12).
  const daEmpresa = empresa.ativo ? empresa.recorrentes : []
  const empresaPorMes = daEmpresa.reduce((s, c) => s + (c.tipo === 'anual' ? Math.round(c.valorReais / 12) : c.valorReais), 0)
  if (lista.length === 0 && daEmpresa.length === 0) return null

  const recorrentes = lista.filter((c) => c.restantes === undefined)
  const parceladas = lista.filter((c) => c.restantes !== undefined)
  const soma = (l: ContaResumo[]) => l.reduce((s, c) => s + c.conta.valor, 0)
  const faltaParceladas = parceladas.reduce((s, c) => s + c.conta.valor * (c.restantes ?? 0), 0)

  const linha = (c: ContaResumo) => {
    const cat = categorias.find((x) => x.id === c.conta.categoriaId)
    const detalhe = [
      `dia ${c.conta.diaVencimento}`,
      c.restantes !== undefined ? `faltam ${c.restantes} de ${c.conta.totalParcelas}` : c.conta.valorVariavel ? 'valor varia' : null,
      c.aPartirDe > atual ? `começa em ${nomeMes(c.aPartirDe)}` : null,
    ].filter(Boolean).join(' · ')
    return (
      <button key={c.conta.id} className="item" onClick={() => aoEditar({ conta: c.conta, mes: c.aPartirDe })}>
        <span className="item-icone" style={{ background: `${cat?.cor ?? '#94a3b8'}22` }}>{cat?.icone ?? '📄'}</span>
        <span className="item-texto">
          <strong>{c.conta.nome}</strong>
          <small>{detalhe}</small>
        </span>
        <strong className="item-valor">{c.conta.valorVariavel ? '~' : ''}{formatarReais(c.conta.valor)}</strong>
      </button>
    )
  }

  return (
    <>
      <section className="bloco">
        <span className="rotulo texto-suave">Todas as contas fixas · por mês</span>
        <strong className="valor-medio">{formatarReais(soma(lista) + empresaPorMes)}</strong>
        <div className="linha-resumo">
          <small className="texto-suave">Recorrentes: {formatarReais(soma(recorrentes))}</small>
          {parceladas.length > 0 && <small className="texto-suave">Parceladas: {formatarReais(soma(parceladas))}</small>}
        </div>
        {daEmpresa.length > 0 && <small className="texto-suave">Empresa (do meu bolso): ~{formatarReais(empresaPorMes)} por mês, contando os anuais divididos por 12.</small>}
        {parceladas.length > 0 && <small className="texto-suave">Ainda faltam {formatarReais(faltaParceladas)} nas parceladas.</small>}
      </section>

      {recorrentes.length > 0 && (
        <section className="grupo">
          <h3 className="grupo-titulo"><span>Recorrentes ({recorrentes.length})</span><span>{formatarReais(soma(recorrentes))}</span></h3>
          <div className="lista">{recorrentes.map(linha)}</div>
        </section>
      )}
      {parceladas.length > 0 && (
        <section className="grupo">
          <h3 className="grupo-titulo"><span>Parceladas ({parceladas.length})</span><span>{formatarReais(soma(parceladas))}</span></h3>
          <div className="lista">{parceladas.map(linha)}</div>
        </section>
      )}
      {daEmpresa.length > 0 && (
        <section className="grupo">
          <h3 className="grupo-titulo"><span>Empresa, do meu bolso ({daEmpresa.length})</span><span>~{formatarReais(empresaPorMes)}/mês</span></h3>
          <div className="lista">
            {daEmpresa.map((c) => (
              <div key={c.id} className="item item-estatico">
                <span className="item-icone">💼</span>
                <span className="item-texto">
                  <strong>{c.plataforma}</strong>
                  <small>
                    {c.tipo === 'mensal' ? 'mensal' : `anual · ~${formatarReais(Math.round(c.valorReais / 12))}/mês`}
                    {c.proxima ? ` · renova ${formatarDia(c.proxima)}` : ''}
                  </small>
                </span>
                <strong className="item-valor">{formatarReais(c.valorReais)}</strong>
              </div>
            ))}
          </div>
          <small className="texto-suave">Para mudar, vá ao modo Empresa. Para não somar no Pessoal, desligue em Ajustes.</small>
        </section>
      )}
    </>
  )
}

export function EtiquetaStatus({ status }: { status: OcorrenciaConta['status'] }) {
  if (status === 'paga') return <Etiqueta tipo="ok">Paga</Etiqueta>
  if (status === 'atrasada') return <Etiqueta tipo="perigo">Atrasada</Etiqueta>
  return <Etiqueta tipo="neutra">Pendente</Etiqueta>
}

function AcoesConta({ ocorrencia, aoFechar }: { ocorrencia: OcorrenciaConta; aoFechar: () => void }) {
  const { conta, competencia, pagamento } = ocorrencia
  const [textoValor, setTextoValor] = useState(valorParaTexto(ocorrencia.valor))
  const [data, setData] = useState(hoje())
  const [editando, setEditando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState('')

  async function marcarPaga() {
    const valor = lerValor(textoValor)
    if (!valor || valor <= 0) return setErro('Informe o valor pago.')
    await db.pagamentosConta.add({ contaId: conta.id, competencia, valor, pagoEm: data })
    aoFechar()
  }

  async function desmarcar() {
    if (pagamento?.id) await db.pagamentosConta.delete(pagamento.id)
    aoFechar()
  }

  async function pularMes() {
    const existente = await db.ajustesConta.where({ contaId: conta.id, competencia }).first()
    await db.ajustesConta.put({ ...existente, contaId: conta.id, competencia, pulada: true })
    aoFechar()
  }

  if (editando) return <FormConta conta={conta} ocorrencia={ocorrencia} mes={competencia} aoFechar={aoFechar} />

  return (
    <Folha titulo={conta.nome} aoFechar={aoFechar}>
      <p className="linha-info">
        {nomeMes(competencia)} · vence {formatarDia(ocorrencia.vencimento)} ({prazo(ocorrencia.vencimento)})
      </p>
      <div className="linha-info"><EtiquetaStatus status={ocorrencia.status} /></div>

      {pagamento ? (
        <>
          <p className="linha-info">Paga em {formatarDia(pagamento.pagoEm)}: <strong>{formatarReais(pagamento.valor)}</strong></p>
          <button className="botao" onClick={desmarcar}>Desmarcar pagamento</button>
        </>
      ) : (
        <>
          <div className="linha-campos">
            <Campo rotulo={ocorrencia.valorEstimado ? 'Valor (estimado)' : 'Valor pago'}>
              <input inputMode="numeric" value={textoValor} onChange={(e) => setTextoValor(mascararValor(e.target.value))} />
            </Campo>
            <Campo rotulo="Data do pagamento">
              <input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
            </Campo>
          </div>
          {erro && <p className="aviso aviso-erro">{erro}</p>}
          <button className="botao botao-principal" onClick={marcarPaga}>Marcar como paga</button>
        </>
      )}

      <button className="botao" onClick={() => setEditando(true)}>Editar conta</button>
      {!pagamento && <button className="botao" onClick={pularMes}>Não tem neste mês</button>}

      {!excluindo ? (
        <button className="botao botao-texto-perigo" onClick={() => setExcluindo(true)}>Encerrar ou apagar</button>
      ) : (
        <div className="confirmacao">
          <p><strong>Encerrar</strong> tira a conta a partir de {nomeMes(competencia)} e mantém o histórico. <strong>Apagar</strong> remove tudo, inclusive pagamentos antigos.</p>
          <button className="botao" onClick={async () => { await encerrarConta(conta, competencia); aoFechar() }}>Encerrar a partir deste mês</button>
          <button className="botao botao-perigo" onClick={async () => { await apagarConta(conta.id); aoFechar() }}>Apagar conta e histórico</button>
          <button className="botao" onClick={() => setExcluindo(false)}>Cancelar</button>
        </div>
      )}
    </Folha>
  )
}

function FormConta({
  conta,
  ocorrencia,
  mes,
  aoFechar,
}: {
  conta?: ContaFixa & { id: number }
  ocorrencia?: OcorrenciaConta
  mes: string
  aoFechar: () => void
}) {
  const [nome, setNome] = useState(conta?.nome ?? '')
  const [textoValor, setTextoValor] = useState(valorParaTexto(ocorrencia?.ajuste?.valor ?? conta?.valor))
  const [dia, setDia] = useState(ocorrencia?.ajuste?.diaVencimento ?? conta?.diaVencimento ?? 10)
  const [categoriaId, setCategoriaId] = useState<number | undefined>(conta?.categoriaId)
  const [variavel, setVariavel] = useState(conta?.valorVariavel ?? false)
  const [temFim, setTemFim] = useState(!!conta?.totalParcelas)
  const [totalParcelas, setTotalParcelas] = useState(String(conta?.totalParcelas ?? 12))
  const [parcelaAtual, setParcelaAtual] = useState(String(ocorrencia?.parcela?.numero ?? 1))
  const [modo, setModo] = useState<ModoEdicao>('este-e-proximos')
  const [erro, setErro] = useState('')

  async function salvar() {
    const valor = lerValor(textoValor)
    if (!nome.trim()) return setErro('Dê um nome para a conta.')
    if (!valor || valor <= 0) return setErro('Informe o valor.')
    if (dia < 1 || dia > 31) return setErro('O dia de vencimento vai de 1 a 31.')
    const total = temFim ? Number(totalParcelas) : undefined
    const atual = temFim ? Number(parcelaAtual) : 1
    if (temFim && (!total || total < 1 || !atual || atual < 1 || atual > total)) return setErro('Confira o número de parcelas.')

    const mudancas = { nome: nome.trim(), valor, diaVencimento: dia, categoriaId, valorVariavel: variavel, totalParcelas: total }
    if (conta) {
      await editarConta(conta, mes, modo, mudancas)
    } else {
      await db.contas.add({ ...mudancas, inicio: mes, parcelaInicial: temFim ? atual : undefined, ativa: 1 })
    }
    aoFechar()
  }

  return (
    <Folha titulo={conta ? 'Editar conta fixa' : 'Nova conta fixa'} aoFechar={aoFechar}>
      <Campo rotulo="Nome">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Internet" maxLength={40} autoFocus={!conta} />
      </Campo>
      <div className="linha-campos">
        <Campo rotulo={variavel ? 'Valor previsto' : 'Valor'}>
          <input inputMode="numeric" placeholder="0,00" value={textoValor} onChange={(e) => setTextoValor(mascararValor(e.target.value))} />
        </Campo>
        <Campo rotulo="Dia do vencimento">
          <input type="number" inputMode="numeric" min={1} max={31} value={dia} onChange={(e) => setDia(Number(e.target.value))} />
        </Campo>
      </div>
      <Interruptor rotulo="O valor muda todo mês" dica="Luz, água… o app usa a média dos últimos 3 meses." ligado={variavel} aoMudar={setVariavel} />
      <Interruptor rotulo="Tem número de parcelas" dica="Financiamento, empréstimo, curso…" ligado={temFim} aoMudar={setTemFim} />
      {temFim && (
        <div className="linha-campos">
          <Campo rotulo="Total de parcelas">
            <input type="number" inputMode="numeric" min={1} value={totalParcelas} onChange={(e) => setTotalParcelas(e.target.value)} />
          </Campo>
          {!conta && (
            <Campo rotulo={`Parcela de ${nomeMes(mes)}`}>
              <input type="number" inputMode="numeric" min={1} value={parcelaAtual} onChange={(e) => setParcelaAtual(e.target.value)} />
            </Campo>
          )}
        </div>
      )}
      <Campo rotulo="Categoria">
        <SeletorCategoria modo="pessoal" valor={categoriaId} aoMudar={setCategoriaId} />
      </Campo>

      {conta && (
        <Campo rotulo="Aplicar a mudança em">
          <Opcoes
            rotulo="Aplicar a mudança em"
            opcoes={[
              { valor: 'so-este' as ModoEdicao, rotulo: 'Só este mês' },
              { valor: 'este-e-proximos' as ModoEdicao, rotulo: 'Este e os próximos' },
              { valor: 'futuros' as ModoEdicao, rotulo: 'Só os próximos' },
            ]}
            valor={modo}
            aoMudar={setModo}
          />
          <small className="dica">
            {modo === 'so-este' && `Valor e dia mudam só em ${nomeMes(mes)}.`}
            {modo === 'este-e-proximos' && `Vale a partir de ${nomeMes(mes)}. Os meses anteriores ficam como estavam.`}
            {modo === 'futuros' && `${nomeMes(mes)} fica como está; muda a partir do mês seguinte.`}
          </small>
        </Campo>
      )}

      {erro && <p className="aviso aviso-erro">{erro}</p>}
      <button className="botao botao-principal" onClick={salvar}>Salvar</button>
    </Folha>
  )
}
