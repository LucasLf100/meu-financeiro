import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type GastoEmpresa } from '../db'
import { formatarReais } from '../dinheiro'
import { formatarDia, formatarDiaCurto, mesAtual, prazo } from '../datas'
import { marcarReembolsado, proximasRenovacoes, reembolsosPendentes, resumoEmpresa, type ItemReembolso } from '../regras/empresa'
import { AvisoBackup } from '../componentes/AvisoBackup'
import { BarraProgresso, Etiqueta } from '../componentes/ui'
import { FormGastoEmpresa } from './empresa/Formularios'
import { DetalhePlataforma } from './empresa/Plataformas'

export function InicioEmpresa({ aoAbrirAjustes }: { aoAbrirAjustes: () => void }) {
  const dados = useLiveQuery(async () => {
    const mes = mesAtual()
    const [resumo, renovacoes, reembolsos, gastos, categorias] = await Promise.all([
      resumoEmpresa(),
      proximasRenovacoes(60),
      reembolsosPendentes(),
      db.gastosEmpresa.where('data').between(`${mes}-01`, `${mes}-31`, true, true).reverse().sortBy('data'),
      db.categorias.where({ modo: 'empresa' }).toArray(),
    ])
    return { resumo, renovacoes, reembolsos, gastos, categorias }
  })
  const [plataformaAberta, setPlataformaAberta] = useState<number | null>(null)
  const [gastoAberto, setGastoAberto] = useState<GastoEmpresa | null>(null)
  const [confirmandoTodos, setConfirmandoTodos] = useState(false)

  if (!dados) return null
  const { resumo, renovacoes, reembolsos, gastos, categorias } = dados
  const maiorProduto = Math.max(1, ...resumo.porProduto.map((p) => p.valor))

  async function reembolsar(itens: ItemReembolso[]) {
    await marcarReembolsado(itens)
    setConfirmandoTodos(false)
  }

  return (
    <div className="tela">
      <AvisoBackup aoAbrirAjustes={aoAbrirAjustes} />

      <section className="cartao-destaque">
        <span className="rotulo">Custo mensal da empresa</span>
        <strong className="valor-grande">{formatarReais(resumo.custoMensal)}</strong>
        <div className="divisao">
          <div>
            <span className="rotulo">Gasto real do mês</span>
            <strong>{formatarReais(resumo.gastoDoMes)}</strong>
          </div>
          <div>
            <span className="rotulo">A reembolsar para mim</span>
            <strong>{formatarReais(resumo.aReembolsar)}</strong>
          </div>
        </div>
      </section>

      {resumo.usoAcimaDoLimite.map((u) => (
        <div key={u.plataforma} className="aviso aviso-erro">
          <strong>{u.plataforma} passou do limite</strong>
          <span>{formatarReais(u.valor)} neste mês (limite {formatarReais(u.limite)}).</span>
        </div>
      ))}

      <section className="bloco">
        <h2>Próximas renovações</h2>
        {renovacoes.length === 0 ? (
          <p className="texto-suave">Nenhuma renovação nos próximos 60 dias.</p>
        ) : (
          <div className="lista">
            {renovacoes.map((r) => (
              <button key={r.cobranca.id} className="item" onClick={() => setPlataformaAberta(r.plataforma.id!)}>
                <span className="item-texto">
                  <strong>{r.plataforma.nome}</strong>
                  <small className={r.dias < 0 ? 'texto-perigo' : ''}>{formatarDia(r.data)} · {prazo(r.data)}</small>
                </span>
                <span className="item-direita">
                  <strong className="item-valor">{formatarReais(r.valorReais)}</strong>
                  {!r.cobranca.renovacaoAutomatica ? <Etiqueta tipo={r.alerta ? 'perigo' : 'alerta'}>Manual</Etiqueta> : r.alerta ? <Etiqueta tipo="alerta">Em breve</Etiqueta> : null}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {resumo.porProduto.length > 0 && <section className="bloco">
        <h2>Custo por produto</h2>
        {resumo.porProduto.map((p) => (
          <div key={p.id} className="linha-categoria">
            <span style={{ color: p.cor, fontWeight: 600 }}>{p.nome}</span>
            <strong>{formatarReais(p.valor)}/mês</strong>
            <BarraProgresso valor={p.valor} total={maiorProduto} />
          </div>
        ))}
      </section>}

      <section className="bloco">
        <div className="linha-resumo">
          <h2>A reembolsar</h2>
          <strong>{formatarReais(resumo.aReembolsar)}</strong>
        </div>
        {reembolsos.length === 0 ? (
          <p className="texto-suave">Nada pendente.</p>
        ) : (
          <>
            <div className="lista">
              {reembolsos.map((r) => (
                <div key={`${r.tipo}-${r.id}`} className="item item-estatico">
                  <span className="item-texto">
                    <strong>{r.descricao}</strong>
                    <small>{formatarDia(r.data)}{r.comprovante ? ` · ${r.comprovante}` : ''}</small>
                  </span>
                  <span className="item-direita">
                    <strong className="item-valor">{formatarReais(r.valor)}</strong>
                    <button className="botao-link" onClick={() => reembolsar([r])}>Recebi</button>
                  </span>
                </div>
              ))}
            </div>
            {reembolsos.length > 1 && !confirmandoTodos && (
              <button className="botao" onClick={() => setConfirmandoTodos(true)}>Marcar todos como reembolsados</button>
            )}
            {confirmandoTodos && (
              <div className="confirmacao">
                <p>Marcar os {reembolsos.length} itens ({formatarReais(resumo.aReembolsar)}) como reembolsados hoje?</p>
                <div className="linha-campos">
                  <button className="botao" onClick={() => setConfirmandoTodos(false)}>Cancelar</button>
                  <button className="botao botao-principal" onClick={() => reembolsar(reembolsos)}>Confirmar</button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="bloco">
        <h2>Gastos avulsos do mês</h2>
        {gastos.length === 0 ? (
          <p className="texto-suave">Nenhum. Use o + para lançar taxas, compras e outros gastos da empresa.</p>
        ) : (
          <div className="lista">
            {gastos.map((g) => {
              const c = categorias.find((x) => x.id === g.categoriaId)
              return (
                <button key={g.id} className="item" onClick={() => setGastoAberto(g)}>
                  <span className="item-icone" style={{ background: `${c?.cor ?? '#94a3b8'}22` }}>{c?.icone ?? '📦'}</span>
                  <span className="item-texto">
                    <strong>{g.descricao}</strong>
                    <small>{formatarDiaCurto(g.data)} · {c?.nome}{g.pagoPorMim ? ' · pago por mim' : ''}</small>
                  </span>
                  <strong className="item-valor">{formatarReais(g.valor)}</strong>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {plataformaAberta !== null && <DetalhePlataforma id={plataformaAberta} aoFechar={() => setPlataformaAberta(null)} />}
      {gastoAberto && <FormGastoEmpresa gasto={gastoAberto} aoFechar={() => setGastoAberto(null)} />}
    </div>
  )
}
