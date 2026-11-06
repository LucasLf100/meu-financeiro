// "Adicionar de um arquivo": soma o conteúdo de um backup ao que já existe no app, sem apagar nada.
// O que já estiver cadastrado (mesmo nome, mesma data e valor…) é reaproveitado ou ignorado.
import {
  db,
  type AjusteConta,
  type Cartao,
  type Categoria,
  type ClienteEmpresa,
  type Cobranca,
  type ContaFixa,
  type Entrada,
  type EntradaEmpresa,
  type Gasto,
  type GastoEmpresa,
  type PagamentoConta,
  type PagamentoCobranca,
  type PagamentoFatura,
  type Parcela,
  type Plataforma,
  type Produto,
  type RecebimentoFixo,
  type Retirada,
} from './db'
import type { ArquivoBackup } from './backup'

export interface ResultadoImportacao {
  adicionados: number
  ignorados: number
}

const chave = (texto: unknown) => String(texto ?? '').trim().toLowerCase()

function linhas<T>(backup: ArquivoBackup, tabela: string): T[] {
  const lista = backup.dados[tabela]
  return Array.isArray(lista) ? (lista as T[]) : []
}

/** Quantos registros o arquivo traria (sem contar configurações). */
export function contarParaAdicionar(backup: ArquivoBackup): number {
  return Object.entries(backup.dados)
    .filter(([nome]) => nome !== 'config')
    .reduce((total, [, lista]) => total + (Array.isArray(lista) ? lista.length : 0), 0)
}

