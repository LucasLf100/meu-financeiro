import { useDeferredValue, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Gasto, type GastoEmpresa, type Retirada } from '../db'
import { formatarReais } from '../dinheiro'
import { formatarDia } from '../datas'
import { FormGasto, NOME_FORMA } from './FormGasto'
import { FormGastoEmpresa, FormRetirada } from './empresa/Formularios'
import { DetalhePlataforma } from './empresa/Plataformas'

/** Minúsculas e sem acento: "Alimentação" e "alimentacao" casam. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** "79,90" ou "79.90" ou "R$ 1.234" viram o mesmo formato do valor exibido. */
function textoDoValor(centavos: number): string {
  return normalizar(formatarReais(centavos).replace(/ /g, ' '))
}

interface Resultado {
  chave: string
  grupo: string
  icone: string
  titulo: string
  detalhe: string
  valor?: number
  data?: string
  abrir?: () => void
}

type Aberto =
  | { tipo: 'gasto'; item: Gasto }
  | { tipo: 'gastoEmpresa'; item: GastoEmpresa }
  | { tipo: 'retirada'; item: Retirada }
  | { tipo: 'plataforma'; id: number }

const ORDEM_GRUPOS = ['Gastos', 'Contas fixas', 'Recebimentos', 'Plataformas', 'Gastos da empresa', 'Retiradas']

