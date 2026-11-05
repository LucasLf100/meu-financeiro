import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Entrada, type RecebimentoFixo } from '../db'
import { formatarReais, lerValor } from '../dinheiro'
import { diaDoMes, formatarDia, formatarDiaCurto, hoje, mesAtual, mesDe, nomeMes, prazo, somarMeses } from '../datas'
import { encerrarRecebimento, recebimentosDoMes, type OcorrenciaRecebimento } from '../regras/recebimentos'
import { BarraProgresso, Campo, Etiqueta, Folha, SeletorMes, Vazio, valorParaTexto, mascararValor } from '../componentes/ui'

export function Recebimentos() {
  const [mes, setMes] = useState(mesAtual())
  const dados = useLiveQuery(() => recebimentosDoMes(mes), [mes])
  const [aberto, setAberto] = useState<OcorrenciaRecebimento | null>(null)
  const [novoFixo, setNovoFixo] = useState(false)
  const [entrada, setEntrada] = useState<Entrada | 'nova' | null>(null)

  if (!dados) return null
  const { fixos, avulsos, previsto, recebido } = dados

  return (
    <div className="tela">
      <SeletorMes mes={mes} aoMudar={setMes} />

      <section className="bloco">
        <div className="linha-resumo">
          <div>
            <span className="rotulo texto-suave">Entradas do mês</span>
            <strong className="valor-medio">{formatarReais(previsto)}</strong>
          </div>
          <div className="direita">
            <span className="rotulo texto-suave">Falta receber</span>
            <strong>{formatarReais(previsto - recebido)}</strong>
          </div>
        </div>
        <BarraProgresso valor={recebido} total={previsto} />
        <small className="texto-suave">{formatarReais(recebido)} já recebidos</small>
      </section>

      <section className="grupo">
        <h3 className="grupo-titulo"><span>Recebimentos fixos</span></h3>
        {fixos.length === 0 ? (
          <p className="texto-suave">Cadastre o que entra todo mês, como o salário.</p>
        ) : (
          <div className="lista">
            {fixos.map((o) => (
              <button key={o.recebimento.id} className="item" onClick={() => setAberto(o)}>
                <span className="item-icone">💰</span>
                <span className="item-texto">
                  <strong>{o.recebimento.nome}</strong>
                  <small>{o.entrada ? `Recebido em ${formatarDiaCurto(o.entrada.data)}` : `Previsto para ${formatarDiaCurto(o.data)}`}</small>
                </span>
                <span className="item-direita">
                  <strong className="item-valor texto-ok">{formatarReais(o.valor)}</strong>
                  {o.status === 'recebido' ? <Etiqueta tipo="ok">Recebido</Etiqueta> : o.status === 'atrasado' ? <Etiqueta tipo="alerta">Não caiu</Etiqueta> : <Etiqueta tipo="neutra">A receber</Etiqueta>}
                </span>
              </button>
            ))}
          </div>
        )}
        <button className="botao" onClick={() => setNovoFixo(true)}>+ Recebimento fixo</button>
      </section>

      <section className="grupo">
        <h3 className="grupo-titulo"><span>Outros valores do mês</span></h3>
        {avulsos.length === 0 ? (
          <Vazio icone="➕" titulo="Nenhum valor extra" texto="Freela, venda, reembolso, presente… lance aqui o que entrou fora dos fixos." />
        ) : (
          <div className="lista">
            {avulsos.map((e) => (
              <button key={e.id} className="item" onClick={() => setEntrada(e)}>
                <span className="item-icone">➕</span>
                <span className="item-texto">
                  <strong>{e.descricao}</strong>
                  <small>{formatarDiaCurto(e.data)}</small>
                </span>
                <strong className="item-valor texto-ok">{formatarReais(e.valor)}</strong>
              </button>
            ))}
          </div>
        )}
        <button className="botao" onClick={() => setEntrada('nova')}>+ Valor recebido no mês</button>
      </section>

      {aberto && <AcoesRecebimento ocorrencia={aberto} mes={mes} aoFechar={() => setAberto(null)} />}
      {novoFixo && <FormRecebimento mes={mes} aoFechar={() => setNovoFixo(false)} />}
      {entrada && <FormEntrada entrada={entrada === 'nova' ? undefined : entrada} mes={mes} aoFechar={() => setEntrada(null)} />}
    </div>
  )
}

