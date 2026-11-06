import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, lerConfig, type Cobranca, type GastoEmpresa, type OrigemPagamento, type Plataforma, type Retirada, type StatusPlataforma, type TipoCobranca } from '../../db'
import { formatarReais, lerValor } from '../../dinheiro'
import { formatarDia, hoje } from '../../datas'
import { emReais, lerCotacao, proximaData } from '../../regras/empresa'
import { apagarGastoEmpresa, ORIGENS, origemDe, registrarPagamentoCobranca, salvarGastoEmpresa } from '../../regras/empresaMes'
import { Campo, Folha, Interruptor, Opcoes, valorParaTexto, mascararValor } from '../../componentes/ui'
import { SeletorCategoria } from '../../componentes/SeletorCategoria'
import { NOME_STATUS, NOME_TIPO } from './comum'

function useProdutos() {
  return useLiveQuery(() => db.produtos.toArray(), [], [])
}

function usePagoPorMimPadrao() {
  return useLiveQuery(() => lerConfig<boolean>('pagoPorMimPadrao', true), [], true)
}

function useOrigemPadrao(): OrigemPagamento {
  const padrao = usePagoPorMimPadrao()
  return padrao ? 'bolso' : 'caixa'
}

/** "De onde saiu o dinheiro": caixa, cartão da empresa, meu bolso ou meu cartão (entra na fatura). */
export function SeletorOrigem({ origem, aoMudar, cartaoId, aoMudarCartao }: {
  origem: OrigemPagamento
  aoMudar: (o: OrigemPagamento) => void
  cartaoId?: number
  aoMudarCartao: (id: number) => void
}) {
  const cartoes = useLiveQuery(() => db.cartoes.where({ ativo: 1 }).toArray(), [], [])
  const atual = ORIGENS.find((o) => o.valor === origem)!
  // Sem cartão escolhido, usa o primeiro ativo.
  const cartaoValido = cartoes.find((c) => c.id === cartaoId)?.id ?? cartoes[0]?.id
  useEffect(() => {
    if (origem === 'cartao-pessoal' && cartaoValido && cartaoValido !== cartaoId) aoMudarCartao(cartaoValido)
  }, [origem, cartaoValido, cartaoId, aoMudarCartao])
  return (
    <>
      <Campo rotulo="De onde saiu o dinheiro" dica={atual.dica}>
        <div className="origens" role="radiogroup" aria-label="De onde saiu o dinheiro">
          {ORIGENS.map((o) => (
            <button key={o.valor} type="button" role="radio" aria-checked={origem === o.valor} className={origem === o.valor ? 'origem ativa' : 'origem'} onClick={() => aoMudar(o.valor)}>
              <span className="origem-icone">{o.icone}</span>
              <span>{o.rotulo}</span>
            </button>
          ))}
        </div>
      </Campo>
      {origem === 'cartao-pessoal' && (
        cartoes.length ? (
          <Campo rotulo="Qual cartão" dica="Entra como compra à vista na fatura desse cartão.">
            <Opcoes rotulo="Cartão" opcoes={cartoes.map((c) => ({ valor: c.id!, rotulo: c.nome }))} valor={cartaoValido ?? 0} aoMudar={aoMudarCartao} />
          </Campo>
        ) : <p className="aviso aviso-erro">Cadastre um cartão no Pessoal primeiro.</p>
      )}
    </>
  )
}

function Confirmacao({ texto, rotulo, aoConfirmar }: { texto: string; rotulo: string; aoConfirmar: () => void }) {
  const [aberta, setAberta] = useState(false)
  if (!aberta) return <button className="botao botao-texto-perigo" onClick={() => setAberta(true)}>{rotulo}</button>
  return (
    <div className="confirmacao">
      <p>{texto}</p>
      <div className="linha-campos">
        <button className="botao" onClick={() => setAberta(false)}>Cancelar</button>
        <button className="botao botao-perigo" onClick={aoConfirmar}>{rotulo}</button>
      </div>
    </div>
  )
}

/* ---------- Plataforma ---------- */

