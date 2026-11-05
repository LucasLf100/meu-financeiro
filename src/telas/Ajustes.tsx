import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { lerConfig, salvarConfig } from '../db'
import { exportarBackup, lerBackup, restaurarBackup, contarRegistros, type ArquivoBackup } from '../backup'
import { lerValor } from '../dinheiro'
import { Categorias } from './Categorias'
import { SeloValtaris } from '../componentes/Selo'
import { Interruptor, Opcoes, mascararValor } from '../componentes/ui'
import { lerTema, salvarTema, type Tema } from '../tema'

function formatarData(iso: string | null): string {
  if (!iso) return 'nunca'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function Ajustes({ aoVoltar }: { aoVoltar: () => void }) {
  const ultimoBackup = useLiveQuery(() => lerConfig<string | null>('ultimoBackup', null), [], null)
  const cotacao = useLiveQuery(() => lerConfig<number>('cotacaoDolar', 550), [], 550)
  const pagoPorMimPadrao = useLiveQuery(() => lerConfig<boolean>('pagoPorMimPadrao', true), [], true)

  const [tema, setTema] = useState<Tema>(lerTema)
  const [textoCotacao, setTextoCotacao] = useState('')
  const [persistente, setPersistente] = useState<boolean | null>(null)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [pendente, setPendente] = useState<ArquivoBackup | null>(null)
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
            <button className="botao" onClick={() => entradaArquivo.current?.click()}>Restaurar de um arquivo</button>
            <input ref={entradaArquivo} type="file" accept="application/json,.json" hidden onChange={escolherArquivo} />
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
          </section>

          <Categorias />

          <section className="bloco">
            <h2>Empresa</h2>
            <Interruptor
              rotulo="Marcar “pago por mim” por padrão"
              dica="Deixe ligado enquanto a Valtaris não tiver CNPJ e conta própria."
              ligado={pagoPorMimPadrao}
              aoMudar={(v) => salvarConfig('pagoPorMimPadrao', v)}
            />
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

      {pendente && (
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
