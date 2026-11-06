import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { formatarReais } from '../dinheiro'
import { formatarDia, formatarDiaCurto, hoje, mesAtual, mesDe, nomeMes, nomeMesCurto, prazo, somarDias, somarMeses } from '../datas'
import { marcarReembolsado, proximasRenovacoes, reembolsosPendentes, resumoEmpresa, type ItemReembolso } from '../regras/empresa'
import { entradasEmpresaDoMes, resultadoEmpresa } from '../regras/empresaMes'
import { AvisoBackup } from '../componentes/AvisoBackup'
import { BarraProgresso, Etiqueta, Folha } from '../componentes/ui'
import { DetalhePlataforma } from './empresa/Plataformas'
import { Retiradas } from './empresa/Retiradas'

export function InicioEmpresa({ aoAbrirAjustes, aoIrPara }: { aoAbrirAjustes: () => void; aoIrPara: (aba: 'saidas' | 'entradas') => void }) {
  const dados = useLiveQuery(async () => {
    const mes = mesAtual()
    const meses = Array.from({ length: 6 }, (_, i) => somarMeses(mes, i - 5))
    const [resultado, resumo, renovacoes, reembolsos, retiradas, historico] = await Promise.all([
      resultadoEmpresa(mes),
      resumoEmpresa(),
      proximasRenovacoes(30),
      reembolsosPendentes(),
      db.retiradas.toArray(),
      Promise.all(meses.map(async (m) => {
        const r = await resultadoEmpresa(m)
        return { mes: m, entrou: r.entradas.recebido, saiu: r.saidas.totalPago }
      })),
    ])
    // Clientes que ainda vão pagar neste mês e no próximo (próximos 30 dias).
    const proximo = await entradasEmpresaDoMes(somarMeses(mes, 1))
    const aReceber = [...resultado.entradas.recorrentes, ...proximo.recorrentes]
      .filter((o) => !o.entrada)
      .filter((o) => o.data <= somarDias(hoje(), 30))
    const retiradoNoMes = retiradas.filter((r) => mesDe(r.data) === mes).reduce((s, r) => s + r.valor, 0)
    return { mes, resultado, resumo, renovacoes, reembolsos, retiradoNoMes, historico, aReceber }
  })
  const [plataformaAberta, setPlataformaAberta] = useState<number | null>(null)
  const [confirmandoTodos, setConfirmandoTodos] = useState(false)
  const [verRetiradas, setVerRetiradas] = useState(false)

  if (!dados) return null
  const { mes, resultado, resumo, renovacoes, reembolsos, retiradoNoMes, historico, aReceber } = dados
  const lucro = resultado.resultado >= 0
  const maiorProduto = Math.max(1, ...resumo.porProduto.map((p) => p.valor))
  const maiorBarra = Math.max(1, ...historico.flatMap((h) => [h.entrou, h.saiu]))
  const temHistorico = historico.some((h) => h.entrou || h.saiu)

  async function reembolsar(itens: ItemReembolso[]) {
    await marcarReembolsado(itens)
    setConfirmandoTodos(false)
  }

  const proximos = [
    ...renovacoes.map((r) => ({ chave: `r-${r.cobranca.id}`, nome: r.plataforma.nome, data: r.data, valor: -r.valorReais, manual: !r.cobranca.renovacaoAutomatica, abrir: () => setPlataformaAberta(r.plataforma.id!) })),
    ...aReceber.map((o) => ({ chave: `c-${o.cliente.id}-${o.data}`, nome: o.cliente.nome, data: o.data, valor: o.valor, manual: false, abrir: () => aoIrPara('entradas') })),
  ].sort((a, b) => a.data.localeCompare(b.data))

  return (
    <div className="tela">
      <AvisoBackup aoAbrirAjustes={aoAbrirAjustes} />

      <section className={`cartao-destaque ${lucro ? 'cartao-lucro' : 'cartao-prejuizo'}`}>
        <span className="rotulo">Resultado de {nomeMes(mes)}</span>
        <strong className="valor-grande">{lucro ? '' : '−'}{formatarReais(Math.abs(resultado.resultado))}</strong>
        <small className="rotulo">{lucro ? (resultado.resultado ? 'Lucro previsto' : 'Empatado') : 'Prejuízo previsto'} · entradas menos saídas do mês</small>
        <div className="divisao">
          <button className="botao-sem-estilo" onClick={() => aoIrPara('entradas')}>
            <span className="rotulo">Entra ↗</span>
            <strong>{formatarReais(resultado.entrou)}</strong>
          </button>
          <button className="botao-sem-estilo" onClick={() => aoIrPara('saidas')}>
            <span className="rotulo">Sai ↘</span>
            <strong>{formatarReais(resultado.saiu)}</strong>
          </button>
        </div>
      </section>

      {resumo.usoAcimaDoLimite.map((u) => (
        <div key={u.plataforma} className="aviso aviso-erro">
          <strong>{u.plataforma} passou do limite</strong>
          <span>{formatarReais(u.valor)} neste mês (limite {formatarReais(u.limite)}).</span>
        </div>
      ))}

      <section className="bloco">
        <h2>Próximos 30 dias</h2>
        {proximos.length === 0 ? (
          <p className="texto-suave">Nada para pagar nem receber nos próximos 30 dias.</p>
        ) : (
          <div className="lista">
            {proximos.map((p) => (
              <button key={p.chave} className="item" onClick={p.abrir}>
                <span className="item-icone" style={{ background: p.valor > 0 ? 'var(--ok-fundo)' : 'var(--destaque-suave)' }}>{p.valor > 0 ? '💰' : '🔁'}</span>
                <span className="item-texto">
                  <strong>{p.nome}</strong>
                  <small className={p.data < hoje() ? 'texto-perigo' : ''}>{formatarDiaCurto(p.data)} · {prazo(p.data)}</small>
                </span>
                <span className="item-direita">
                  <strong className={`item-valor ${p.valor > 0 ? 'texto-ok' : ''}`}>{p.valor > 0 ? '+' : ''}{formatarReais(Math.abs(p.valor))}</strong>
                  {p.manual ? <Etiqueta tipo="alerta">Manual</Etiqueta> : null}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {temHistorico && (
        <section className="bloco">
          <h2>Entradas × saídas</h2>
          <div className="grafico grafico-duplo" role="img" aria-label="Entradas e saídas dos últimos 6 meses">
            {historico.map((h) => (
              <div key={h.mes} className={`grafico-coluna ${h.mes === mes ? 'atual' : ''}`}>
                <div className="grafico-par">
                  <div className="grafico-barra barra-entrada" style={{ height: `${Math.max(2, (h.entrou / maiorBarra) * 100)}%` }} />
                  <div className="grafico-barra barra-saida" style={{ height: `${Math.max(2, (h.saiu / maiorBarra) * 100)}%` }} />
                </div>
                <span>{nomeMesCurto(h.mes)}</span>
              </div>
            ))}
          </div>
          <small className="texto-suave"><span className="ponto ponto-entrada" /> entrou <span className="ponto ponto-saida" /> saiu (o que foi pago)</small>
        </section>
      )}

      <section className="bloco">
        <h2>Você ↔ empresa</h2>
        <div className="linha-resumo">
          <span>A empresa te deve</span>
          <strong>{formatarReais(resumo.aReembolsar)}</strong>
        </div>
        {reembolsos.length > 0 && (
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
        <div className="linha-resumo">
          <span>Você retirou em {nomeMes(mes)}</span>
          <strong>{formatarReais(retiradoNoMes)}</strong>
        </div>
        <button className="botao" onClick={() => setVerRetiradas(true)}>Retiradas (pró-labore)</button>
      </section>

      {resumo.porProduto.length > 0 && (
        <section className="bloco">
          <h2>Custo fixo por produto</h2>
          {resumo.porProduto.map((p) => (
            <div key={p.id} className="linha-categoria">
              <span style={{ color: p.cor, fontWeight: 600 }}>{p.nome}</span>
              <strong>{formatarReais(p.valor)}/mês</strong>
              <BarraProgresso valor={p.valor} total={maiorProduto} />
            </div>
          ))}
          <small className="texto-suave">Total: {formatarReais(resumo.custoMensal)} por mês em plataformas.</small>
        </section>
      )}

      {plataformaAberta !== null && <DetalhePlataforma id={plataformaAberta} aoFechar={() => setPlataformaAberta(null)} />}
      {verRetiradas && (
        <Folha titulo="Retiradas" aoFechar={() => setVerRetiradas(false)}>
          <Retiradas />
        </Folha>
      )}
    </div>
  )
}

