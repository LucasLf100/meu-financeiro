import { useState } from 'react'
import { Folha } from '../../componentes/ui'
import { FormEntradaAvulsa } from './Entradas'
import { FormGastoEmpresa } from './Formularios'
import { mesAtual } from '../../datas'

/** O + da Empresa: pergunta se é dinheiro entrando ou saindo. */
export function NovoEmpresa({ aoFechar }: { aoFechar: () => void }) {
  const [tipo, setTipo] = useState<'entrada' | 'saida' | null>(null)
  if (tipo === 'entrada') return <FormEntradaAvulsa mes={mesAtual()} aoFechar={aoFechar} />
  if (tipo === 'saida') return <FormGastoEmpresa aoFechar={aoFechar} />
  return (
    <Folha titulo="Novo lançamento da empresa" aoFechar={aoFechar}>
      <div className="escolha-novo">
        <button onClick={() => setTipo('saida')}>
          <span>📤</span>
          Saída
          <small>Gasto, taxa, compra</small>
        </button>
        <button onClick={() => setTipo('entrada')}>
          <span>📥</span>
          Entrada
          <small>Venda, serviço, recebimento</small>
        </button>
      </div>
      <p className="texto-suave">Clientes que pagam todo mês você cadastra em Entradas; renovações de plataformas aparecem sozinhas em Saídas.</p>
    </Folha>
  )
}
