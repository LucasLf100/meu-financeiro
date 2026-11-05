import { useEffect, useState } from 'react'

/** Selo "uma produção Valtaris". */
export function SeloValtaris({ claro }: { claro?: boolean }) {
  return (
    <div className={`selo ${claro ? 'selo-claro' : ''}`} aria-label="Uma produção Valtaris">
      <span>uma produção</span>
      <strong>VALTARIS</strong>
    </div>
  )
}

/** Tela de abertura rápida, só quando o app é aberto. */
export function Abertura() {
  const [fase, setFase] = useState<'visivel' | 'saindo' | 'fim'>('visivel')

  useEffect(() => {
    const sair = setTimeout(() => setFase('saindo'), 900)
    const fim = setTimeout(() => setFase('fim'), 1300)
    return () => {
      clearTimeout(sair)
      clearTimeout(fim)
    }
  }, [])

  if (fase === 'fim') return null
  return (
    <div className={`abertura ${fase === 'saindo' ? 'saindo' : ''}`} onClick={() => setFase('fim')} aria-hidden="true">
      <img src="./icon.svg" alt="" width={96} height={96} />
      <h1>Meu Financeiro</h1>
      <SeloValtaris claro />
    </div>
  )
}
