import { useEffect, useRef, useState, type TouchEvent } from 'react'
import type { Modo } from './db'
import { Cabecalho } from './componentes/Cabecalho'
import { BarraInferior, type Aba } from './componentes/BarraInferior'
import { InicioPessoal } from './telas/InicioPessoal'
import { InicioEmpresa } from './telas/InicioEmpresa'
import { Gastos } from './telas/Gastos'
import { Contas } from './telas/Contas'
import { Recebimentos } from './telas/Recebimentos'
import { Opcoes } from './componentes/ui'
import { Cartoes } from './telas/Cartoes'
import { FormGasto } from './telas/FormGasto'
import { Plataformas } from './telas/empresa/Plataformas'
import { Cobrancas } from './telas/empresa/Cobrancas'
import { Retiradas } from './telas/empresa/Retiradas'
import { FormGastoEmpresa } from './telas/empresa/Formularios'
import { Ajustes } from './telas/Ajustes'
import { Relatorios } from './telas/Relatorios'
import { Busca } from './telas/Busca'

const CHAVE_MODO = 'mf-modo'

export default function App() {
  const [modo, setModo] = useState<Modo>(() => (localStorage.getItem(CHAVE_MODO) === 'empresa' ? 'empresa' : 'pessoal'))
  const [aba, setAba] = useState<Aba>('inicio')
  const [ajustesAberto, setAjustesAberto] = useState(false)
  const [novoAberto, setNovoAberto] = useState(false)
  const [relatoriosAberto, setRelatoriosAberto] = useState(false)
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [ladoContas, setLadoContas] = useState<'pagar' | 'receber'>('pagar')

  useEffect(() => {
    localStorage.setItem(CHAVE_MODO, modo)
    document.documentElement.dataset.modo = modo
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', modo === 'empresa' ? '#2563eb' : '#5b21b6')
  }, [modo])

  function trocarModo(novo: Modo) {
    if (novo === modo) return
    setEntrada(novo === 'empresa' ? 'pela-direita' : 'pela-esquerda')
    setModo(novo)
    setAba('inicio')
  }

  // Deslizar o dedo na tela troca o modo: para a esquerda vai à Empresa, para a direita volta ao Pessoal.
  const toque = useRef<{ x: number; y: number; t: number } | null>(null)
  const [entrada, setEntrada] = useState<'pela-direita' | 'pela-esquerda' | null>(null)

  function inicioToque(e: TouchEvent<HTMLElement>) {
    const alvo = e.target as HTMLElement
    // Não troca se o gesto começou num campo, numa janela ou numa lista de opções que rola para o lado.
    if (e.touches.length !== 1 || alvo.closest('input, select, textarea, .folha, .opcoes, .grafico')) {
      toque.current = null
      return
    }
    toque.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
  }

  function fimToque(e: TouchEvent<HTMLElement>) {
    const inicio = toque.current
    toque.current = null
    if (!inicio) return
    const dx = e.changedTouches[0].clientX - inicio.x
    const dy = e.changedTouches[0].clientY - inicio.y
    const rapido = Date.now() - inicio.t < 700
    if (!rapido || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return
    trocarModo(dx < 0 ? 'empresa' : 'pessoal')
  }

  function irPara(nova: Aba) {
    setAba(nova)
    window.scrollTo(0, 0)
  }

  if (ajustesAberto) return <Ajustes aoVoltar={() => setAjustesAberto(false)} />
  if (relatoriosAberto) return <Relatorios aoVoltar={() => setRelatoriosAberto(false)} />
  if (buscaAberta) return <Busca aoVoltar={() => setBuscaAberta(false)} />

  const abrirAjustes = () => setAjustesAberto(true)

  return (
    <div className="app">
      <Cabecalho modo={modo} aoTrocarModo={trocarModo} aoAbrirAjustes={abrirAjustes} aoAbrirBusca={() => setBuscaAberta(true)} />
      <main
        key={modo}
        className={`conteudo ${entrada ? `entrar-${entrada}` : ""}`}
        onTouchStart={inicioToque}
        onTouchEnd={fimToque}
      >
        {modo === 'pessoal' && aba === 'inicio' && (
          <InicioPessoal
            aoAbrirAjustes={abrirAjustes}
            aoAbrirRelatorios={() => setRelatoriosAberto(true)}
            aoIrPara={irPara}
            aoIrParaEmpresa={() => trocarModo('empresa')}
            aoIrParaRecebimentos={() => { setLadoContas('receber'); irPara('contas') }}
          />
        )}
        {modo === 'pessoal' && aba === 'gastos' && <Gastos />}
        {modo === 'pessoal' && aba === 'contas' && (
          <div className="tela">
            <Opcoes
              rotulo="Contas a pagar ou a receber"
              opcoes={[{ valor: 'pagar' as const, rotulo: 'A pagar' }, { valor: 'receber' as const, rotulo: 'A receber' }]}
              valor={ladoContas}
              aoMudar={setLadoContas}
            />
            {ladoContas === 'pagar' ? <Contas /> : <Recebimentos />}
          </div>
        )}
        {modo === 'pessoal' && aba === 'cartoes' && <Cartoes />}
        {modo === 'empresa' && aba === 'inicio' && <InicioEmpresa aoAbrirAjustes={abrirAjustes} />}
        {modo === 'empresa' && aba === 'plataformas' && <Plataformas />}
        {modo === 'empresa' && aba === 'cobrancas' && <Cobrancas />}
        {modo === 'empresa' && aba === 'retiradas' && <Retiradas />}
      </main>
      <BarraInferior modo={modo} aba={aba} aoTrocarAba={irPara} aoNovo={() => setNovoAberto(true)} />
      {novoAberto && modo === 'pessoal' && <FormGasto aoFechar={() => setNovoAberto(false)} />}
      {novoAberto && modo === 'empresa' && <FormGastoEmpresa aoFechar={() => setNovoAberto(false)} />}
    </div>
  )
}
