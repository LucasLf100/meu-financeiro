import type { Modo } from '../db'

export type Aba = 'inicio' | 'gastos' | 'contas' | 'cartoes' | 'plataformas' | 'cobrancas' | 'retiradas'

interface DefAba {
  id: Aba
  rotulo: string
  icone: string
  etapa: number
}

const I = {
  inicio: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  gastos: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  contas: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4',
  cartoes: 'M3 6h18v12H3zM3 10h18M7 15h4',
  plataformas: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  cobrancas: 'M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4',
  retiradas: 'M12 3v12M7 10l5 5 5-5M4 21h16',
}

export const ABAS: Record<Modo, DefAba[]> = {
  pessoal: [
    { id: 'inicio', rotulo: 'Início', icone: I.inicio, etapa: 5 },
    { id: 'gastos', rotulo: 'Gastos', icone: I.gastos, etapa: 2 },
    { id: 'contas', rotulo: 'Contas', icone: I.contas, etapa: 3 },
    { id: 'cartoes', rotulo: 'Cartões', icone: I.cartoes, etapa: 4 },
  ],
  empresa: [
    { id: 'inicio', rotulo: 'Início', icone: I.inicio, etapa: 6 },
    { id: 'plataformas', rotulo: 'Plataformas', icone: I.plataformas, etapa: 6 },
    { id: 'cobrancas', rotulo: 'Cobranças', icone: I.cobrancas, etapa: 6 },
    { id: 'retiradas', rotulo: 'Retiradas', icone: I.retiradas, etapa: 6 },
  ],
}

interface Props {
  modo: Modo
  aba: Aba
  aoTrocarAba: (aba: Aba) => void
  aoNovo: () => void
}

function BotaoAba({ def, ativa, aoClicar }: { def: DefAba; ativa: boolean; aoClicar: () => void }) {
  return (
    <button className={`aba ${ativa ? 'ativa' : ''}`} onClick={aoClicar} aria-current={ativa ? 'page' : undefined}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={def.icone} />
      </svg>
      <span>{def.rotulo}</span>
    </button>
  )
}

export function BarraInferior({ modo, aba, aoTrocarAba, aoNovo }: Props) {
  const abas = ABAS[modo]
  return (
    <nav className="barra-inferior" aria-label="Navegação">
      {abas.slice(0, 2).map((def) => (
        <BotaoAba key={def.id} def={def} ativa={aba === def.id} aoClicar={() => aoTrocarAba(def.id)} />
      ))}
      <button className="botao-novo" onClick={aoNovo} aria-label="Novo lançamento">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      {abas.slice(2).map((def) => (
        <BotaoAba key={def.id} def={def} ativa={aba === def.id} aoClicar={() => aoTrocarAba(def.id)} />
      ))}
    </nav>
  )
}
