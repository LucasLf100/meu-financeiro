// Tema (claro/escuro) e paleta de cores de cada modo. Tudo fica no localStorage para ser aplicado
// antes do app desenhar, sem piscar.

export type Tema = 'auto' | 'claro' | 'escuro'
export type ModoCor = 'pessoal' | 'empresa'

interface Tom {
  destaque: string
  destaqueEscuro: string // texto/realce forte; no tema escuro é um tom claro
  grad1: string
  grad2: string
}

export interface Paleta {
  id: string
  nome: string
  claro: Tom & { suave: string }
  escuro: Tom
}

export const PALETAS: Record<ModoCor, Paleta[]> = {
  pessoal: [
    {
      id: 'roxo', nome: 'Roxo',
      claro: { destaque: '#5b21b6', destaqueEscuro: '#3b0764', suave: '#ede9fe', grad1: '#6d28d9', grad2: '#3b0764' },
      escuro: { destaque: '#7c3aed', destaqueEscuro: '#c4b5fd', grad1: '#7c3aed', grad2: '#3b0764' },
    },
    {
      id: 'ambar', nome: 'Âmbar (amarelo escuro)',
      claro: { destaque: '#b45309', destaqueEscuro: '#78350f', suave: '#fef3c7', grad1: '#d97706', grad2: '#78350f' },
      escuro: { destaque: '#f59e0b', destaqueEscuro: '#fcd34d', grad1: '#b45309', grad2: '#451a03' },
    },
    {
      id: 'esmeralda', nome: 'Esmeralda',
      claro: { destaque: '#047857', destaqueEscuro: '#064e3b', suave: '#d1fae5', grad1: '#059669', grad2: '#064e3b' },
      escuro: { destaque: '#10b981', destaqueEscuro: '#6ee7b7', grad1: '#047857', grad2: '#022c22' },
    },
    {
      id: 'oceano', nome: 'Oceano',
      claro: { destaque: '#0369a1', destaqueEscuro: '#0c4a6e', suave: '#e0f2fe', grad1: '#0284c7', grad2: '#0c4a6e' },
      escuro: { destaque: '#0ea5e9', destaqueEscuro: '#7dd3fc', grad1: '#0369a1', grad2: '#082f49' },
    },
    {
      id: 'rubi', nome: 'Rubi',
      claro: { destaque: '#be123c', destaqueEscuro: '#881337', suave: '#ffe4e6', grad1: '#e11d48', grad2: '#881337' },
      escuro: { destaque: '#f43f5e', destaqueEscuro: '#fda4af', grad1: '#be123c', grad2: '#4c0519' },
    },
    {
      id: 'por-do-sol', nome: 'Pôr do sol',
      claro: { destaque: '#c2410c', destaqueEscuro: '#7c2d12', suave: '#ffedd5', grad1: '#ea580c', grad2: '#9d174d' },
      escuro: { destaque: '#fb923c', destaqueEscuro: '#fdba74', grad1: '#c2410c', grad2: '#831843' },
    },
  ],
  empresa: [
    {
      id: 'azul', nome: 'Azul corporativo',
      claro: { destaque: '#2563eb', destaqueEscuro: '#1d4ed8', suave: '#dbeafe', grad1: '#2563eb', grad2: '#1e3a8a' },
      escuro: { destaque: '#3b82f6', destaqueEscuro: '#93c5fd', grad1: '#1d4ed8', grad2: '#172554' },
    },
    {
      id: 'tech', nome: 'Grafite e ciano',
      claro: { destaque: '#0891b2', destaqueEscuro: '#155e75', suave: '#cffafe', grad1: '#0f172a', grad2: '#0e7490' },
      escuro: { destaque: '#06b6d4', destaqueEscuro: '#67e8f9', grad1: '#0f172a', grad2: '#155e75' },
    },
    {
      id: 'executivo', nome: 'Preto e dourado',
      claro: { destaque: '#a16207', destaqueEscuro: '#713f12', suave: '#fef9c3', grad1: '#18181b', grad2: '#854d0e' },
      escuro: { destaque: '#eab308', destaqueEscuro: '#fde047', grad1: '#18181b', grad2: '#713f12' },
    },
    {
      id: 'startup', nome: 'Índigo neon',
      claro: { destaque: '#4f46e5', destaqueEscuro: '#3730a3', suave: '#e0e7ff', grad1: '#4f46e5', grad2: '#9333ea' },
      escuro: { destaque: '#6366f1', destaqueEscuro: '#a5b4fc', grad1: '#4338ca', grad2: '#7e22ce' },
    },
    {
      id: 'terminal', nome: 'Verde terminal',
      claro: { destaque: '#15803d', destaqueEscuro: '#14532d', suave: '#dcfce7', grad1: '#0f172a', grad2: '#166534' },
      escuro: { destaque: '#22c55e', destaqueEscuro: '#86efac', grad1: '#020617', grad2: '#14532d' },
    },
    {
      id: 'minimal', nome: 'Grafite minimal',
      claro: { destaque: '#334155', destaqueEscuro: '#0f172a', suave: '#e2e8f0', grad1: '#334155', grad2: '#0f172a' },
      escuro: { destaque: '#94a3b8', destaqueEscuro: '#e2e8f0', grad1: '#1e293b', grad2: '#020617' },
    },
  ],
}

const CHAVE_TEMA = 'mf-tema'
const chaveCor = (modo: ModoCor) => `mf-cor-${modo}`
const consulta = window.matchMedia('(prefers-color-scheme: dark)')

export function lerTema(): Tema {
  const salvo = localStorage.getItem(CHAVE_TEMA)
  return salvo === 'claro' || salvo === 'escuro' ? salvo : 'auto'
}

export function lerPaleta(modo: ModoCor): Paleta {
  const id = localStorage.getItem(chaveCor(modo))
  return PALETAS[modo].find((p) => p.id === id) ?? PALETAS[modo][0]
}

/** Aplica as cores do modo atual (Pessoal ou Empresa), no tom claro ou escuro. */
export function aplicarCores(): void {
  const raiz = document.documentElement
  const modo: ModoCor = raiz.dataset.modo === 'empresa' ? 'empresa' : 'pessoal'
  const escuro = raiz.dataset.tema === 'escuro'
  const paleta = lerPaleta(modo)
  const tom = escuro ? paleta.escuro : paleta.claro
  const suave = escuro ? `color-mix(in srgb, ${tom.destaque} 22%, #151b23)` : paleta.claro.suave
  raiz.style.setProperty('--destaque', tom.destaque)
  raiz.style.setProperty('--destaque-escuro', tom.destaqueEscuro)
  raiz.style.setProperty('--destaque-suave', suave)
  raiz.style.setProperty('--grad-1', tom.grad1)
  raiz.style.setProperty('--grad-2', tom.grad2)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? tom.grad2 : paleta.claro.destaque)
}

export function aplicarTema(tema: Tema = lerTema()): void {
  const escuro = tema === 'escuro' || (tema === 'auto' && consulta.matches)
  document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro'
  aplicarCores()
}

export function salvarTema(tema: Tema): void {
  localStorage.setItem(CHAVE_TEMA, tema)
  aplicarTema(tema)
}

export function salvarPaleta(modo: ModoCor, id: string): void {
  localStorage.setItem(chaveCor(modo), id)
  aplicarCores()
}

// No modo automático, acompanha a troca de tema do celular.
consulta.addEventListener('change', () => aplicarTema())
