import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { formatarReais } from '../dinheiro'
import { formatarDiaCurto, mesAtual, MESES, nomeMesCurto, prazo } from '../datas'
import { resumoPessoal, type Compromisso } from '../regras/resumo'
import { AvisoBackup } from '../componentes/AvisoBackup'
import { BarraProgresso, Folha } from '../componentes/ui'
import type { Aba } from '../componentes/BarraInferior'

interface Props {
  aoAbrirAjustes: () => void
  aoAbrirRelatorios: () => void
  aoIrPara: (aba: Aba) => void
  aoIrParaEmpresa: () => void
  aoIrParaRecebimentos: () => void
}

export function InicioPessoal({ aoAbrirAjustes, aoAbrirRelatorios, aoIrPara, aoIrParaEmpresa, aoIrParaRecebimentos }: Props) {
  const r = useLiveQuery(resumoPessoal)
  const mes = mesAtual()
  const [verDetalhes, setVerDetalhes] = useState(false)

  if (!r) return null
  const totalDoMes = r.pagoNoMes + r.venceEsteMes
  const maiorBarra = Math.max(1, ...r.grafico.map((g) => g.valor))

  return (
    <div className="tela">
      <AvisoBackup aoAbrirAjustes={aoAbrirAjustes} />

      <section className="cartao-destaque clicavel" onClick={() => setVerDetalhes(true)} role="button" tabIndex={0} aria-label="Ver como a dívida é calculada">
        <span className="rotulo">Dívida total · toque para ver o detalhe</span>
        <strong className="valor-grande">{formatarReais(r.dividaTotal)}</strong>
        <div className="divisao">
          <div>
            <span className="rotulo">Vence em {MESES[Number(mes.slice(5, 7)) - 1]}</span>
            <strong>{formatarReais(r.venceEsteMes)}</strong>
          </div>
          <div>
            <span className="rotulo">Parcelas futuras</span>
            <strong>{formatarReais(r.parcelasFuturas)}</strong>
          </div>
        </div>
        {totalDoMes > 0 && (
          <div className="progresso-destaque">
            <BarraProgresso valor={r.pagoNoMes} total={totalDoMes} />
            <small>{formatarReais(r.pagoNoMes)} pagos de {formatarReais(totalDoMes)} neste mês</small>
          </div>
        )}
      </section>

      <section className="cartao-destaque cartao-saidas">
        <span className="rotulo">A pagar em {MESES[Number(mes.slice(5, 7)) - 1]}</span>
        <strong className="valor-grande">{formatarReais(r.saidas.total)}</strong>
        <div className="divisao">
          <div>
            <span className="rotulo">Já pago</span>
            <strong>{formatarReais(r.saidas.pago)}</strong>
          </div>
          <div>
            <span className="rotulo">Falta pagar</span>
            <strong>{formatarReais(r.saidas.falta)}</strong>
          </div>
        </div>
        {r.saidas.total > 0 && (
          <div className="progresso-destaque">
            <BarraProgresso valor={r.saidas.pago} total={r.saidas.total} />
            <small>
              Contas fixas {formatarReais(r.saidas.contasFixas)} · Parcelas e cartão {formatarReais(r.saidas.parcelasECartao)} · Gastos avulsos{' '}
              {formatarReais(r.saidas.gastosAvulsos)}
              {r.saidas.empresa > 0 && <> · Empresa (do meu bolso) {formatarReais(r.saidas.empresa)}</>}
            </small>
          </div>
        )}
      </section>

      {verDetalhes && (
        <Folha titulo="Como a dívida é calculada" aoFechar={() => setVerDetalhes(false)}>
          <p className="texto-suave">
            Dívida é o que tem fim: parcelas de contas fixas com número de parcelas (financiamento, empréstimo) e o cartão
            (faturas e parcelas futuras). Só entra o que ainda não foi pago. Contas recorrentes, como luz, água e telefone,
            ficam no bloco “Contas fixas do mês”.
          </p>
          {(['agora', 'futuro'] as const).map((quando) => {
            const itens = r.detalhesDivida.filter((d) => d.quando === quando)
            const total = itens.reduce((s, d) => s + d.valor, 0)
            return (
              <section key={quando} className="grupo">
                <h3 className="grupo-titulo">
                  <span>{quando === 'agora' ? `Vence em ${MESES[Number(mes.slice(5, 7)) - 1]}` : 'Parcelas futuras'}</span>
                  <span>{formatarReais(total)}</span>
                </h3>
                {itens.length === 0 ? (
                  <p className="texto-suave">Nada aqui.</p>
                ) : (
                  <div className="lista">
                    {itens.map((d, i) => (
                      <div key={i} className="item item-estatico">
                        <span className="item-texto">
                          <strong>{d.rotulo}</strong>
                          <small>{d.detalhe}</small>
                        </span>
                        <strong className="item-valor">{formatarReais(d.valor)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
          <p className="texto-suave">
            Um financiamento não aparece? Na aba Contas, edite a conta e ligue “Tem número de parcelas”.
          </p>
        </Folha>
      )}

      <section className="bloco">
        <div className="linha-resumo">
          <h2>Contas fixas do mês</h2>
          <button className="botao-link" onClick={() => aoIrPara('contas')}>{r.recorrentes.quantidade ? 'Ver' : 'Cadastrar'}</button>
        </div>
        {r.recorrentes.quantidade === 0 ? (
          <p className="texto-suave">Luz, água, telefone, internet, aluguel… cadastre na aba Contas as contas que se repetem todo mês.</p>
        ) : (
          <>
            <div className="linha-resumo">
              <span>Total do mês</span>
              <strong>{formatarReais(r.recorrentes.total)}</strong>
            </div>
            <BarraProgresso valor={r.recorrentes.pago} total={r.recorrentes.total} perigo={r.recorrentes.atrasadas > 0} />
            <div className="linha-resumo">
              <small className="texto-suave">{formatarReais(r.recorrentes.pago)} pagos</small>
              <small className={r.recorrentes.atrasadas ? 'texto-perigo' : 'texto-suave'}>
                Falta {formatarReais(r.recorrentes.falta)}
                {r.recorrentes.atrasadas ? ` · ${r.recorrentes.atrasadas} atrasada${r.recorrentes.atrasadas > 1 ? 's' : ''}` : ''}
              </small>
            </div>
          </>
        )}
      </section>

      <section className="bloco">
        <div className="linha-resumo">
          <h2>Entradas do mês</h2>
          <button className="botao-link" onClick={aoIrParaRecebimentos}>{r.entradasPrevistas ? 'Ver' : 'Cadastrar'}</button>
        </div>
        {r.entradasPrevistas === 0 ? (
          <p className="texto-suave">Cadastre seu salário e outros valores que entram, para ver quanto sobra no mês.</p>
        ) : (
          <>
            <div className="linha-resumo">
              <span>Entra no mês</span>
              <strong className="texto-ok">{formatarReais(r.entradasPrevistas)}</strong>
            </div>
            <BarraProgresso valor={r.entradasRecebidas} total={r.entradasPrevistas} />
            <small className="texto-suave">{formatarReais(r.entradasRecebidas)} já recebidos</small>
            <div className="linha-resumo">
              <span>Sobra prevista</span>
              <strong className={r.sobraPrevista < 0 ? 'texto-perigo' : 'texto-ok'}>{formatarReais(r.sobraPrevista)}</strong>
            </div>
            <small className="texto-suave">Entradas − contas e faturas do mês − gastos pagos na hora.</small>
          </>
        )}
      </section>

      {r.atrasados.length > 0 && (
        <section className="bloco bloco-perigo">
          <h2>Atrasadas</h2>
          <ListaCompromissos itens={r.atrasados} aoIrPara={aoIrPara} />
        </section>
      )}

      <section className="bloco">
        <h2>Próximos 7 dias</h2>
        {r.proximos.length === 0 ? (
          <p className="texto-suave">Nada vencendo nos próximos 7 dias. 🎉</p>
        ) : (
          <ListaCompromissos itens={r.proximos} aoIrPara={aoIrPara} />
        )}
      </section>

      {r.cartoes.length > 0 && (
        <section className="bloco">
          <h2>Cartões</h2>
          {r.cartoes.map(({ cartao, usado }) => (
            <button key={cartao.id} className="linha-categoria linha-clicavel" onClick={() => aoIrPara('cartoes')}>
              <span>{cartao.nome}</span>
              <strong>{formatarReais(cartao.limite - usado)} livres</strong>
              <BarraProgresso valor={usado} total={cartao.limite} perigo={usado > cartao.limite} />
            </button>
          ))}
        </section>
      )}

      <section className="bloco">
        <h2>Compromissos por mês</h2>
        <div className="grafico" role="img" aria-label="Contas e faturas dos últimos 6 meses">
          {r.grafico.map((g) => (
            <div key={g.mes} className={`grafico-coluna ${g.mes === mes ? 'atual' : ''}`}>
              <small>{g.valor ? formatarReais(g.valor).replace(/,\d\d$/, '') : ''}</small>
              <div className="grafico-barra" style={{ height: `${Math.max(2, (g.valor / maiorBarra) * 100)}%` }} />
              <span>{nomeMesCurto(g.mes)}</span>
            </div>
          ))}
        </div>
        <small className="texto-suave">Contas fixas + faturas de cada mês.</small>
        <button className="botao" onClick={aoAbrirRelatorios}>Ver relatórios</button>
      </section>

      <section className="bloco">
        <div className="linha-resumo">
          <span>Gastos avulsos no mês</span>
          <button className="botao-link" onClick={() => aoIrPara('gastos')}>{formatarReais(r.gastosDoMes)}</button>
        </div>
        {r.aReceberEmpresa > 0 && (
          <div className="linha-resumo">
            <span>A receber da empresa</span>
            <button className="botao-link" onClick={aoIrParaEmpresa}>{formatarReais(r.aReceberEmpresa)}</button>
          </div>
        )}
        {r.retiradasDoMes > 0 && (
          <div className="linha-resumo">
            <span>Retiradas da empresa no mês</span>
            <strong className="texto-ok">+ {formatarReais(r.retiradasDoMes)}</strong>
          </div>
        )}
      </section>
    </div>
  )
}

function ListaCompromissos({ itens, aoIrPara }: { itens: Compromisso[]; aoIrPara: (aba: Aba) => void }) {
  return (
    <div className="lista">
      {itens.map((c) => (
        <button key={c.chave} className="item" onClick={() => aoIrPara(c.tipo === 'conta' ? 'contas' : 'cartoes')}>
          <span className="item-icone">{c.tipo === 'conta' ? '📄' : '💳'}</span>
          <span className="item-texto">
            <strong>{c.nome}</strong>
            <small className={c.atrasado ? 'texto-perigo' : ''}>
              {formatarDiaCurto(c.vencimento)} · {c.atrasado ? `venceu ${prazo(c.vencimento)}` : `vence ${prazo(c.vencimento)}`}
            </small>
          </span>
          <strong className="item-valor">{formatarReais(c.valor)}</strong>
        </button>
      ))}
    </div>
  )
}
