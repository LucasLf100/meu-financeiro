import Dexie, { type EntityTable } from 'dexie'

export type Modo = 'pessoal' | 'empresa'

export interface Categoria {
  id?: number
  modo: Modo
  nome: string
  icone: string
  cor: string
  arquivada: 0 | 1
  ordem: number
}

export type FormaPagamento = 'debito' | 'pix' | 'dinheiro' | 'credito'

export interface Gasto {
  id?: number
  valor: number // centavos
  descricao: string
  forma: FormaPagamento
  categoriaId: number
  data: string // AAAA-MM-DD
  cartaoId?: number
  parcelas?: number
  criadoEm: string
}

export interface ContaFixa {
  id?: number
  nome: string
  valor: number
  diaVencimento: number
  categoriaId?: number
  valorVariavel: boolean
  inicio: string // AAAA-MM (primeiro mês)
  fim?: string // AAAA-MM (último mês); vazio = sem fim
  totalParcelas?: number
  parcelaInicial?: number // número da parcela no mês de início (padrão 1)
  ativa: 0 | 1
}

/** Mudança que vale só para um mês de uma conta fixa. */
export interface AjusteConta {
  id?: number
  contaId: number
  competencia: string // AAAA-MM
  valor?: number
  diaVencimento?: number
  pulada?: boolean
}

export interface PagamentoConta {
  id?: number
  contaId: number
  competencia: string // AAAA-MM
  valor: number
  pagoEm: string
}

export interface Cartao {
  id?: number
  nome: string
  limite: number
  diaFechamento: number
  diaVencimento: number
  cor: string
  ativo: 0 | 1
}

export interface Parcela {
  id?: number
  gastoId: number
  cartaoId: number
  numero: number
  total: number
  valor: number
  fatura: string // AAAA-MM do vencimento
}

export interface PagamentoFatura {
  id?: number
  cartaoId: number
  fatura: string
  valor: number
  pagoEm: string
}

export interface Produto {
  id?: number
  nome: string
  cor: string
}

export type StatusPlataforma = 'ativa' | 'teste' | 'planejada' | 'cancelada'

export interface Plataforma {
  id?: number
  nome: string
  descricao: string
  produtoId: number
  link?: string
  emailConta?: string
  plano?: string
  status: StatusPlataforma
  observacoes?: string
}

export type TipoCobranca = 'mensal' | 'anual' | 'unica' | 'uso' | 'gratis'

export interface Cobranca {
  id?: number
  plataformaId: number
  tipo: TipoCobranca
  moeda: 'BRL' | 'USD'
  valor: number
  proximaRenovacao?: string
  renovacaoAutomatica: boolean
  formaPagamento?: string
  limiteEsperado?: number
  pagoPorMim: boolean
}

export interface PagamentoCobranca {
  id?: number
  cobrancaId: number
  valor: number // sempre em reais (centavos)
  valorOriginal?: number // em dólar, se for o caso
  pagoEm: string
  pagoPorMim: boolean
  reembolsadoEm?: string
  comprovante?: string
}

export interface GastoEmpresa {
  id?: number
  valor: number
  descricao: string
  produtoId: number
  categoriaId: number
  data: string
  pagoPorMim: boolean
  reembolsadoEm?: string
  comprovante?: string
}

export interface Retirada {
  id?: number
  valor: number
  data: string
  observacao?: string
}

/** Dinheiro que entra todo mês com valor previsto (salário, aluguel recebido, mesada…). */
export interface RecebimentoFixo {
  id?: number
  nome: string
  valor: number
  dia: number
  inicio: string // AAAA-MM
  fim?: string // AAAA-MM
  ativa: 0 | 1
}

/** Dinheiro que entrou de fato: confirmação de um recebimento fixo ou um valor avulso do mês. */
export interface Entrada {
  id?: number
  recebimentoId?: number // vazio = valor avulso (freela, venda, presente…)
  competencia: string // AAAA-MM
  descricao: string
  valor: number
  data: string // AAAA-MM-DD
}

export interface Config {
  chave: string
  valor: unknown
}

export class BancoFinanceiro extends Dexie {
  categorias!: EntityTable<Categoria, 'id'>
  gastos!: EntityTable<Gasto, 'id'>
  contas!: EntityTable<ContaFixa, 'id'>
  pagamentosConta!: EntityTable<PagamentoConta, 'id'>
  ajustesConta!: EntityTable<AjusteConta, 'id'>
  cartoes!: EntityTable<Cartao, 'id'>
  parcelas!: EntityTable<Parcela, 'id'>
  pagamentosFatura!: EntityTable<PagamentoFatura, 'id'>
  produtos!: EntityTable<Produto, 'id'>
  plataformas!: EntityTable<Plataforma, 'id'>
  cobrancas!: EntityTable<Cobranca, 'id'>
  pagamentosCobranca!: EntityTable<PagamentoCobranca, 'id'>
  gastosEmpresa!: EntityTable<GastoEmpresa, 'id'>
  retiradas!: EntityTable<Retirada, 'id'>
  recebimentos!: EntityTable<RecebimentoFixo, 'id'>
  entradas!: EntityTable<Entrada, 'id'>
  config!: EntityTable<Config, 'chave'>

  constructor() {
    super('meu-financeiro')
    this.version(1).stores({
      categorias: '++id, modo, arquivada',
      gastos: '++id, data, categoriaId, forma, cartaoId',
      contas: '++id, ativa',
      pagamentosConta: '++id, contaId, competencia, [contaId+competencia]',
      cartoes: '++id, ativo',
      parcelas: '++id, gastoId, cartaoId, fatura, [cartaoId+fatura]',
      pagamentosFatura: '++id, cartaoId, fatura, [cartaoId+fatura]',
      produtos: '++id',
      plataformas: '++id, produtoId, status',
      cobrancas: '++id, plataformaId, tipo, proximaRenovacao',
      pagamentosCobranca: '++id, cobrancaId, pagoEm',
      gastosEmpresa: '++id, data, produtoId, categoriaId',
      retiradas: '++id, data',
      config: 'chave',
    })
    this.version(2).stores({
      ajustesConta: '++id, contaId, competencia, [contaId+competencia]',
    })
    this.version(3).stores({
      recebimentos: '++id, ativa',
      entradas: '++id, recebimentoId, competencia, data',
    })
  }
}

export const db = new BancoFinanceiro()

/** Tabelas na ordem usada pelo backup. */
export const TABELAS = [
  'categorias', 'gastos', 'contas', 'pagamentosConta', 'ajustesConta', 'cartoes', 'parcelas',
  'pagamentosFatura', 'produtos', 'plataformas', 'cobrancas', 'pagamentosCobranca',
  'gastosEmpresa', 'retiradas', 'recebimentos', 'entradas', 'config',
] as const

export async function lerConfig<T>(chave: string, padrao: T): Promise<T> {
  const item = await db.config.get(chave)
  return item === undefined ? padrao : (item.valor as T)
}

export async function salvarConfig(chave: string, valor: unknown): Promise<void> {
  await db.config.put({ chave, valor })
}