export async function adicionarBackup(backup: ArquivoBackup): Promise<ResultadoImportacao> {
  const resultado: ResultadoImportacao = { adicionados: 0, ignorados: 0 }
  const novo = () => resultado.adicionados++
  const repetido = () => resultado.ignorados++

  const tabelas = [
    db.categorias, db.produtos, db.cartoes, db.contas, db.recebimentos, db.plataformas, db.cobrancas,
    db.gastos, db.parcelas, db.pagamentosFatura, db.pagamentosConta, db.ajustesConta,
    db.pagamentosCobranca, db.gastosEmpresa, db.retiradas, db.entradas,
    db.clientes, db.entradasEmpresa,
  ]

  await db.transaction('rw', tabelas, async () => {
    // Cada mapa liga o id do arquivo ao id que ficou no app.
    const mCategoria = new Map<number, number>()
    const mProduto = new Map<number, number>()
    const mCartao = new Map<number, number>()
    const mConta = new Map<number, number>()
    const contasNovas = new Set<number>()
    const mRecebimento = new Map<number, number>()
    const mPlataforma = new Map<number, number>()
    const mCobranca = new Map<number, number>()
    const mGasto = new Map<number, number>()
    const gastosNovos = new Set<number>()

    // Categorias: mesma categoria = mesmo modo e mesmo nome.
    const categorias = await db.categorias.toArray()
    for (const c of linhas<Categoria>(backup, 'categorias')) {
      const existente = categorias.find((x) => x.modo === c.modo && chave(x.nome) === chave(c.nome))
      if (existente) { mCategoria.set(c.id!, existente.id!); repetido(); continue }
      const { id, ...resto } = c
      mCategoria.set(id!, (await db.categorias.add(resto)) as number); novo()
    }
    // Categoria que não veio no arquivo e não existe: cai em "Outros" do modo.
    const outros = async (modo: 'pessoal' | 'empresa') =>
      (await db.categorias.where({ modo }).filter((c) => chave(c.nome) === 'outros').first())?.id ??
      (await db.categorias.where({ modo }).first())?.id ?? 0
    const categoria = async (id: number | undefined, modo: 'pessoal' | 'empresa') =>
      (id !== undefined ? mCategoria.get(id) : undefined) ?? (await outros(modo))

    const produtos = await db.produtos.toArray()
    for (const p of linhas<Produto>(backup, 'produtos')) {
      const existente = produtos.find((x) => chave(x.nome) === chave(p.nome))
      if (existente) { mProduto.set(p.id!, existente.id!); repetido(); continue }
      const { id, ...resto } = p
      mProduto.set(id!, (await db.produtos.add(resto)) as number); novo()
    }
    const produto = (id?: number) => (id ? mProduto.get(id) : undefined)

    const cartoes = await db.cartoes.toArray()
    for (const c of linhas<Cartao>(backup, 'cartoes')) {
      const existente = cartoes.find((x) => chave(x.nome) === chave(c.nome))
      if (existente) { mCartao.set(c.id!, existente.id!); repetido(); continue }
      const { id, ...resto } = c
      mCartao.set(id!, (await db.cartoes.add(resto)) as number); novo()
    }

    const contas = await db.contas.toArray()
    for (const c of linhas<ContaFixa>(backup, 'contas')) {
      const existente = contas.find((x) => chave(x.nome) === chave(c.nome) && x.inicio === c.inicio)
      if (existente) { mConta.set(c.id!, existente.id!); repetido(); continue }
      const { id, ...resto } = c
      const novoId = (await db.contas.add({ ...resto, categoriaId: resto.categoriaId !== undefined ? await categoria(resto.categoriaId, 'pessoal') : undefined })) as number
      mConta.set(id!, novoId); contasNovas.add(novoId); novo()
    }

    const recebimentos = await db.recebimentos.toArray()
    for (const r of linhas<RecebimentoFixo>(backup, 'recebimentos')) {
      const existente = recebimentos.find((x) => chave(x.nome) === chave(r.nome))
      if (existente) { mRecebimento.set(r.id!, existente.id!); repetido(); continue }
      const { id, ...resto } = r
      mRecebimento.set(id!, (await db.recebimentos.add(resto)) as number); novo()
    }

    const plataformas = await db.plataformas.toArray()
    for (const p of linhas<Plataforma>(backup, 'plataformas')) {
      const existente = plataformas.find((x) => chave(x.nome) === chave(p.nome))
      if (existente) { mPlataforma.set(p.id!, existente.id!); repetido(); continue }
      const { id, ...resto } = p
      mPlataforma.set(id!, (await db.plataformas.add({ ...resto, produtoId: produto(resto.produtoId) })) as number); novo()
    }

    const cobrancas = await db.cobrancas.toArray()
    for (const c of linhas<Cobranca>(backup, 'cobrancas')) {
      const plataformaId = mPlataforma.get(c.plataformaId)
      if (!plataformaId) { repetido(); continue }
      const existente = cobrancas.find((x) => x.plataformaId === plataformaId && x.tipo === c.tipo && x.moeda === c.moeda)
      if (existente) { mCobranca.set(c.id!, existente.id!); repetido(); continue }
      const { id, ...resto } = c
      mCobranca.set(id!, (await db.cobrancas.add({ ...resto, plataformaId })) as number); novo()
    }

    const gastos = await db.gastos.toArray()
    for (const g of linhas<Gasto>(backup, 'gastos')) {
      const existente = gastos.find((x) => x.data === g.data && x.valor === g.valor && chave(x.descricao) === chave(g.descricao))
      if (existente) { mGasto.set(g.id!, existente.id!); repetido(); continue }
      const { id, ...resto } = g
      const cartaoId = resto.cartaoId !== undefined ? mCartao.get(resto.cartaoId) : undefined
      const novoId = (await db.gastos.add({ ...resto, cartaoId, categoriaId: await categoria(resto.categoriaId, 'pessoal') })) as number
      mGasto.set(id!, novoId); gastosNovos.add(novoId); novo()
    }

    // Parcelas só de gastos que acabaram de entrar (os que já existiam já têm as suas).
    for (const p of linhas<Parcela>(backup, 'parcelas')) {
      const gastoId = mGasto.get(p.gastoId)
      const cartaoId = mCartao.get(p.cartaoId)
      if (!gastoId || !cartaoId || !gastosNovos.has(gastoId)) { repetido(); continue }
      const { id: _id, ...resto } = p
      await db.parcelas.add({ ...resto, gastoId, cartaoId }); novo()
    }

    for (const p of linhas<PagamentoFatura>(backup, 'pagamentosFatura')) {
      const cartaoId = mCartao.get(p.cartaoId)
      if (!cartaoId || (await db.pagamentosFatura.where({ cartaoId, fatura: p.fatura }).count())) { repetido(); continue }
      const { id: _id, ...resto } = p
      await db.pagamentosFatura.add({ ...resto, cartaoId }); novo()
    }

    for (const p of linhas<PagamentoConta>(backup, 'pagamentosConta')) {
      const contaId = mConta.get(p.contaId)
      if (!contaId || (await db.pagamentosConta.where({ contaId, competencia: p.competencia }).count())) { repetido(); continue }
      const { id: _id, ...resto } = p
      await db.pagamentosConta.add({ ...resto, contaId }); novo()
    }

    for (const a of linhas<AjusteConta>(backup, 'ajustesConta')) {
      const contaId = mConta.get(a.contaId)
      if (!contaId || !contasNovas.has(contaId)) { repetido(); continue }
      const { id: _id, ...resto } = a
      await db.ajustesConta.add({ ...resto, contaId }); novo()
    }

    for (const p of linhas<PagamentoCobranca>(backup, 'pagamentosCobranca')) {
      const cobrancaId = mCobranca.get(p.cobrancaId)
      if (!cobrancaId) { repetido(); continue }
      const igual = await db.pagamentosCobranca.where({ cobrancaId }).filter((x) => x.pagoEm === p.pagoEm && x.valor === p.valor).count()
      if (igual) { repetido(); continue }
      const { id: _id, ...resto } = p
      const cartaoId = resto.cartaoId !== undefined ? mCartao.get(resto.cartaoId) : undefined
      const gastoPessoalId = resto.gastoPessoalId !== undefined ? mGasto.get(resto.gastoPessoalId) : undefined
      await db.pagamentosCobranca.add({ ...resto, cobrancaId, cartaoId, gastoPessoalId }); novo()
    }

    const gastosEmpresa = await db.gastosEmpresa.toArray()
    for (const g of linhas<GastoEmpresa>(backup, 'gastosEmpresa')) {
      if (gastosEmpresa.some((x) => x.data === g.data && x.valor === g.valor && chave(x.descricao) === chave(g.descricao))) { repetido(); continue }
      const { id: _id, ...resto } = g
      const cartaoId = resto.cartaoId !== undefined ? mCartao.get(resto.cartaoId) : undefined
      const gastoPessoalId = resto.gastoPessoalId !== undefined ? mGasto.get(resto.gastoPessoalId) : undefined
      await db.gastosEmpresa.add({ ...resto, cartaoId, gastoPessoalId, produtoId: produto(resto.produtoId), categoriaId: await categoria(resto.categoriaId, 'empresa') }); novo()
    }

    const retiradas = await db.retiradas.toArray()
    for (const r of linhas<Retirada>(backup, 'retiradas')) {
      if (retiradas.some((x) => x.data === r.data && x.valor === r.valor)) { repetido(); continue }
      const { id: _id, ...resto } = r
      await db.retiradas.add(resto); novo()
    }

    const entradas = await db.entradas.toArray()
    for (const e of linhas<Entrada>(backup, 'entradas')) {
      const recebimentoId = e.recebimentoId !== undefined ? mRecebimento.get(e.recebimentoId) : undefined
      const igual = recebimentoId
        ? entradas.some((x) => x.recebimentoId === recebimentoId && x.competencia === e.competencia)
        : entradas.some((x) => !x.recebimentoId && x.data === e.data && x.valor === e.valor && chave(x.descricao) === chave(e.descricao))
      if (igual) { repetido(); continue }
      const { id: _id, ...resto } = e
      await db.entradas.add({ ...resto, recebimentoId }); novo()
    }

    const mCliente = new Map<number, number>()
    const clientes = await db.clientes.toArray()
    for (const c of linhas<ClienteEmpresa>(backup, 'clientes')) {
      const existente = clientes.find((x) => chave(x.nome) === chave(c.nome))
      if (existente) { mCliente.set(c.id!, existente.id!); repetido(); continue }
      const { id, ...resto } = c
      mCliente.set(id!, (await db.clientes.add({ ...resto, produtoId: produto(resto.produtoId) })) as number); novo()
    }

    const entradasEmpresa = await db.entradasEmpresa.toArray()
    for (const e of linhas<EntradaEmpresa>(backup, 'entradasEmpresa')) {
      const clienteId = e.clienteId !== undefined ? mCliente.get(e.clienteId) : undefined
      const igual = clienteId
        ? entradasEmpresa.some((x) => x.clienteId === clienteId && x.competencia === e.competencia)
        : entradasEmpresa.some((x) => !x.clienteId && x.data === e.data && x.valor === e.valor && chave(x.descricao) === chave(e.descricao))
      if (igual) { repetido(); continue }
      const { id: _id, ...resto } = e
      await db.entradasEmpresa.add({ ...resto, clienteId, produtoId: produto(resto.produtoId) }); novo()
    }
  })

  return resultado
}
