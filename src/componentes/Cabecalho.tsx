import type { Modo } from '../db'

interface Props {
  modo: Modo
  aoTrocarModo: (modo: Modo) => void
  aoAbrirAjustes: () => void
  aoAbrirBusca: () => void
  ocultos: boolean
  aoAlternarOcultos: () => void
}

export function Cabecalho({ modo, aoTrocarModo, aoAbrirAjustes, aoAbrirBusca, ocultos, aoAlternarOcultos }: Props) {
  return (
    <header className="cabecalho">
      <div className="seletor-modo" role="tablist" aria-label="Modo do app">
        <button role="tab" aria-selected={modo === 'pessoal'} className={modo === 'pessoal' ? 'ativo' : ''} onClick={() => aoTrocarModo('pessoal')}>
          Pessoal
        </button>
        <button role="tab" aria-selected={modo === 'empresa'} className={modo === 'empresa' ? 'ativo' : ''} onClick={() => aoTrocarModo('empresa')}>
          Empresa
        </button>
      </div>
      <button className="botao-icone" onClick={aoAlternarOcultos} aria-label={ocultos ? 'Mostrar valores' : 'Esconder valores'} aria-pressed={!ocultos}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {ocultos && <path d="M3 3l18 18" />}
        </svg>
      </button>
      <button className="botao-icone" onClick={aoAbrirBusca} aria-label="Buscar">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      </button>
      <button className="botao-icone" onClick={aoAbrirAjustes} aria-label="Ajustes">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </header>
  )
}
