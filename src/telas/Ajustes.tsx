import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, lerConfig, salvarConfig } from '../db'
import { exportarBackup, lerBackup, restaurarBackup, contarRegistros, type ArquivoBackup } from '../backup'
import { CHAVE_MOSTRAR_AO_ABRIR, lerValor } from '../dinheiro'
import { Categorias } from './Categorias'
import { Produtos } from './Produtos'
import { adicionarBackup, contarParaAdicionar } from '../importar'
import { SeloValtaris } from '../componentes/Selo'
import { Interruptor, Opcoes, mascararValor } from '../componentes/ui'
import { lerPaleta, lerTema, PALETAS, salvarPaleta, salvarTema, type ModoCor, type Tema } from '../tema'

/** Grade de paletas: cada uma mostra o degradê do cartão principal. */
function EscolhaCores({ modo, titulo }: { modo: ModoCor; titulo: string }) {
  const [escolhida, setEscolhida] = useState(lerPaleta(modo).id)
  const escuro = document.documentElement.dataset.tema === 'escuro'
  return (
    <div className="grupo">
      <span className="rotulo">{titulo}</span>
      <div className="paletas">
        {PALETAS[modo].map((p) => {
          const tom = escuro ? p.escuro : p.claro
          return (
            <button
              key={p.id}
              type="button"
              className={`paleta ${escolhida === p.id ? 'ativa' : ''}`}
              onClick={() => { setEscolhida(p.id); salvarPaleta(modo, p.id) }}
              aria-pressed={escolhida === p.id}
            >
              <span className="paleta-amostra" style={{ background: `linear-gradient(135deg, ${tom.grad1}, ${tom.grad2})` }}>
                <span style={{ background: tom.destaque }} />
              </span>
              <span className="paleta-nome">{p.nome}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Apaga tudo do modo Empresa (plataformas, cobranças, pagamentos, gastos, retiradas e produtos). O modo Pessoal não muda. */
function ApagarEmpresa({ aoApagar }: { aoApagar: () => void }) {
  const [confirmando, setConfirmando] = useState(false)
  const total = useLiveQuery(
    async () => (await db.plataformas.count()) + (await db.gastosEmpresa.count()) + (await db.retiradas.count()) + (await db.produtos.count()),
    [],
    0,
  )
  if (!total) return null

  async function apagar() {
    await db.transaction('rw', [db.plataformas, db.cobrancas, db.pagamentosCobranca, db.gastosEmpresa, db.retiradas, db.produtos], async () => {
      await Promise.all([
        db.plataformas.clear(),
        db.cobrancas.clear(),
        db.pagamentosCobranca.clear(),
        db.gastosEmpresa.clear(),
        db.retiradas.clear(),
        db.produtos.clear(),
      ])
    })
    setConfirmando(false)
    aoApagar()
  }

  if (!confirmando) {
    return <button className="botao botao-texto-perigo" onClick={() => setConfirmando(true)}>Apagar todos os dados da Empresa</button>
  }
  return (
    <div className="confirmacao">
      <p>
        Apagar <strong>todas</strong> as plataformas, cobranças, pagamentos, gastos, retiradas e produtos da Empresa?
        O modo Pessoal não muda. Se quiser guardar uma cópia, salve um backup antes.
      </p>
      <div className="linha-campos">
        <button className="botao" onClick={() => setConfirmando(false)}>Cancelar</button>
        <button className="botao botao-perigo" onClick={apagar}>Apagar</button>
      </div>
    </div>
  )
}

function formatarData(iso: string | null): string {
  if (!iso) return 'nunca'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function Ajustes({ aoVoltar }: { aoVoltar: () => void }) {
  const ultimoBackup = useLiveQuery(() => lerConfig<string | null>('ultimoBackup', null), [], null)
  const cotacao = useLiveQuery(() => lerConfig<number>('cotacaoDolar', 550), [], 550)
  const pagoPorMimPadrao = useLiveQuery(() => lerConfig<boolean>('pagoPorMimPadrao', true), [], true)
  const [esconderAoAbrir, setEsconderAoAbrir] = useState(() => localStorage.getItem(CHAVE_MOSTRAR_AO_ABRIR) !== 'sim')
  const empresaNoPessoal = useLiveQuery(() => lerConfig<boolean>('empresaNoPessoal', true), [], true)

  const [tema, setTema] = useState<Tema>(lerTema)
  const [textoCotacao, setTextoCotacao] = useState('')
  const [persistente, setPersistente] = useState<boolean | null>(null)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [pendente, setPendente] = useState<ArquivoBackup | null>(null)
  const [modoArquivo, setModoArquivo] = useState<'adicionar' | 'substituir'>('adicionar')
  const entradaArquivo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTextoCotacao((cotacao / 100).toFixed(2).replace('.', ','))
  }, [cotacao])

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersistente).catch(() => setPersistente(false))
  }, [])

  async function salvarCotacao() {
    const centavos = lerValor(textoCotacao)
    if (centavos === null || centavos <= 0) {
      setMensagem({ tipo: 'erro', texto: 'Cotação inválida. Use, por exemplo, 5,50.' })
      return
    }
    await salvarConfig('cotacaoDolar', centavos)
    setMensagem({ tipo: 'ok', texto: 'Cotação do dólar salva.' })
  }

  async function exportar() {
    try {
      await exportarBackup()
      setMensagem({ tipo: 'ok', texto: 'Backup salvo. Guarde o arquivo num lugar seguro (Google Drive, e-mail…).' })
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Não foi possível gerar o backup.' })
    }
  }

  async function escolherArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!arquivo) return
    try {
      setPendente(await lerBackup(arquivo))
      setMensagem(null)
    } catch (erro) {
      setMensagem({ tipo: 'erro', texto: (erro as Error).message })
    }
  }

  async function confirmarAdicao() {
    if (!pendente) return
    try {
      const { adicionados, ignorados } = await adicionarBackup(pendente)
      const partes = [
        adicionados === 0 ? 'Nada novo para adicionar: tudo do arquivo já estava no app.' : adicionados === 1 ? '1 registro adicionado.' : `${adicionados} registros adicionados.`,
        adicionados > 0 && ignorados > 0 ? (ignorados === 1 ? '1 já existia e foi ignorado.' : `${ignorados} já existiam e foram ignorados.`) : '',
      ]
      setMensagem({ tipo: 'ok', texto: partes.filter(Boolean).join(' ') })
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Não foi possível adicionar. Seus dados atuais não foram alterados.' })
    }
    setPendente(null)
  }

  async function confirmarRestauracao() {
    if (!pendente) return
    try {
      await restaurarBackup(pendente)
      setMensagem({ tipo: 'ok', texto: 'Backup restaurado.' })
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Não foi possível restaurar. Seus dados atuais não foram alterados.' })
    }
    setPendente(null)
  }

  return (
    <div className="app">
      <header className="cabecalho">
        <button className="botao-icone" onClick={aoVoltar} aria-label="Voltar">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="titulo-cabecalho">Ajustes</h1>
        <span style={{ width: 40 }} />
      </header>

      <main className="conteudo">
        <div className="tela">
          {mensagem && <div className={`aviso ${mensagem.tipo === 'ok' ? 'aviso-ok' : 'aviso-erro'}`}>{mensagem.texto}</div>}

          <section className="bloco">
            <h2>Backup</h2>
            <p className="texto-suave">
              Seus dados ficam só neste aparelho. Se o navegador for limpo, eles se perdem. Faça backup pelo menos uma vez por mês.
            </p>
            <p className="linha-info">Último backup: <strong>{formatarData(ultimoBackup)}</strong></p>
            <button className="botao botao-principal" onClick={exportar}>Salvar backup</button>
            <button className="botao" onClick={() => { setModoArquivo('adicionar'); entradaArquivo.current?.click() }}>Adicionar de um arquivo</button>
            <button className="botao" onClick={() => { setModoArquivo('substituir'); entradaArquivo.current?.click() }}>Restaurar de um arquivo</button>
            <input ref={entradaArquivo} type="file" accept="application/json,.json" hidden onChange={escolherArquivo} />
            <p className="texto-suave">
              <strong>Adicionar</strong> soma o arquivo ao que já está no app e ignora o que for repetido.{' '}
              <strong>Restaurar</strong> apaga tudo e deixa só o que está no arquivo.
            </p>
          </section>

          <section className="bloco">
            <h2>Dólar</h2>
            <p className="texto-suave">Cotação usada para prever custos em US$. O valor real cobrado você lança na hora de pagar.</p>
            <label className="campo">
              <span>R$ por US$ 1</span>
              <input inputMode="numeric" value={textoCotacao} onChange={(e) => setTextoCotacao(mascararValor(e.target.value))} />
            </label>
            <button className="botao" onClick={salvarCotacao}>Salvar cotação</button>
          </section>

          <section className="bloco">
            <h2>Aparência</h2>
            <Interruptor
              rotulo="Esconder valores ao abrir o app"
              dica="Os valores aparecem como R$ ••••. Toque no olho no topo para mostrar."
              ligado={esconderAoAbrir}
              aoMudar={(v) => { setEsconderAoAbrir(v); if (v) localStorage.removeItem(CHAVE_MOSTRAR_AO_ABRIR); else localStorage.setItem(CHAVE_MOSTRAR_AO_ABRIR, 'sim') }}
            />
            <Opcoes
              rotulo="Tema"
              opcoes={[
                { valor: 'auto' as Tema, rotulo: 'Igual ao celular' },
                { valor: 'claro' as Tema, rotulo: 'Claro' },
                { valor: 'escuro' as Tema, rotulo: 'Escuro' },
              ]}
              valor={tema}
              aoMudar={(t) => { setTema(t); salvarTema(t) }}
            />
            <EscolhaCores modo="pessoal" titulo="Cores do Pessoal" />
            <EscolhaCores modo="empresa" titulo="Cores da Empresa" />
          </section>

          <Categorias />

          <section className="bloco">
            <h2>Empresa</h2>
            <Interruptor
              rotulo="Marcar “pago por mim” por padrão"
              dica="Deixe ligado enquanto a empresa não tiver CNPJ e conta própria."
              ligado={pagoPorMimPadrao}
              aoMudar={(v) => salvarConfig('pagoPorMimPadrao', v)}
            />
            <Interruptor
              rotulo="Somar a empresa no Pessoal"
              dica="Os gastos da empresa pagos por mim entram no card vermelho, na sobra do mês e na aba Contas."
              ligado={empresaNoPessoal}
              aoMudar={(v) => salvarConfig('empresaNoPessoal', v)}
            />
            <Produtos />
            <ApagarEmpresa aoApagar={() => setMensagem({ tipo: 'ok', texto: 'Dados da Empresa apagados. O modo Empresa está vazio.' })} />
          </section>

          <section className="bloco">
            <h2>Armazenamento</h2>
            <p className="linha-info">
              Proteção contra limpeza automática:{' '}
              <strong>{persistente === null ? '…' : persistente ? 'ativada' : 'não ativada'}</strong>
            </p>
            {persistente === false && (
              <p className="texto-suave">Instale o app na tela inicial para o navegador proteger melhor os dados.</p>
            )}
          </section>

          <div className="rodape-selo">
            <SeloValtaris />
            <p className="rodape">Meu Financeiro · versão {__VERSAO__}</p>
          </div>
        </div>
      </main>

      {pendente && modoArquivo === 'adicionar' && (
        <div className="fundo-folha" onClick={() => setPendente(null)}>
          <div className="folha" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Confirmar adição">
            <div className="folha-alca" />
            <h2>Adicionar ao app?</h2>
            <p>
              Arquivo de <strong>{formatarData(pendente.exportadoEm)}</strong>, com <strong>{contarParaAdicionar(pendente)}</strong> registros.
            </p>
            <p className="texto-suave">Nada do que já está no app é apagado. O que já existir (mesmo nome, mesma data e valor) é ignorado.</p>
            <button className="botao botao-principal" onClick={confirmarAdicao}>Adicionar</button>
            <button className="botao" onClick={() => setPendente(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {pendente && modoArquivo === 'substituir' && (
        <div className="fundo-folha" onClick={() => setPendente(null)}>
          <div className="folha" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Confirmar restauração">
            <div className="folha-alca" />
            <h2>Restaurar backup?</h2>
            <p>
              Backup de <strong>{formatarData(pendente.exportadoEm)}</strong>, com <strong>{contarRegistros(pendente)}</strong> registros.
            </p>
            <p className="texto-alerta">Isso substitui <strong>todos</strong> os dados atuais deste aparelho.</p>
            <button className="botao botao-perigo" onClick={confirmarRestauracao}>Substituir e restaurar</button>
            <button className="botao" onClick={() => setPendente(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
