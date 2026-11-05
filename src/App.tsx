import { useEffect, useState } from 'react'
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

const CHAVE_MODO = 'mf-modo'

export default function App() {
  const [modo, setModo] = useState<Modo>(() => (localStorage.getItem(CHAVE_MODO) === 'empresa' ? 'empresa' : 'pessoal'))
  const [aba, setAba] = useState<Aba>('inicio')
  const [ajustesAberto, setAjustesAberto] = useState(false)
  const [novoAberto, setNovoAberto] = useState(false)
  const [relatoriosAberto, setRelatoriosAberto] = useState(false)
  const [ladoContas, setLadoContas] = useState<'pagar' | 'receber'>('pagar')

  useEffect(() => {
    localStorage.setItem(CHAVE_MODO, modo)
    document.documentElement.dataset.modo = modo
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', modo === 'empresa' ? '#2563eb' : '#5b21b6')
  }, [modo])

  function trocarModo(novo: Modo) {
    setModo(novo)
    setAba('inicio')
  }

  function irPara(nova: Aba) {
    setAba(nova)
    window.scrollTo(0, 0)
  }

  if (ajustesAberto) return <Ajustes aoVoltar={() => setAjustesAberto(false)} />
  if (relatoriosAberto) return <Relatorios aoVoltar={() => setRelatoriosAberto(false)} />

  const abrirAjustes = () => setAjustesAberto(true)

  return (
    <div className="app">
      <Cabecalho modo={modo} aoTrocarModo={trocarModo} aoAbrirAjustes={abrirAjustes} />
      <main className="conteudo">
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
