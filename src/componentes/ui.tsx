import { useEffect, type ReactNode } from 'react'
import { nomeMes, somarMeses } from '../datas'
import { useVoltar } from '../voltar'

/** Janela que sobe de baixo. */
export function Folha({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: ReactNode }) {
  // O voltar do celular fecha a janela em vez de sair do app.
  useVoltar(() => {
    aoFechar()
    return true
  })

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', tecla)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = ''
    }
  }, [aoFechar])

  return (
    <div className="fundo-folha" onClick={aoFechar}>
      <div className="folha" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titulo}>
        <div className="folha-alca" />
        <div className="folha-topo">
          <h2>{titulo}</h2>
          <button className="botao-icone" onClick={aoFechar} aria-label="Fechar">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="folha-corpo">{children}</div>
      </div>
    </div>
  )
}

export function SeletorMes({ mes, aoMudar }: { mes: string; aoMudar: (mes: string) => void }) {
  return (
    <div className="seletor-mes">
      <button className="botao-icone" onClick={() => aoMudar(somarMeses(mes, -1))} aria-label="Mês anterior">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <strong>{nomeMes(mes)}</strong>
      <button className="botao-icone" onClick={() => aoMudar(somarMeses(mes, 1))} aria-label="Próximo mês">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
      </button>
    </div>
  )
}

export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      {children}
      {dica && <small className="dica">{dica}</small>}
    </label>
  )
}

export function Opcoes<T extends string | number>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
}: {
  opcoes: Array<{ valor: T; rotulo: string }>
  valor: T
  aoMudar: (v: T) => void
  rotulo: string
}) {
  return (
    <div className="opcoes" role="radiogroup" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          className={valor === o.valor ? 'ativa' : ''}
          onClick={() => aoMudar(o.valor)}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

export function Interruptor({ rotulo, ligado, aoMudar, dica }: { rotulo: string; ligado: boolean; aoMudar: (v: boolean) => void; dica?: string }) {
  return (
    <label className="interruptor">
      <span>
        {rotulo}
        {dica && <small className="dica">{dica}</small>}
      </span>
      <input type="checkbox" role="switch" checked={ligado} onChange={(e) => aoMudar(e.target.checked)} />
    </label>
  )
}

export function BarraProgresso({ valor, total, perigo }: { valor: number; total: number; perigo?: boolean }) {
  const pct = total > 0 ? Math.min(100, Math.round((valor / total) * 100)) : 0
  return (
    <div className={`barra-progresso ${perigo ? 'perigo' : ''}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Vazio({ icone, titulo, texto, children }: { icone: string; titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <section className="vazio">
      <div className="vazio-icone">{icone}</div>
      <h2>{titulo}</h2>
      {texto && <p className="texto-suave">{texto}</p>}
      {children}
    </section>
  )
}

export function Etiqueta({ tipo, children }: { tipo: 'ok' | 'alerta' | 'perigo' | 'neutra'; children: ReactNode }) {
  return <span className={`etiqueta etiqueta-${tipo}`}>{children}</span>
}

const formatoCampo = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Texto do valor para edição: 123456 centavos → "1.234,56". */
export function valorParaTexto(centavos?: number): string {
  if (centavos === undefined) return ''
  return formatoCampo.format(centavos / 100)
}

/**
 * Máscara de dinheiro estilo app de banco: os dígitos entram pela direita.
 * "1" → "0,01", "12" → "0,12", "1234" → "12,34", "123456" → "1.234,56".
 */
export function mascararValor(texto: string): string {
  const digitos = texto.replace(/\D/g, '').replace(/^0+/, '').slice(0, 11)
  if (!digitos) return ''
  return valorParaTexto(Number(digitos))
}
