// O tema fica no localStorage (e não no banco) para ser aplicado antes do app desenhar, sem piscar.

export type Tema = 'auto' | 'claro' | 'escuro'

const CHAVE = 'mf-tema'
const consulta = window.matchMedia('(prefers-color-scheme: dark)')

export function lerTema(): Tema {
  const salvo = localStorage.getItem(CHAVE)
  return salvo === 'claro' || salvo === 'escuro' ? salvo : 'auto'
}

export function aplicarTema(tema: Tema = lerTema()): void {
  const escuro = tema === 'escuro' || (tema === 'auto' && consulta.matches)
  document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro'
}

export function salvarTema(tema: Tema): void {
  localStorage.setItem(CHAVE, tema)
  aplicarTema(tema)
}

// No modo automático, acompanha a troca de tema do celular.
consulta.addEventListener('change', () => aplicarTema())