export function Busca({ aoVoltar }: { aoVoltar: () => void }) {
  const [texto, setTexto] = useState('')
  const termo = normalizar(useDeferredValue(texto).trim())
  const [aberto, setAberto] = useState<Aberto | null>(null)

  const resultados = useLiveQuery(async (): Promise<Resultado[]> => {
    if (termo.length < 2) return []
    // Aceita "79.90" como "79,90".
    const termoValor = termo.replace(/^r\$\s*/, '').replace(/\.(\d{1,2})$/, ',$1')
    const casa = (...partes: Array<string | undefined>) => partes.some((p) => p && normalizar(p).includes(termo))
    const casaValor = (centavos: number) => /\d/.test(termoValor) && textoDoValor(centavos).includes(termoValor)

    const [gastos, contas, recebimentos, entradas, plataformas, produtos, gastosEmpresa, retiradas, categorias] = await Promise.all([
      db.gastos.toArray(),
      db.contas.toArray(),
      db.recebimentos.toArray(),
      db.entradas.toArray(),
      db.plataformas.toArray(),
      db.produtos.toArray(),
      db.gastosEmpresa.toArray(),
      db.retiradas.toArray(),
      db.categorias.toArray(),
    ])
    const categoria = (id?: number) => categorias.find((c) => c.id === id)
    const lista: Resultado[] = []

    for (const g of gastos) {
      const c = categoria(g.categoriaId)
      if (!casa(g.descricao, c?.nome, NOME_FORMA[g.forma]) && !casaValor(g.valor)) continue
      lista.push({
        chave: `g${g.id}`, grupo: 'Gastos', icone: c?.icone ?? '📦', titulo: g.descricao,
        detalhe: `${formatarDia(g.data)} · ${c?.nome ?? ''} · ${NOME_FORMA[g.forma]}${g.parcelas && g.parcelas > 1 ? ` ${g.parcelas}x` : ''}`,
        valor: g.valor, data: g.data, abrir: () => setAberto({ tipo: 'gasto', item: g }),
      })
    }
    for (const c of contas) {
      if (!casa(c.nome, categoria(c.categoriaId)?.nome) && !casaValor(c.valor)) continue
      lista.push({
        chave: `c${c.id}`, grupo: 'Contas fixas', icone: categoria(c.categoriaId)?.icone ?? '📄', titulo: c.nome,
        detalhe: `Vence dia ${c.diaVencimento}${c.fim ? ` · até ${c.fim.slice(5)}/${c.fim.slice(0, 4)}` : ''} · edite na aba Contas`,
        valor: c.valor,
      })
    }
    for (const r of recebimentos) {
      if (!casa(r.nome) && !casaValor(r.valor)) continue
      lista.push({ chave: `r${r.id}`, grupo: 'Recebimentos', icone: '💰', titulo: r.nome, detalhe: `Fixo, cai dia ${r.dia}`, valor: r.valor })
    }
    for (const e of entradas) {
      if (e.recebimentoId) continue // os fixos já aparecem acima
      if (!casa(e.descricao) && !casaValor(e.valor)) continue
      lista.push({ chave: `e${e.id}`, grupo: 'Recebimentos', icone: '➕', titulo: e.descricao, detalhe: formatarDia(e.data), valor: e.valor, data: e.data })
    }
    for (const p of plataformas) {
      const produto = produtos.find((x) => x.id === p.produtoId)
      if (!casa(p.nome, p.descricao, p.plano, p.emailConta, p.observacoes, produto?.nome)) continue
      lista.push({
        chave: `p${p.id}`, grupo: 'Plataformas', icone: '🧩', titulo: p.nome,
        detalhe: [produto?.nome, p.descricao].filter(Boolean).join(' · '), abrir: () => setAberto({ tipo: 'plataforma', id: p.id! }),
      })
    }
    for (const g of gastosEmpresa) {
      const c = categoria(g.categoriaId)
      if (!casa(g.descricao, c?.nome, g.comprovante) && !casaValor(g.valor)) continue
      lista.push({
        chave: `ge${g.id}`, grupo: 'Gastos da empresa', icone: c?.icone ?? '📦', titulo: g.descricao,
        detalhe: `${formatarDia(g.data)} · ${c?.nome ?? ''}`, valor: g.valor, data: g.data, abrir: () => setAberto({ tipo: 'gastoEmpresa', item: g }),
      })
    }
    for (const r of retiradas) {
      if (!casa(r.observacao, 'retirada') && !casaValor(r.valor)) continue
      lista.push({
        chave: `rt${r.id}`, grupo: 'Retiradas', icone: '💸', titulo: r.observacao || 'Retirada',
        detalhe: formatarDia(r.data), valor: r.valor, data: r.data, abrir: () => setAberto({ tipo: 'retirada', item: r }),
      })
    }
    return lista.sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))
  }, [termo])

  const grupos = ORDEM_GRUPOS.map((nome) => ({ nome, itens: (resultados ?? []).filter((r) => r.grupo === nome) })).filter((g) => g.itens.length)

  return (
    <div className="app">
      <header className="cabecalho">
        <button className="botao-icone" onClick={aoVoltar} aria-label="Voltar">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <input
          className="campo-busca"
          type="search"
          autoFocus
          placeholder="Buscar descrição, categoria, valor…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Buscar"
        />
      </header>
      <main className="conteudo">
        <div className="tela">
          {termo.length < 2 && <p className="texto-suave centro">Digite pelo menos 2 letras. Busca em gastos, contas, recebimentos e na Empresa.</p>}
          {termo.length >= 2 && resultados && grupos.length === 0 && <p className="texto-suave centro">Nada encontrado para “{texto.trim()}”.</p>}
          {grupos.map((g) => (
            <section key={g.nome} className="grupo">
              <h3 className="grupo-titulo"><span>{g.nome}</span><span>{g.itens.length}</span></h3>
              <div className="lista">
                {g.itens.slice(0, 50).map((r) => {
                  const conteudo = (
                    <>
                      <span className="item-icone">{r.icone}</span>
                      <span className="item-texto">
                        <strong>{r.titulo}</strong>
                        <small>{r.detalhe}</small>
                      </span>
                      {r.valor !== undefined && <strong className="item-valor">{formatarReais(r.valor)}</strong>}
                    </>
                  )
                  return r.abrir ? (
                    <button key={r.chave} className="item" onClick={r.abrir}>{conteudo}</button>
                  ) : (
                    <div key={r.chave} className="item item-estatico">{conteudo}</div>
                  )
                })}
              </div>
              {g.itens.length > 50 && <small className="texto-suave">Mostrando 50 de {g.itens.length}. Refine a busca.</small>}
            </section>
          ))}
        </div>
      </main>

      {aberto?.tipo === 'gasto' && <FormGasto gasto={aberto.item} aoFechar={() => setAberto(null)} />}
      {aberto?.tipo === 'gastoEmpresa' && <FormGastoEmpresa gasto={aberto.item} aoFechar={() => setAberto(null)} />}
      {aberto?.tipo === 'retirada' && <FormRetirada retirada={aberto.item} aoFechar={() => setAberto(null)} />}
      {aberto?.tipo === 'plataforma' && <DetalhePlataforma id={aberto.id} aoFechar={() => setAberto(null)} />}
    </div>
  )
}