export function FormPlataforma({ plataforma, aoFechar, aoCriar }: { plataforma?: Plataforma; aoFechar: () => void; aoCriar?: (id: number) => void }) {
  const produtos = useProdutos()
  const [nome, setNome] = useState(plataforma?.nome ?? '')
  const [descricao, setDescricao] = useState(plataforma?.descricao ?? '')
  const [produtoId, setProdutoId] = useState<number | undefined>(plataforma?.produtoId)
  const [link, setLink] = useState(plataforma?.link ?? '')
  const [emailConta, setEmailConta] = useState(plataforma?.emailConta ?? '')
  const [plano, setPlano] = useState(plataforma?.plano ?? '')
  const [status, setStatus] = useState<StatusPlataforma>(plataforma?.status ?? 'ativa')
  const [observacoes, setObservacoes] = useState(plataforma?.observacoes ?? '')
  const [erro, setErro] = useState('')
  async function salvar() {
    if (!nome.trim()) return setErro('Dê um nome para a plataforma.')
    const registro: Plataforma = {
      ...(plataforma ?? {}),
      nome: nome.trim(),
      descricao: descricao.trim(),
      produtoId: produtoId || undefined,
      link: link.trim() || undefined,
      emailConta: emailConta.trim() || undefined,
      plano: plano.trim() || undefined,
      status,
      observacoes: observacoes.trim() || undefined,
    }
    const id = (await db.plataformas.put(registro)) as number
    if (!plataforma && aoCriar) aoCriar(id)
    else aoFechar()
  }

  async function excluir() {
    if (!plataforma?.id) return
    await db.transaction('rw', db.plataformas, db.cobrancas, db.pagamentosCobranca, async () => {
      const ids = (await db.cobrancas.where({ plataformaId: plataforma.id! }).toArray()).map((c) => c.id!)
      await db.pagamentosCobranca.where('cobrancaId').anyOf(ids).delete()
      await db.cobrancas.where({ plataformaId: plataforma.id! }).delete()
      await db.plataformas.delete(plataforma.id!)
    })
    aoFechar()
  }

  return (
    <Folha titulo={plataforma ? 'Editar plataforma' : 'Nova plataforma'} aoFechar={aoFechar}>
      <Campo rotulo="Nome">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Render" maxLength={40} autoFocus={!plataforma} />
      </Campo>
      <Campo rotulo="Para que serve">
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Hospedagem do site" maxLength={80} />
      </Campo>
      {produtos.length > 0 && <Campo rotulo="Produto">
        <Opcoes rotulo="Produto" opcoes={[{ valor: 0, rotulo: 'Geral' }, ...produtos.map((p) => ({ valor: p.id!, rotulo: p.nome }))]} valor={produtoId ?? 0} aoMudar={setProdutoId} />
      </Campo>}
      <Campo rotulo="Status">
        <Opcoes
          rotulo="Status"
          opcoes={(Object.keys(NOME_STATUS) as StatusPlataforma[]).map((s) => ({ valor: s, rotulo: NOME_STATUS[s][0] }))}
          valor={status}
          aoMudar={setStatus}
        />
      </Campo>
      <Campo rotulo="Link do painel">
        <input type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
      </Campo>
      <Campo rotulo="E-mail da conta" dica="Não guarde senhas aqui: use um gerenciador de senhas.">
        <input type="email" inputMode="email" value={emailConta} onChange={(e) => setEmailConta(e.target.value)} placeholder="contato@suaempresa.com.br" />
      </Campo>
      <Campo rotulo="Plano">
        <input value={plano} onChange={(e) => setPlano(e.target.value)} placeholder="Ex.: Free, Pro, Mail Lite…" maxLength={60} />
      </Campo>
      <Campo rotulo="Observações">
        <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} maxLength={500} />
      </Campo>
      {erro && <p className="aviso aviso-erro">{erro}</p>}
      <button className="botao botao-principal" onClick={salvar}>{plataforma ? 'Salvar' : 'Criar e adicionar cobrança'}</button>
      {plataforma && <Confirmacao rotulo="Excluir plataforma" texto={`Excluir “${plataforma.nome}”, com todas as cobranças e pagamentos?`} aoConfirmar={excluir} />}
    </Folha>
  )
}

/* ---------- Cobrança ---------- */

