import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ClienteEmpresa, type EntradaEmpresa } from '../../db'
import { formatarReais, lerValor } from '../../dinheiro'
import { diaDoMes, formatarDia, formatarDiaCurto, hoje, mesAtual, mesDe, nomeMes } from '../../datas'
import { encerrarCliente, entradasEmpresaDoMes, type OcorrenciaCliente } from '../../regras/empresaMes'
import { Campo, Folha, Opcoes, SeletorMes, Vazio, mascararValor, valorParaTexto } from '../../componentes/ui'

function useProdutos() {
  return useLiveQuery(() => db.produtos.toArray(), [], [])
}

function SeletorProduto({ valor, aoMudar }: { valor?: number; aoMudar: (id: number | undefined) => void }) {
  const produtos = useProdutos()
  if (!produtos.length) return null
  return (
    <Campo rotulo="Produto">
      <Opcoes rotulo="Produto" opcoes={[{ valor: 0, rotulo: 'Geral' }, ...produtos.map((p) => ({ valor: p.id!, rotulo: p.nome }))]} valor={valor ?? 0} aoMudar={(v) => aoMudar(v || undefined)} />
    </Campo>
  )
}

export function Entradas() {
  const [mes, setMes] = useState(mesAtual())
  const dados = useLiveQuery(() => entradasEmpresaDoMes(mes), [mes])
  const produtos = useProdutos()
  const [recebendo, setRecebendo] = useState<OcorrenciaCliente | null>(null)
  const [cliente, setCliente] = useState<ClienteEmpresa | 'novo' | null>(null)
  const [avulsa, setAvulsa] = useState<EntradaEmpresa | 'nova' | null>(null)

  if (!dados) return null
  const { recorrentes, avulsas, previsto, recebido } = dados
  const nomeProduto = (id?: number) => produtos.find((p) => p.id === id)?.nome

  return (
    <div className="tela">
      <SeletorMes mes={mes} aoMudar={setMes} />

      <section className="cartao-destaque cartao-entradas">
        <span className="rotulo">Entrou em {nomeMes(mes)}</span>
        <strong className="valor-grande">{formatarReais(recebido)}</strong>
        <div className="divisao">
          <div>
            <span className="rotulo">Previsto no mês</span>
            <strong>{formatarReais(previsto)}</strong>
          </div>
          <div>
            <span className="rotulo">Falta receber</span>
            <strong>{formatarReais(previsto - recebido)}</strong>
          </div>
        </div>
      </section>

      <section className="bloco">
        <div className="linha-resumo">
          <h2>Clientes e contratos</h2>
          <button className="botao-link" onClick={() => setCliente('novo')}>+ Cliente</button>
        </div>
        {recorrentes.length === 0 ? (
          <p className="texto-suave">Quem paga todo mês (assinaturas, contratos). O app lembra de cada recebimento.</p>
        ) : (
          <div className="lista">
            {recorrentes.map((o) => (
              <div key={o.cliente.id} className="item item-estatico">
                <button className="item-texto botao-sem-estilo" onClick={() => setCliente(o.cliente)}>
                  <strong>{o.cliente.nome}</strong>
                  <small className={o.status === 'atrasado' ? 'texto-perigo' : ''}>
                    {o.entrada ? `recebido ${formatarDiaCurto(o.entrada.data)}` : `dia ${formatarDiaCurto(o.data)}`}
                    {nomeProduto(o.cliente.produtoId) ? ` · ${nomeProduto(o.cliente.produtoId)}` : ''}
                  </small>
                </button>
                <span className="item-direita">
                  <strong className="item-valor">{formatarReais(o.valor)}</strong>
                  {o.entrada ? (
                    <button className="botao-link texto-suave" onClick={() => db.entradasEmpresa.delete(o.entrada!.id!)}>Desfazer</button>
                  ) : (
                    <button className="botao-link" onClick={() => setRecebendo(o)}>Recebi</button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bloco">
        <div className="linha-resumo">
          <h2>Avulsas</h2>
          <button className="botao-link" onClick={() => setAvulsa('nova')}>+ Entrada</button>
        </div>
        {avulsas.length === 0 ? (
          <p className="texto-suave">Vendas, serviços e outros valores que entraram uma vez.</p>
        ) : (
          <div className="lista">
            {avulsas.map((e) => (
              <button key={e.id} className="item" onClick={() => setAvulsa(e)}>
                <span className="item-icone" style={{ background: 'var(--ok-fundo)' }}>💰</span>
                <span className="item-texto">
                  <strong>{e.descricao}</strong>
                  <small>{formatarDiaCurto(e.data)}{nomeProduto(e.produtoId) ? ` · ${nomeProduto(e.produtoId)}` : ''}</small>
                </span>
                <strong className="item-valor texto-ok">+{formatarReais(e.valor)}</strong>
              </button>
            ))}
          </div>
        )}
      </section>

      {recorrentes.length === 0 && avulsas.length === 0 && (
        <Vazio icone="📈" titulo="Nenhuma entrada neste mês" texto="Cadastre um cliente que paga todo mês ou lance uma entrada avulsa." />
      )}

      {recebendo && <FormRecebido ocorrencia={recebendo} mes={mes} aoFechar={() => setRecebendo(null)} />}
      {cliente && <FormCliente cliente={cliente === 'novo' ? undefined : cliente} mes={mes} aoFechar={() => setCliente(null)} />}
      {avulsa && <FormEntradaAvulsa entrada={avulsa === 'nova' ? undefined : avulsa} mes={mes} aoFechar={() => setAvulsa(null)} />}
    </div>
  )
}

/** Data padrão para lançar algo no mês que está aberto na tela. */
function dataNoMes(mes: string) {
  return mesDe(hoje()) === mes ? hoje() : diaDoMes(mes, 1)
}

function FormRecebido({ ocorrencia, mes, aoFechar }: { ocorrencia: OcorrenciaCliente; mes: string; aoFechar: () => void }) {
  const [textoValor, setTextoValor] = useState(valorParaTexto(ocorrencia.valor))
  const [data, setData] = useState(mesDe(hoje()) === mes ? hoje() : ocorrencia.data)
  const [erro, setErro] = useState('')
  async function salvar() {
    const valor = lerValor(textoValor)
    if (!valor || valor <= 0) return setErro('Informe o valor recebido.')
    await db.entradasEmpresa.add({
      clienteId: ocorrencia.cliente.id,
      competencia: mes,
      descricao: ocorrencia.cliente.nome,
      valor,
      data,
      produtoId: ocorrencia.cliente.produtoId,
    })
    aoFechar()
  }
  return (
    <Folha titulo={`Recebi: ${ocorrencia.cliente.nome}`} aoFechar={aoFechar}>
      <div className="campo-valor">
        <span>R$</span>
        <input autoFocus inputMode="numeric" placeholder="0,00" value={textoValor} onChange={(e) => setTextoValor(mascararValor(e.target.value))} aria-label="Valor" />
      </div>
      <Campo rotulo="Data do recebimento">
        <input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
      </Campo>
      <p className="texto-suave">Referente a {nomeMes(mes)}.</p>
      {erro && <p className="aviso aviso-erro">{erro}</p>}
      <button className="botao botao-principal" onClick={salvar}>Confirmar recebimento</button>
    </Folha>
  )
}

function FormCliente({ cliente, mes, aoFechar }: { cliente?: ClienteEmpresa; mes: string; aoFechar: () => void }) {
  const [nome, setNome] = useState(cliente?.nome ?? '')
  const [textoValor, setTextoValor] = useState(valorParaTexto(cliente?.valor))
  const [dia, setDia] = useState(String(cliente?.dia ?? 10))
  const [produtoId, setProdutoId] = useState<number | undefined>(cliente?.produtoId)
  const [inicio, setInicio] = useState(cliente?.inicio ?? mes)
  const [encerrando, setEncerrando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    const valor = lerValor(textoValor)
    const d = Number(dia)
    if (!nome.trim()) return setErro('Dê um nome para o cliente.')
    if (!valor || valor <= 0) return setErro('Informe o valor por mês.')
    if (!d || d < 1 || d > 31) return setErro('Dia entre 1 e 31.')
    await db.clientes.put({ ...(cliente ?? {}), nome: nome.trim(), valor, dia: d, produtoId, inicio, ativa: 1 })
    aoFechar()
  }

  return (
    <Folha titulo={cliente ? 'Editar cliente' : 'Novo cliente'} aoFechar={aoFechar}>
      <Campo rotulo="Nome">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Studio Ana (plano Pro)" maxLength={50} autoFocus={!cliente} />
      </Campo>
      <div className="campo-valor">
        <span>R$</span>
        <input inputMode="numeric" placeholder="0,00" value={textoValor} onChange={(e) => setTextoValor(mascararValor(e.target.value))} aria-label="Valor por mês" />
      </div>
      <div className="linha-campos">
        <Campo rotulo="Dia que paga">
          <input inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, '').slice(0, 2))} />
        </Campo>
        <Campo rotulo="A partir de">
          <input type="month" value={inicio} onChange={(e) => e.target.value && setInicio(e.target.value)} />
        </Campo>
      </div>
      <SeletorProduto valor={produtoId} aoMudar={setProdutoId} />
      {cliente?.fim && <p className="texto-suave">Encerrado depois de {nomeMes(cliente.fim)}.</p>}
      {erro && <p className="aviso aviso-erro">{erro}</p>}
      <button className="botao botao-principal" onClick={salvar}>Salvar</button>
      {cliente?.id && !encerrando && <button className="botao botao-texto-perigo" onClick={() => setEncerrando(true)}>Encerrar contrato</button>}
      {cliente?.id && encerrando && (
        <div className="confirmacao">
          <p>Parar de esperar pagamento de “{cliente.nome}” a partir de {nomeMes(mes)}? Os meses anteriores continuam no histórico.</p>
          <div className="linha-campos">
            <button className="botao" onClick={() => setEncerrando(false)}>Cancelar</button>
            <button className="botao botao-perigo" onClick={async () => { await encerrarCliente(cliente as ClienteEmpresa & { id: number }, mes); aoFechar() }}>Encerrar</button>
          </div>
        </div>
      )}
    </Folha>
  )
}

function FormEntradaAvulsa({ entrada, mes, aoFechar }: { entrada?: EntradaEmpresa; mes: string; aoFechar: () => void }) {
  const [textoValor, setTextoValor] = useState(valorParaTexto(entrada?.valor))
  const [descricao, setDescricao] = useState(entrada?.descricao ?? '')
  const [data, setData] = useState(entrada?.data ?? dataNoMes(mes))
  const [produtoId, setProdutoId] = useState<number | undefined>(entrada?.produtoId)
  const [erro, setErro] = useState('')
  async function salvar() {
    const valor = lerValor(textoValor)
    if (!valor || valor <= 0) return setErro('Informe o valor.')
    await db.entradasEmpresa.put({ ...(entrada ?? {}), valor, descricao: descricao.trim() || 'Entrada', data, competencia: mesDe(data), produtoId })
    aoFechar()
  }
  return (
    <Folha titulo={entrada ? 'Editar entrada' : 'Nova entrada da empresa'} aoFechar={aoFechar}>
      <div className="campo-valor">
        <span>R$</span>
        <input autoFocus={!entrada} inputMode="numeric" placeholder="0,00" value={textoValor} onChange={(e) => setTextoValor(mascararValor(e.target.value))} aria-label="Valor" />
      </div>
      <Campo rotulo="Descrição">
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Venda de licença, projeto avulso" maxLength={60} />
      </Campo>
      <Campo rotulo="Data">
        <input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
      </Campo>
      <SeletorProduto valor={produtoId} aoMudar={setProdutoId} />
      {erro && <p className="aviso aviso-erro">{erro}</p>}
      <button className="botao botao-principal" onClick={salvar}>Salvar</button>
      {entrada?.id && (
        <button className="botao botao-texto-perigo" onClick={async () => { await db.entradasEmpresa.delete(entrada.id!); aoFechar() }}>
          Excluir entrada de {formatarDia(entrada.data)}
        </button>
      )}
    </Folha>
  )
}

export { FormEntradaAvulsa, FormCliente }
