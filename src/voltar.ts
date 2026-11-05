// Botão "voltar" do celular dentro do app.
// O app deixa uma entrada extra no histórico do navegador. Quando o voltar é tocado, essa entrada
// é consumida e quem estiver no topo da pilha (uma janela aberta, uma tela, a aba) trata o gesto.
// Se ninguém tratar (já no Início), o próximo voltar sai do app.
import { useEffect, useRef } from 'react'

/** Retorna true se tratou o voltar (fechou algo); false se não havia nada para fazer. */
type Tratador = () => boolean

const pilha: Array<{ tratar: () => boolean }> = []
let armado = false
let aoNaoTratar: (() => void) | null = null

function armar() {
  if (armado) return
  history.pushState({ meuFinanceiro: true }, '')
  armado = true
}

window.addEventListener('popstate', () => {
  armado = false
  for (let i = pilha.length - 1; i >= 0; i--) {
    if (pilha[i].tratar()) {
      armar()
      return
    }
  }
  // Nada para fechar: o próximo voltar sai do app.
  aoNaoTratar?.()
})

/** Registra quem trata o voltar enquanto o componente estiver na tela. O mais recente tem prioridade. */
export function useVoltar(tratador: Tratador, ativo = true) {
  const ref = useRef(tratador)
  ref.current = tratador
  useEffect(() => {
    if (!ativo) return
    const item = { tratar: () => ref.current() }
    pilha.push(item)
    armar()
    return () => {
      const i = pilha.indexOf(item)
      if (i >= 0) pilha.splice(i, 1)
    }
  }, [ativo])
}

/** Chamado quando o voltar não tinha nada para fechar (para avisar "toque de novo para sair"). */
export function aoSairDoApp(fn: () => void) {
  aoNaoTratar = fn
}

/** Depois que o aviso de saída some, deixa o app pronto para tratar o voltar de novo. */
export function rearmarVoltar() {
  armar()
}