export function FormCobranca({ plataformaId, cobranca, aoFechar }: { plataformaId: number; cobranca?: Cobranca; aoFechar: () => void }) {
  const padrao = usePagoPorMimPadrao()
  const [tipo, setTipo] = useState<TipoCobranca>(cobranca?.tipo ?? 'mensal')
  const [moeda, setMoeda] = useState<'BRL' | 'USD'>(cobranca?.moeda ?? 'BRL')
  const [textoValor, setTextoValor] = useState(valorParaTexto(cobranca?.tipo === 'uso' ? cobranca.limiteEsperado : cobranca?.valor))
  const [proxima, setProxima] = useState(cobranca?.proximaRenovacao ?? '')
  const [automatica, setAutomatica] = useState(cobranca?.renovacaoAutomatica ?? true)
  const [forma, setForma] = useState(cobranca?.formaPagamento ?? '')
  const [pagoPorMim, setPagoPorMim] = useState<boolean | undefined>(cobranca?.pagoPorMim)
  const [erro, setErro] = useState('')
  const recorrente = tipo === 'mensal' || tipo === 'anual'

  async function salvar() {
    const valor = tipo === 'gratis' ? 0 : lerValor(textoValor)
    if (tipo !== 'uso' && tipo !== 'gratis' && (valor === null || valor < 0)) return setErro('Informe o valor.')
    const registro: Cobranca = {
      ...(cobranca ?? {}),
      plataformaId,
      tipo,
      moeda,
      valor: tipo === 'uso' ? 0 : valor ?? 0,
      limiteEsperado: tipo === 'uso' && valor ? valor : undefined,
      proximaRenovacao: recorrente && proxima ? proxima : undefined,
      renovacaoAutomatica: automatica,
      formaPagamento: forma.trim() || undefined,
      pagoPorMim: pagoPorMim ?? padrao,
    }
    await db.cobrancas.put(registro)
    aoFechar()
  }

  async function excluir() {
    if (!cobranca?.id) return
    await db.transaction('rw', db.cobrancas, db.pagamentosCobranca, async () => {
      await db.pagamentosCobranca.where({ cobrancaId: cobranca.id! }).delete()
      await db.cobrancas.delete(cobranca.id!)
    })
    aoFechar()
  }

  return (
    <Folha titulo={cobranca ? 'Editar cobrança' : 'Nova cobrança'} aoFechar={aoFechar}>
      <Campo rotulo="Tipo">
        <Opcoes rotulo="Tipo" opcoes={(Object.keys(NOME_TIPO) as TipoCobranca[]).map((t) => ({ valor: t, rotulo: NOME_TIPO[t] }))} valor={tipo} aoMudar={setTipo} />
      </Campo>
      {tipo !== 'gratis' && (
        <>
          <Campo rotulo="Moeda">
            <Opcoes rotulo="Moeda" opcoes={[{ valor: 'BRL' as const, rotulo: 'R$' }, { valor: 'USD' as const, rotulo: 'US$' }]} valor={moeda} aoMudar={setMoeda} />
          </Campo>
          <Campo rotulo={tipo === 'uso' ? 'Limite esperado por mês (opcional)' : tipo === 'anual' ? 'Valor por ano' : tipo === 'mensal' ? 'Valor por mês' : 'Valor'}>
            <input inputMode="numeric" placeholder="0,00" value={textoValor} onChange={(e) => setTextoValor(mascararValor(e.target.value))} />
          </Campo>
        </>
      )}
      {recorrente && (
        <>
          <Campo rotulo="Próxima renovação">
            <input type="date" value={proxima} onChange={(e) => setProxima(e.target.value)} />
          </Campo>
          <Interruptor rotulo="Renova sozinha" dica="Desligado = renovação manual (ex.: Pix). O app avisa 45 dias antes." ligado={automatica} aoMudar={setAutomatica} />
        </>
      )}
      {tipo !== 'gratis' && (
        <>
          <Campo rotulo="Forma de pagamento">
            <input value={forma} onChange={(e) => setForma(e.target.value)} placeholder="Ex.: Pix, cartão Nubank" maxLength={40} />
          </Campo>
          <Interruptor rotulo="Pago por mim, a reembolsar" dica="Pago do meu bolso enquanto a empresa não tem conta própria." ligado={pagoPorMim ?? padrao} aoMudar={setPagoPorMim} />
        </>
      )}
      {erro && <p className="aviso aviso-erro">{erro}</p>}
      <button className="botao botao-principal" onClick={salvar}>Salvar</button>
      {cobranca && <Confirmacao rotulo="Excluir cobrança" texto="Excluir esta cobrança e os pagamentos dela?" aoConfirmar={excluir} />}
    </Folha>
  )
}

/* ---------- Pagamento de cobrança ---------- */

