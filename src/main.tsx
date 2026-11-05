import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { Abertura } from './componentes/Selo'
import { prepararDadosIniciais } from './dadosIniciais'
import { pedirArmazenamentoPersistente } from './backup'
import { aplicarTema } from './tema'
import './estilos.css'

aplicarTema()

// Deixa o app pronto para funcionar offline e se atualizar sozinho.
registerSW({ immediate: true })

prepararDadosIniciais()
  .catch((erro) => console.error('Erro ao preparar dados iniciais', erro))
  .finally(() => {
    pedirArmazenamentoPersistente().catch(() => undefined)
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
        <Abertura />
      </StrictMode>,
    )
  })