function AcoesRecebimento({ ocorrencia, mes, aoFechar }: { ocorrencia: OcorrenciaRecebimento; mes: string; aoFechar: () => void }) {
  const { recebimento, entrada } = ocorrencia
  const [textoValor, setTextoValor] = useState(valorParaTexto(ocorrencia.valor))
  const [data, setData] = useState(ocorrencia.data <= hoje() ? ocorrencia.data : hoje())
  const [editando, setEditando] = useState(false)
  const [encerrando, setEncerrando] = useState(false)
  const [erro, setErro] = useState('')

  async function confirmar() {
    const valor = lerValor(textoValor)
    if (!valor || valor <= 0) return setErro('Informe o valor recebido.')
    await db.entradas.add({ recebimentoId: recebimento.id, competencia: mes, descricao: recebimento.nome, valor, data })
    aoFechar()
  }

  if (editando) return <FormRecebimento recebimento={recebimento} mes={mes} aoFechar={aoFechar} />

  return (
    <Folha titulo={recebimento.nome} aoFechar={aoFechar}>
      <p className="linha-info">{nomeMes(mes)} · previsto para {formatarDia(ocorrencia.data)} ({prazo(ocorrencia.data)})</p>
      {entrada ? (
        <>
          <p className="linha-info">Recebido em {formatarDia(entrada.data)}: <strong>{formatarReais(entrada.valor)}</strong></p>
          <button className="botao" onClick={async () => { await db.entradas.delete(entrada.id!); aoFechar() }}>Desmarcar recebimento</button>
        </>
      ) : (
        <>
          <div className="linha-campos">
            <Campo rotulo="Valor recebido" dica="Se veio diferente (hora extra, desconto), ajuste aqui.">
              <input inputMode="numeric" value={textoValor} onChange={(e) => setTextoValor(mascararValor(e.target.value))} />
            </Campo>
            <Campo rotulo="Data">
              <input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
            </Campo>
          </div>
          {erro && <p className="aviso aviso-erro">{erro}</p>}
          <button className="botao botao-principal" onClick={confirmar}>Marcar como recebido</button>
        </>
      )}
      <button className="botao" onClick={() => setEditando(true)}>Editar recebimento</button>
      {!encerrando ? (
        <button className="botao botao-texto-perigo" onClick={() => setEncerrando(true)}>Encerrar</button>
      ) : (
        <div className="confirmacao">
          <p>Parar de contar “{recebimento.nome}” a partir de {nomeMes(mes)}? O que já entrou continua no histórico.</p>
          <div className="linha-campos">
            <button className="botao" onClick={() => setEncerrando(false)}>Cancelar</button>
            <button className="botao botao-perigo" onClick={async () => { await encerrarRecebimento(recebimento, mes, somarMeses(mes, -1)); aoFechar() }}>Encerrar</button>
          </div>
        </div>
      )}
    </Folha>
  )
}

function FormRecebimento({ recebimento, mes, aoFechar }: { recebimento?: RecebimentoFixo; mes: string; aoFechar: () => void }) {
  const [nome, setNome] = useState(recebimento?.nome ?? '')
  const [textoValor, setTextoValor] = useState(valorParaTexto(recebimento?.valor))
  const [dia, setDia] = useState(recebimento?.dia ?? 5)
  const [erro, setErro] = useState('')

  async function salvar() {
    const valor = lerValor(textoValor)
    if (!nome.trim()) return setErro('Dê um nome, por exemplo “Salário”.')
    if (!valor || valor <= 0) return setErro('Informe o valor.')
    if (dia < 1 || dia > 31) return setErro('O dia vai de 1 a 31.')
    await db.recebimentos.put({ ...(recebimento ?? { inicio: mes, ativa: 1 as const }), nome: nome.trim(), valor, dia })
    aoFechar()
  }

  return (
    <Folha titulo={recebimento ? 'Editar recebimento fixo' : 'Novo recebimento fixo'} aoFechar={aoFechar}>
      <Campo rotulo="Nome">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Salário" maxLength={40} autoFocus={!recebimento} />
      </Campo>
      <div className="linha-campos">
        <Campo rotulo="Valor">
          <input inputMode="numeric" placeholder="0,00" value={textoValor} onChange={(e) => setTextoValor(mascararValor(e.target.value))} />
        </Campo>
        <Campo rotulo="Dia que cai">
          <input type="number" inputMode="numeric" min={1} max={31} value={dia} onChange={(e) => setDia(Number(e.target.value))} />
        </Campo>
      </div>
      <p className="texto-suave">
        {recebimento ? 'A mudança vale para os meses ainda não recebidos.' : `Começa a contar em ${nomeMes(mes)}, no dia ${diaDoMes(mes, dia).slice(8)}.`}
      </p>
      {erro && <p className="aviso aviso-erro">{erro}</p>}
      <button className="botao botao-principal" onClick={salvar}>Salvar</button>
    </Folha>
  )
}

function FormEntrada({ entrada, mes, aoFechar }: { entrada?: Entrada; mes: string; aoFechar: () => void }) {
  const [textoValor, setTextoValor] = useState(valorParaTexto(entrada?.valor))
  const [descricao, setDescricao] = useState(entrada?.descricao ?? '')
  const [data, setData] = useState(entrada?.data ?? (mes === mesAtual() ? hoje() : `${mes}-01`))
  const [erro, setErro] = useState('')

  async function salvar() {
    const valor = lerValor(textoValor)
    if (!valor || valor <= 0) return setErro('Informe o valor.')
    await db.entradas.put({ ...(entrada ?? {}), descricao: descricao.trim() || 'Recebimento', valor, data, competencia: mesDe(data) })
    aoFechar()
  }

  return (
    <Folha titulo={entrada ? 'Editar valor recebido' : 'Valor recebido no mês'} aoFechar={aoFechar}>
      <div className="campo-valor">
        <span>R$</span>
        <input autoFocus={!entrada} inputMode="numeric" placeholder="0,00" value={textoValor} onChange={(e) => setTextoValor(mascararValor(e.target.value))} aria-label="Valor" />
      </div>
      <Campo rotulo="Descrição">
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Freela site" maxLength={60} />
      </Campo>
      <Campo rotulo="Data">
        <input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
      </Campo>
      {erro && <p className="aviso aviso-erro">{erro}</p>}
      <button className="botao botao-principal" onClick={salvar}>Salvar</button>
      {entrada?.id && (
        <button className="botao botao-texto-perigo" onClick={async () => { await db.entradas.delete(entrada.id!); aoFechar() }}>Excluir</button>
      )}
    </Folha>
  )
}