export function FormPagamento({ cobranca, nome, aoFechar }: { cobranca: Cobranca & { id: number }; nome: string; aoFechar: () => void }) {
  const cotacao = useLiveQuery(lerCotacao, [], undefined)
  const sugestao = cobranca.tipo === 'uso' ? undefined : cobranca.valor || undefined
  const [textoOriginal, setTextoOriginal] = useState(cobranca.moeda === 'USD' ? valorParaTexto(sugestao) : '')
  const [textoReais, setTextoReais] = useState<string | null>(cobranca.moeda === 'BRL' ? valorParaTexto(sugestao) : null)
  const [data, setData] = useState(hoje())
  const [origem, setOrigem] = useState<OrigemPagamento>(cobranca.pagoPorMim ? 'bolso' : 'caixa')
  const [cartaoId, setCartaoId] = useState<number | undefined>()
  const [comprovante, setComprovante] = useState('')
  const [erro, setErro] = useState('')

  const dolares = cobranca.moeda === 'USD' ? lerValor(textoOriginal) : null
  // Em dólar, sugere o valor em reais pela cotação até a pessoa digitar o valor real cobrado.
  const reaisSugeridos = dolares && cotacao ? valorParaTexto(emReais(dolares, 'USD', cotacao)) : ''
  const textoReaisFinal = textoReais ?? reaisSugeridos
  const proxima = cobranca.tipo === 'mensal' || cobranca.tipo === 'anual' ? proximaData(cobranca, data) : undefined

  async function salvar() {
    const valor = lerValor(textoReaisFinal)
    if (!valor || valor <= 0) return setErro('Informe o valor pago em reais.')
    if (origem === 'cartao-pessoal' && !cartaoId) return setErro('Escolha o cartão.')
    await registrarPagamentoCobranca(cobranca, nome, {
      valor,
      valorOriginal: dolares ?? undefined,
      pagoEm: data,
      origem,
      cartaoId,
      comprovante: comprovante.trim() || undefined,
    })
    aoFechar()
  }

  return (
    <Folha titulo={`Pagamento: ${nome}`} aoFechar={aoFechar}>
      {cobranca.moeda === 'USD' && (
        <Campo rotulo="Valor em US$">
          <input inputMode="numeric" placeholder="0,00" value={textoOriginal} onChange={(e) => setTextoOriginal(mascararValor(e.target.value))} autoFocus />
        </Campo>
      )}
      <Campo rotulo="Valor pago em R$" dica={cobranca.moeda === 'USD' ? 'Use o valor que veio na fatura do cartão (já com IOF).' : undefined}>
        <input inputMode="numeric" placeholder="0,00" value={textoReaisFinal} onChange={(e) => setTextoReais(mascararValor(e.target.value))} autoFocus={cobranca.moeda === 'BRL'} />
      </Campo>
      <Campo rotulo="Data do pagamento">
        <input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
      </Campo>
      <SeletorOrigem origem={origem} aoMudar={setOrigem} cartaoId={cartaoId} aoMudarCartao={setCartaoId} />
      <Campo rotulo="Onde está o comprovante">
        <input value={comprovante} onChange={(e) => setComprovante(e.target.value)} placeholder="Ex.: e-mail da plataforma, pasta no Drive" maxLength={120} />
      </Campo>
      {proxima && <p className="texto-suave">A próxima renovação passa para {formatarDia(proxima)}.</p>}
      {erro && <p className="aviso aviso-erro">{erro}</p>}
      <button className="botao botao-principal" onClick={salvar}>Registrar pagamento</button>
    </Folha>
  )
}

/* ---------- Gasto avulso da empresa ---------- */

