import { useLiveQuery } from 'dexie-react-hooks'
import { precisaDeBackup } from '../backup'

export function AvisoBackup({ aoAbrirAjustes }: { aoAbrirAjustes: () => void }) {
  const precisa = useLiveQuery(precisaDeBackup, [], false)
  if (!precisa) return null
  return (
    <button className="aviso aviso-alerta" onClick={aoAbrirAjustes}>
      <strong>Hora de fazer backup</strong>
      <span>Faz mais de 30 dias (ou você nunca fez). Toque para salvar uma cópia dos seus dados.</span>
    </button>
  )
}
