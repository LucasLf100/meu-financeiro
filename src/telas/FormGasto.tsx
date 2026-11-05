import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type FormaPagamento, type Gasto } from '../db'
import { formatarReais, lerValor } from '../dinheiro'
import { formatarDia, hoje, nomeMes } from '../datas'
import { atualizarParcelas, dividirParcelas, faturaDaCompra, validarEdicaoGasto } from '../regras/cartoes'
import { Campo, Folha, Opcoes, valorParaTexto, mascararValor } from '../componentes/ui'
import { SeletorCategoria } from '../componentes/SeletorCategoria'

export const FORMAS: Array<{ valor: FormaPagamento; rotulo: string }> = [
  { valor: 'debito', rotulo: 'Débito' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'credito', rotulo: 'Crédito' },
]

export const NOME_FORMA: Record<FormaPagamento, string> = { debito: 'Débito', pix: 'Pix', dinheiro: 'Dinheiro', credito: 'Crédito' }

export function FormGasto({ gasto, aoFechar }: { gasto?: Gasto; aoFechar: () => void }) {
  const cartoes = useLiveQuery(() => db.cartoes.where({ ativo: 1 }).toArray(), [], [])
  const [textoValor, setTextoValor] = useState(valorParaTexto(gasto?.valor))
  const [descricao, setDescricao] = useState(gasto?.descricao ?? '')
  const [forma, setForma] = useState<FormaPagamento>(gasto?.forma ?? 'debito')
  const [categoriaId, setCategoriaId] = useState<number | undefined>(gasto?.categoriaId)
  const [data, setData] = useState(gasto?.data ?? hoje())
  const [cartaoId, setCartaoId] = useState<number | undefined>(gasto?.cartaoId)
  const [parcelas, setParcelas] = useState(gasto?.parcelas ?? 1)
  const [erro, setErro] = useState('')
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)

  const cartaoEscolhido = cartoes.find((c) => c.id === (cartaoId ?? cartoes[0]?.id))
  const valor = lerValor(textoValor)

  const previaCredito = useMemo(() => {
    if (forma !== 'credito' || !cartaoEscolhido || !valor || valor <= 0) return null
    const fatura = faturaDaCompra(cartaoEscolhido, data)
    const valores = dividirParcelas(valor, parcelas)
    return { fatura, parcela: valores[valores.length - 1] }
  }, [forma, cartaoEscolhido, valor, parcelas, data])

  async function salvar() {
    if (!valor || valor <= 0) return setErro('Informe o valor.')
    if (!categoriaId) return setErro('Escolha uma categoria.')
    if (forma === 'credito' && !cartaoEscolhido) return setErro('Cadastre um cartão na aba Cartões antes de lançar no crédito.')
    const registro: Gasto = {
      ...(gasto ?? {}),
      valor,
      descricao: descricao.trim() || 'Gasto',
      forma,
      categoriaId,
      data,
      cartaoId: forma === 'credito' ? cartaoEscolhido!.id : undefined,
      parcelas: forma === 'credito' ? parcelas : undefined,
      criadoEm: gasto?.criadoEm ?? new Date().toISOString(),
    }
    if (gasto?.id) {
      const problema = await validarEdicaoGasto(gasto as Gasto & { id: number }, registro)
      if (problema) return setErro(problema)
    }
    await db.transaction('rw', [db.gastos, db.parcelas, db.cartoes, db.pagamentosFatura], async () => {
      const id = await db.gastos.put(registro)
      await atualizarParcelas({ ...registro, id: id as number }, gasto)
    })
    aoFechar()
  }

  async function excluir() {
    if (!gasto?.id) return
    await db.transaction('rw', db.gastos, db.parcelas, async () => {
      await db.parcelas.where({ gastoId: gasto.id }).delete()
      await db.gastos.delete(gasto.id!)
    })
    aoFechar()
  }

  return (
    <Folha titulo={gasto ? 'Editar gasto' : 'Novo gasto'} aoFechar={aoFechar}>
      <div className="campo-valor">
        <span>R$</span>
        <input
          autoFocus={!gasto}
          inputMode="numeric"
          placeholder="0,00"
          value={textoValor}
          onChange={(e) => setTextoValor(mascararValor(e.target.value))}
          aria-label="Valor"
        />
      </div>

      <Campo rotulo="Descrição">
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Camiseta" maxLength={60} />
      </Campo>

      <Campo rotulo="Como pagou">
        <Opcoes rotulo="Forma de pagamento" opcoes={FORMAS} valor={forma} aoMudar={setForma} />
      </Campo>

      {forma === 'credito' && (
        cartoes.length === 0 ? (
          <p className="aviso aviso-alerta">Você ainda não tem cartão cadastrado. Cadastre na aba Cartões.</p>
        ) : (
          <div className="linha-campos">
            <Campo rotulo="Cartão">
              <select value={cartaoEscolhido?.id} onChange={(e) => setCartaoId(Number(e.target.value))}>
                {cartoes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Parcelas">
              <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n === 1 ? 'À vista' : `${n}x`}</option>
                ))}
              </select>
            </Campo>
          </div>
        )
      )}
      {previaCredito && (
        <p className="texto-suave">
          {parcelas > 1 ? `${parcelas}x de ${formatarReais(previaCredito.parcela)}, ` : ''}
          começando na fatura de {nomeMes(previaCredito.fatura)}. Soma na dívida.
        </p>
      )}

      <Campo rotulo="Categoria">
        <SeletorCategoria modo="pessoal" valor={categoriaId} aoMudar={setCategoriaId} />
      </Campo>

      <Campo rotulo="Data">
        <input type="date" value={data} max="2100-12-31" onChange={(e) => e.target.value && setData(e.target.value)} />
      </Campo>

      {erro && <p className="aviso aviso-erro">{erro}</p>}

      <button className="botao botao-principal" onClick={salvar}>Salvar</button>
      {gasto?.id && !confirmarExclusao && (
        <button className="botao botao-texto-perigo" onClick={() => setConfirmarExclusao(true)}>Excluir gasto</button>
      )}
      {confirmarExclusao && (
        <div className="confirmacao">
          <p>Excluir “{gasto?.descricao}” de {formatarDia(gasto!.data)}?{gasto?.forma === 'credito' ? ' As parcelas saem das faturas (inclusive de faturas já pagas, cujo total vai mudar).' : ''}</p>
          <div className="linha-campos">
            <button className="botao" onClick={() => setConfirmarExclusao(false)}>Cancelar</button>
            <button className="botao botao-perigo" onClick={excluir}>Excluir</button>
          </div>
        </div>
      )}
    </Folha>
  )
}
