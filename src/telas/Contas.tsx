import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ContaFixa, type FormaConta } from '../db'
import { formatarReais, lerValor } from '../dinheiro'
import { formatarDia, formatarDiaCurto, hoje, mesAtual, MESES, nomeMes, prazo, somarMeses } from '../datas'
import { apagarConta, contaEmVigor, contaValeNoMes, valorPorMes, editarConta, FORMAS_CONTA, formaDaConta, infoForma, encerrarConta, ocorrenciasDoMes, type ModoEdicao, type OcorrenciaConta } from '../regras/contas'
import { BarraProgresso, Campo, Etiqueta, Folha, Interruptor, Opcoes, SeletorMes, Vazio, valorParaTexto, mascararValor } from '../componentes/ui'
import { SeletorCategoria } from '../componentes/SeletorCategoria'
import { empresaNoBolso } from '../regras/empresa'
import { faturasDoMes, type FaturaDoMes } from '../regras/cartoes'
import { DetalheCartao } from './Cartoes'

export function Contas() {
  const [mes, setMes] = useState(mesAtual())
  const [mesEscolhido, setMesEscolhido] = useState(false)
  const [aberta, setAberta] = useState<OcorrenciaConta | null>(null)
  const primeiroMesComContas = useLiveQuery(async () => {
    for (let m = mesAtual(), i = 0; i < 13; m = somarMeses(m, 1), i++) {
      if ((await ocorrenciasDoMes(m)).length) return m
    }
    return mesAtual()
  }, [])
  useEffect(() => {
    if (!mesEscolhido && primeiroMesComContas && primeiroMesComContas !== mes) setMes(primeiroMesComContas)
  }, [primeiroMesComContas, mesEscolhido, mes])
  const mudarMes = (m: string) => {
    setMesEscolhido(true)
    setMes(m)
  }
  const [nova, setNova] = useState(false)
  const [editando, setEditando] = useState<{ conta: ContaFixa & { id: number }; mes: string } | null>(null)
  const [verPagas, setVerPagas] = useState(false)
  const [verGerenciar, setVerGerenciar] = useState(false)
  const ocorrencias = useLiveQuery(() => ocorrenciasDoMes(mes), [mes])
  const categorias = useLiveQuery(() => db.categorias.toArray(), [], [])
  const visaoGeral = useLiveQuery(calcularVisaoGeral)
  const faturas = useLiveQuery(() => faturasDoMes(mes), [mes], [] as FaturaDoMes[])
  const [faturaAberta, setFaturaAberta] = useState<FaturaDoMes | null>(null)

  if (!ocorrencias) return null
  const pagas = ocorrencias.filter((o) => o.status === 'paga')
  const aPagar = ocorrencias.filter((o) => o.status !== 'paga').sort((a, b) => a.vencimento.localeCompare(b.vencimento) || b.valor - a.valor)
  const faturasAPagar = faturas.filter((f) => f.status !== 'paga')
  const faturasPagas = faturas.filter((f) => f.status === 'paga')
  // Total do mês: contas fixas + faturas de cartão (compras e parcelas).
  const total = ocorrencias.reduce((s, o) => s + o.valor, 0) + faturas.reduce((s, f) => s + f.valor, 0)
  const pago = pagas.reduce((s, o) => s + o.valor, 0) + faturasPagas.reduce((s, f) => s + f.valor, 0)
  const atrasadas = aPagar.filter((o) => o.status === 'atrasada').length + faturasAPagar.filter((f) => f.status === 'atrasada').length
  const qtdAPagar = aPagar.length + faturasAPagar.length
  const qtdPagas = pagas.length + faturasPagas.length

  const itemFatura = (f: FaturaDoMes) => (
    <button key={`fatura-${f.cartao.id}`} className="item" onClick={() => setFaturaAberta(f)}>
      <span className="item-icone">💳<MarcaPagamento status={f.status === 'paga' ? 'paga' : 'pendente'} /></span>
      <span className="item-texto">
        <strong>Fatura {f.cartao.nome}</strong>
        <small>{f.status === 'paga' ? 'Paga' : `Vence ${formatarDiaCurto(f.vencimento)}`} · compras e parcelas</small>
      </span>
      <span className="item-direita">
        <strong className="item-valor">{formatarReais(f.valor)}</strong>
        <EtiquetaStatus status={f.status === 'paga' ? 'paga' : f.status === 'atrasada' ? 'atrasada' : 'pendente'} />
      </span>
    </button>
  )
  // Contas e faturas juntas, por vencimento.
  type Entrada = { vencimento: string; valor: number; no: ReactNode }
  const ordenar = (lista: Entrada[]) => lista.sort((a, b) => a.vencimento.localeCompare(b.vencimento) || b.valor - a.valor).map((e) => e.no)
  const doCartaoEmAberto = aPagar.filter((o) => formaDaConta(o.conta) === 'cartao')

  async function marcarCartaoComoPagas() {
    await db.transaction('rw', db.pagamentosConta, async () => {
      for (const o of doCartaoEmAberto) {
        await db.pagamentosConta.add({ contaId: o.conta.id, competencia: mes, valor: o.valor, pagoEm: hoje(), forma: 'cartao', cartaoId: o.conta.cartaoId })
      }
    })
  }

  const item = (o: OcorrenciaConta) => {
    const c = categorias.find((x) => x.id === o.conta.categoriaId)
    const forma = infoForma(o.pagamento?.forma ?? formaDaConta(o.conta))
    return (
      <button key={o.conta.id} className="item" onClick={() => setAberta(o)}>
        <span className="item-icone" style={{ background: `${c?.cor ?? '#94a3b8'}22` }}>{forma?.icone ?? c?.icone ?? '📄'}<MarcaPagamento status={o.status} /></span>
        <span className="item-texto">
          <strong>{o.conta.nome}</strong>
          <small>
            {o.status === 'paga'
              ? `Paga em ${formatarDiaCurto(o.pagamento!.pagoEm)}${forma ? ` · ${forma.rotulo}` : ''}`
              : `Vence ${formatarDiaCurto(o.vencimento)}${forma ? ` · ${forma.rotulo}` : ''}`}
            {o.parcela ? ` · parcela ${o.parcela.numero} de ${o.parcela.total}` : ''}
          </small>
        </span>
        <span className="item-direita">
          <strong className="item-valor">{o.valorEstimado ? '~' : ''}{formatarReais(o.valor)}</strong>
          <EtiquetaStatus status={o.status} />
        </span>
      </button>
    )
  }

  return (
    <div className="tela">
      <SeletorMes mes={mes} aoMudar={mudarMes} />

      <section className="bloco">
        <div className="linha-resumo">
          <div>
            <span className="rotulo texto-suave">Total do mês</span>
            <strong className="valor-medio">{formatarReais(total)}</strong>
          </div>
          <div className="direita">
            <span className="rotulo texto-suave">Falta pagar</span>
            <strong className={aPagar.length ? 'texto-perigo' : 'texto-ok'}>{formatarReais(total - pago)}</strong>
          </div>
        </div>
        <BarraProgresso valor={pago} total={total} perigo={atrasadas > 0} />
        <small className="texto-suave">
          {formatarReais(pago)} pagos{atrasadas ? ` · ${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}` : ''}
        </small>
        {visaoGeral && visaoGeral.porMes > 0 && (
          <small className="texto-suave">Em média, por mês: {formatarReais(visaoGeral.porMes)} (anuais divididos por 12{visaoGeral.empresaPorMes ? ', com a empresa' : ''}).</small>
        )}
      </section>

      {ocorrencias.length === 0 && faturas.length === 0 && <Vazio icone="📅" titulo="Nenhuma conta neste mês" texto="Use “+ Nova conta fixa” para cadastrar luz, aluguel, assinaturas, parcelas…" />}

      {qtdAPagar > 0 && (
        <section className="grupo">
          <h3 className="grupo-titulo"><span>A pagar ({qtdAPagar})</span><span>{formatarReais(total - pago)}</span></h3>
          <div className="lista">
            {ordenar([
              ...aPagar.map((o) => ({ vencimento: o.vencimento, valor: o.valor, no: item(o) })),
              ...faturasAPagar.map((f) => ({ vencimento: f.vencimento, valor: f.valor, no: itemFatura(f) })),
            ])}
          </div>
          {doCartaoEmAberto.length > 1 && (
            <button className="botao" onClick={marcarCartaoComoPagas}>
              💳 Marcar as {doCartaoEmAberto.length} do cartão como pagas ({formatarReais(doCartaoEmAberto.reduce((s, o) => s + o.valor, 0))})
            </button>
          )}
        </section>
      )}
      {qtdPagas > 0 && qtdAPagar === 0 && <p className="texto-suave centro">Tudo pago em {nomeMes(mes)}. 🎉</p>}

      {qtdPagas > 0 && (
        <section className="grupo">
          <button className="grupo-titulo grupo-recolhivel" onClick={() => setVerPagas(!verPagas)} aria-expanded={verPagas}>
            <span>{verPagas ? '▾' : '▸'} Pagas ({qtdPagas})</span>
            <span>{formatarReais(pago)}</span>
          </button>
          {verPagas && (
            <div className="lista">
              {ordenar([
                ...pagas.map((o) => ({ vencimento: o.vencimento, valor: o.valor, no: item(o) })),
                ...faturasPagas.map((f) => ({ vencimento: f.vencimento, valor: f.valor, no: itemFatura(f) })),
              ])}
            </div>
          )}
        </section>
      )}

      <button className="botao" onClick={() => setNova(true)}>+ Nova conta fixa</button>

      {visaoGeral && visaoGeral.quantidade > 0 && (
        <section className="grupo">
          <button className="grupo-titulo grupo-recolhivel" onClick={() => setVerGerenciar(!verGerenciar)} aria-expanded={verGerenciar}>
            <span>{verGerenciar ? '▾' : '▸'} Gerenciar contas ({visaoGeral.quantidade})</span>
            <span>~{formatarReais(visaoGeral.porMes)}/mês</span>
          </button>
          {verGerenciar && (
            <TodasAsContas
              aoAbrir={async ({ conta, mes: mesDaConta }) => {
                const ocorrencia = (await ocorrenciasDoMes(mesDaConta)).find((o) => o.conta.id === conta.id)
                if (ocorrencia) setAberta(ocorrencia)
                else setEditando({ conta, mes: mesDaConta })
              }}
            />
          )}
        </section>
      )}

      {aberta && <AcoesConta ocorrencia={aberta} aoFechar={() => setAberta(null)} />}
      {faturaAberta && <DetalheCartao cartao={faturaAberta.cartao} faturaInicial={faturaAberta.fatura} aoFechar={() => setFaturaAberta(null)} />}
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

/** Primeiro mês, a partir de `desde`, em que a conta vence. */
function proximoVencimento(conta: ContaFixa, desde: string): string {
  for (let m = desde, i = 0; i < 24; m = somarMeses(m, 1), i++) if (contaValeNoMes(conta, m)) return m
  return desde
}

/** Todas as contas em vigor, com parcelas restantes, e a média por mês (anuais ÷ 12, mais a empresa). */
async function calcularVisaoGeral() {
  const [contas, empresa] = await Promise.all([db.contas.toArray(), empresaNoBolso()])
  const atual = mesAtual()
  const lista: ContaResumo[] = []
  for (const conta of contas) {
    const aPartirDe = conta.inicio > atual ? conta.inicio : atual
    if (!contaEmVigor(conta, aPartirDe)) continue // encerrada ou já quitada
    let restantes: number | undefined
    if (conta.totalParcelas) {
      restantes = 0
      for (let m = aPartirDe, passos = 0; passos < 1200 && contaEmVigor(conta, m); m = somarMeses(m, 1), passos++) if (contaValeNoMes(conta, m)) restantes++
    }
    lista.push({ conta: conta as ContaFixa & { id: number }, aPartirDe, restantes })
  }
  const daEmpresa = empresa.ativo ? empresa.recorrentes : []
  const empresaPorMes = daEmpresa.reduce((s, c) => s + (c.tipo === 'anual' ? Math.round(c.valorReais / 12) : c.valorReais), 0)
  return {
    lista: lista.sort((a, b) => b.conta.valor - a.conta.valor),
    daEmpresa,
    empresaPorMes,
    porMes: lista.reduce((s, c) => s + valorPorMes(c.conta), 0) + empresaPorMes,
    quantidade: lista.length + daEmpresa.length,
    atual,
  }
}

/** Cadastro: todas as contas em vigor, separadas em mensais, anuais, parceladas e empresa. */
function TodasAsContas({ aoAbrir }: { aoAbrir: (e: { conta: ContaFixa & { id: number }; mes: string }) => void }) {
  const dados = useLiveQuery(async () => ({ visao: await calcularVisaoGeral(), categorias: await db.categorias.toArray() }))
  if (!dados) return null
  const { visao, categorias } = dados
  const { lista, daEmpresa, empresaPorMes, atual } = visao

  const mensais = lista.filter((c) => c.restantes === undefined && c.conta.frequencia !== 'anual')
  const anuais = lista.filter((c) => c.restantes === undefined && c.conta.frequencia === 'anual')
  const parceladas = lista.filter((c) => c.restantes !== undefined)
  const soma = (l: ContaResumo[]) => l.reduce((s, c) => s + valorPorMes(c.conta), 0)
  const faltaParceladas = parceladas.reduce((s, c) => s + c.conta.valor * (c.restantes ?? 0), 0)

  const linha = (c: ContaResumo) => {
    const cat = categorias.find((x) => x.id === c.conta.categoriaId)
    const forma = infoForma(formaDaConta(c.conta))
    const detalhe = [
      forma ? forma.rotulo : null,
      c.conta.frequencia === 'anual' ? `todo ano em ${MESES[Number(c.conta.inicio.slice(5, 7)) - 1]}, dia ${c.conta.diaVencimento}` : `dia ${c.conta.diaVencimento}`,
      c.restantes !== undefined ? `faltam ${c.restantes} de ${c.conta.totalParcelas}` : c.conta.valorVariavel ? 'valor varia' : null,
      c.aPartirDe > atual ? `começa em ${nomeMes(c.aPartirDe)}` : null,
    ].filter(Boolean).join(' · ')
    return (
      <button key={c.conta.id} className="item" onClick={() => aoAbrir({ conta: c.conta, mes: proximoVencimento(c.conta, c.aPartirDe) })}>
        <span className="item-icone" style={{ background: `${cat?.cor ?? '#94a3b8'}22` }}>{forma?.icone ?? cat?.icone ?? '📄'}</span>
        <span className="item-texto">
          <strong>{c.conta.nome}</strong>
          <small>{detalhe}</small>
        </span>
        <strong className="item-valor">{c.conta.valorVariavel ? '~' : ''}{formatarReais(c.conta.valor)}{c.conta.frequencia === 'anual' ? '/ano' : ''}</strong>
      </button>
    )
  }

  const grupo = (titulo: string, itens: ContaResumo[], direita: string, rodape?: string) =>
    itens.length > 0 && (
      <div className="subgrupo">
        <h4 className="subgrupo-titulo"><span>{titulo} ({itens.length})</span><span>{direita}</span></h4>
        <div className="lista">{itens.map(linha)}</div>
        {rodape && <small className="texto-suave">{rodape}</small>}
      </div>
    )

  return (
    <>
      <small className="texto-suave">Toque numa conta para pagar, editar ou encerrar.</small>
      {grupo('Todo mês', mensais, `${formatarReais(soma(mensais))}/mês`)}
      {grupo('Todo ano', anuais, `~${formatarReais(soma(anuais))}/mês`)}
      {grupo('Parceladas', parceladas, `${formatarReais(soma(parceladas))}/mês`, `Ainda faltam ${formatarReais(faltaParceladas)} nas parceladas.`)}
      {daEmpresa.length > 0 && (
        <div className="subgrupo">
          <h4 className="subgrupo-titulo"><span>Empresa, do meu bolso ({daEmpresa.length})</span><span>~{formatarReais(empresaPorMes)}/mês</span></h4>
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
        </div>
      )}
    </>
  )
}

export function EtiquetaStatus({ status }: { status: OcorrenciaConta['status'] }) {
  if (status === 'paga') return <Etiqueta tipo="ok">Paga</Etiqueta>
  if (status === 'atrasada') return <Etiqueta tipo="perigo">Atrasada</Etiqueta>
  return <Etiqueta tipo="perigo">A pagar</Etiqueta>
}

/** Bolinha no canto do ícone: verde se paga, vermelha se não. */
export function MarcaPagamento({ status }: { status: OcorrenciaConta['status'] }) {
  return <span className={`marca-pagamento ${status === 'paga' ? 'paga' : 'aberta'}`} aria-label={status === 'paga' ? 'Paga' : 'Não paga'} />
}

export function AcoesConta({ ocorrencia, aoFechar }: { ocorrencia: OcorrenciaConta; aoFechar: () => void }) {
  const { conta, competencia, pagamento } = ocorrencia
  const [textoValor, setTextoValor] = useState(valorParaTexto(ocorrencia.valor))
  const [data, setData] = useState(hoje())
  const formaCostume = formaDaConta(conta)
  const [comoPagou, setComoPagou] = useState<Exclude<FormaConta, 'varia'> | ''>(formaCostume && formaCostume !== 'varia' ? formaCostume : '')
  const cartoesAtivos = useLiveQuery(() => db.cartoes.where({ ativo: 1 }).toArray(), [], [])
  const [cartaoPago, setCartaoPago] = useState<number | undefined>(conta.cartaoId)
  const cartaoPagoEscolhido = cartaoPago ?? cartoesAtivos[0]?.id
  const [editando, setEditando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState('')

  async function marcarPaga() {
    const valor = lerValor(textoValor)
    if (!valor || valor <= 0) return setErro('Informe o valor pago.')
    if (!comoPagou) return setErro('Escolha como você pagou.')
    await db.pagamentosConta.add({
      contaId: conta.id,
      competencia,
      valor,
      pagoEm: data,
      forma: comoPagou,
      cartaoId: comoPagou === 'cartao' ? cartaoPagoEscolhido : undefined,
    })
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
          <p className="linha-info">Paga em {formatarDia(pagamento.pagoEm)}: <strong>{formatarReais(pagamento.valor)}</strong>{pagamento.forma ? ` · ${infoForma(pagamento.forma)?.icone} ${infoForma(pagamento.forma)?.rotulo}` : ''}{pagamento.viaFaturaCartaoId ? ' (junto com a fatura)' : ''}</p>
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
          <Campo rotulo="Como pagou">
            <Opcoes
              rotulo="Como pagou"
              opcoes={FORMAS_CONTA.filter((f) => f.valor !== 'varia').map((f) => ({ valor: f.valor as Exclude<FormaConta, 'varia'>, rotulo: `${f.icone} ${f.rotulo}` }))}
              valor={comoPagou}
              aoMudar={setComoPagou}
            />
          </Campo>
          {comoPagou === 'cartao' && cartoesAtivos.length > 0 && (
            <Campo rotulo="Qual cartão">
              <select value={cartaoPagoEscolhido} onChange={(e) => setCartaoPago(Number(e.target.value))}>
                {cartoesAtivos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </Campo>
          )}
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
  const [forma, setForma] = useState<FormaConta | ''>(conta ? formaDaConta(conta) ?? '' : '')
  const [frequencia, setFrequencia] = useState<'mensal' | 'anual'>(conta?.frequencia ?? 'mensal')
  const cartoes = useLiveQuery(() => db.cartoes.where({ ativo: 1 }).toArray(), [], [])
  const [cartaoId, setCartaoId] = useState<number | undefined>(conta?.cartaoId)
  const cartaoEscolhido = cartaoId ?? cartoes[0]?.id
  const [mesAnual, setMesAnual] = useState(mes)
  const [mesBase, setMesBase] = useState(mes)
  const [erro, setErro] = useState('')

  async function salvar() {
    const valor = lerValor(textoValor)
    if (!nome.trim()) return setErro('Dê um nome para a conta.')
    if (!valor || valor <= 0) return setErro('Informe o valor.')
    if (dia < 1 || dia > 31) return setErro('O dia de vencimento vai de 1 a 31.')
    const total = temFim ? Number(totalParcelas) : undefined
    const atual = temFim ? Number(parcelaAtual) : 1
    if (temFim && (!total || total < 1 || !atual || atual < 1 || atual > total)) return setErro('Confira o número de parcelas.')

    const mudancas = { nome: nome.trim(), valor, diaVencimento: dia, categoriaId, valorVariavel: variavel, totalParcelas: total, formaPagamento: forma || undefined, cartaoId: forma === 'cartao' ? cartaoEscolhido : undefined, frequencia: frequencia === 'anual' ? ('anual' as const) : undefined }
    if (conta) {
      await editarConta(conta, mesBase, modo, mudancas)
    } else {
      await db.contas.add({ ...mudancas, inicio: frequencia === 'anual' ? mesAnual : mes, parcelaInicial: temFim ? atual : undefined, ativa: 1 })
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
      <Campo rotulo="Repete">
        <Opcoes
          rotulo="Repete"
          opcoes={[{ valor: 'mensal' as const, rotulo: 'Todo mês' }, { valor: 'anual' as const, rotulo: 'Todo ano' }]}
          valor={frequencia}
          aoMudar={setFrequencia}
        />
      </Campo>
      {frequencia === 'anual' && !conta && (
        <Campo rotulo="Primeiro vencimento (mês e ano)" dica="Depois se repete todo ano neste mesmo mês. Ex.: IPVA, seguro, domínio.">
          <input type="month" value={mesAnual} onChange={(e) => e.target.value && setMesAnual(e.target.value)} />
        </Campo>
      )}
      {frequencia === 'anual' && conta && (
        <small className="dica">Vence todo ano em {MESES[Number(conta.inicio.slice(5, 7)) - 1]}.</small>
      )}
      <Interruptor rotulo={frequencia === 'anual' ? 'O valor muda a cada ano' : 'O valor muda todo mês'} dica="O app usa a média dos últimos 3 pagamentos." ligado={variavel} aoMudar={setVariavel} />
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
      <Campo rotulo="Como você paga">
        <Opcoes
          rotulo="Como você paga"
          opcoes={FORMAS_CONTA.map((f) => ({ valor: f.valor as FormaConta | '', rotulo: `${f.icone} ${f.rotulo}` }))}
          valor={forma}
          aoMudar={(v) => setForma(v === forma ? '' : v)}
        />
      </Campo>
      {forma === 'cartao' && cartoes.length > 0 && (
        <Campo rotulo="Qual cartão" dica="Ao pagar a fatura deste cartão, a conta fica paga junto.">
          <select value={cartaoEscolhido} onChange={(e) => setCartaoId(Number(e.target.value))}>
            {cartoes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </Campo>
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
            {modo === 'so-este' && `Valor e dia mudam só em ${nomeMes(mesBase)}.`}
            {modo === 'este-e-proximos' && `Vale a partir de ${nomeMes(mesBase)}. Os meses anteriores ficam como estavam.`}
            {modo === 'futuros' && `${nomeMes(mesBase)} fica como está; muda a partir do mês seguinte.`}
          </small>
        </Campo>
      )}
      {conta && (
        <Campo
          rotulo={modo === 'so-este' ? 'Qual mês' : 'A partir de'}
          dica={modo === 'este-e-proximos' && mesBase < conta.inicio ? `A conta passa a começar em ${nomeMes(mesBase)} (antes começava em ${nomeMes(conta.inicio)}).` : undefined}
        >
          <input type="month" value={mesBase} onChange={(e) => e.target.value && setMesBase(e.target.value)} />
        </Campo>
      )}

      {erro && <p className="aviso aviso-erro">{erro}</p>}
      <button className="botao botao-principal" onClick={salvar}>Salvar</button>
    </Folha>
  )
}