export function FormGastoEmpresa({ gasto, aoFechar }: { gasto?: GastoEmpresa; aoFechar: () => void }) {
  const produtos = useProdutos()
  const padrao = useOrigemPadrao()
  const [textoValor, setTextoValor] = useState(valorParaTexto(gasto?.valor))
  const [descricao, setDescricao] = useState(gasto?.descricao ?? '')
  const [produtoId, setProdutoId] = useState<number | undefined>(gasto?.produtoId)
  const [categoriaId, setCategoriaId] = useState<number | undefined>(gasto?.categoriaId)
  const [data, setData] = useState(gasto?.data ?? hoje())
  const [origemEscolhida, setOrigem] = useState<OrigemPagamento | undefined>(gasto ? origemDe(gasto) : undefined)
  const origem = origemEscolhida ?? padrao
  const [cartaoId, setCartaoId] = useState<number | undefined>(gasto?.cartaoId)
  const [comprovante, setComprovante] = useState(gasto?.comprovante ?? '')
  const [erro, setErro] = useState('')
  async function salvar() {
    const valor = lerValor(textoValor)
    if (!valor || valor <= 0) return setErro('Informe o valor.')
    if (!categoriaId) return setErro('Escolha a categoria.')
    if (origem === 'cartao-pessoal' && !cartaoId) return setErro('Escolha o cartão.')
    await salvarGastoEmpresa({
      ...(gasto ?? {}),
      valor,
      descricao: descricao.trim() || 'Gasto',
      produtoId: produtoId || undefined,
      categoriaId,
      data,
      pagoPorMim: false,
      comprovante: comprovante.trim() || undefined,
    }, origem, cartaoId)
    aoFechar()
  }

  return (
    <Folha titulo={gasto ? 'Editar gasto da empresa' : 'Novo gasto da empresa'} aoFechar={aoFechar}>
      <div className="campo-valor">
        <span>R$</span>
        <input autoFocus={!gasto} inputMode="numeric" placeholder="0,00" value={textoValor} onChange={(e) => setTextoValor(mascararValor(e.target.value))} aria-label="Valor" />
      </div>
      <Campo rotulo="Descrição">
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Taxa da junta comercial" maxLength={60} />
      </Campo>
      {produtos.length > 0 && <Campo rotulo="Produto">
        <Opcoes rotulo="Produto" opcoes={[{ valor: 0, rotulo: 'Geral' }, ...produtos.map((p) => ({ valor: p.id!, rotulo: p.nome }))]} valor={produtoId ?? 0} aoMudar={setProdutoId} />
      </Campo>}
      <Campo rotulo="Categoria">
        <SeletorCategoria modo="empresa" valor={categoriaId} aoMudar={setCategoriaId} />
      </Campo>
      <Campo rotulo="Data">
        <input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
      </Campo>
      <SeletorOrigem origem={origem} aoMudar={setOrigem} cartaoId={cartaoId} aoMudarCartao={setCartaoId} />
      <Campo rotulo="Onde está o comprovante">
        <input value={comprovante} onChange={(e) => setComprovante(e.target.value)} maxLength={120} />
      </Campo>
      {erro && <p className="aviso aviso-erro">{erro}</p>}
      <button className="botao botao-principal" onClick={salvar}>Salvar</button>
      {gasto?.id && (
        <Confirmacao
          rotulo="Excluir gasto"
          texto={`Excluir “${gasto.descricao}” de ${formatarReais(gasto.valor)}?`}
          aoConfirmar={async () => { await apagarGastoEmpresa(gasto); aoFechar() }}
        />
      )}
    </Folha>
  )
}

/* ---------- Retirada ---------- */

export function FormRetirada({ retirada, aoFechar }: { retirada?: Retirada; aoFechar: () => void }) {
  const [textoValor, setTextoValor] = useState(valorParaTexto(retirada?.valor))
  const [data, setData] = useState(retirada?.data ?? hoje())
  const [observacao, setObservacao] = useState(retirada?.observacao ?? '')
  const [erro, setErro] = useState('')

  async function salvar() {
    const valor = lerValor(textoValor)
    if (!valor || valor <= 0) return setErro('Informe o valor.')
    await db.retiradas.put({ ...(retirada ?? {}), valor, data, observacao: observacao.trim() || undefined })
    aoFechar()
  }

  return (
    <Folha titulo={retirada ? 'Editar retirada' : 'Nova retirada'} aoFechar={aoFechar}>
      <div className="campo-valor">
        <span>R$</span>
        <input autoFocus={!retirada} inputMode="numeric" placeholder="0,00" value={textoValor} onChange={(e) => setTextoValor(mascararValor(e.target.value))} aria-label="Valor" />
      </div>
      <Campo rotulo="Data">
        <input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
      </Campo>
      <Campo rotulo="Observação">
        <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: pró-labore de novembro" maxLength={80} />
      </Campo>
      {erro && <p className="aviso aviso-erro">{erro}</p>}
      <button className="botao botao-principal" onClick={salvar}>Salvar</button>
      {retirada?.id && (
        <Confirmacao rotulo="Excluir retirada" texto="Excluir esta retirada?" aoConfirmar={async () => { await db.retiradas.delete(retirada.id!); aoFechar() }} />
      )}
    </Folha>
  )
}
