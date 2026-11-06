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
  formaPagamento?: FormaConta // por onde a conta é paga (cartão, boleto, Pix…)
  cartaoId?: number // se for paga no cartão: qual cartão (pagar a fatura marca a conta como paga)
  frequencia?: 'mensal' | 'anual' // padrão: mensal. Anual vence uma vez por ano, no mês de início.
  ativa: 0 | 1
}

export type FormaConta = 'cartao' | 'boleto' | 'pix' | 'debito' | 'dinheiro' | 'varia'

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
  viaFaturaCartaoId?: number // marcado como pago ao pagar a fatura deste cartão
  forma?: Exclude<FormaConta, 'varia'> // como foi paga neste mês
  cartaoId?: number // se foi no cartão: qual
  comReserva?: boolean // pago com dinheiro que eu já tinha (não desconta das entradas do mês)
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
  comReserva?: boolean // pago com dinheiro que eu já tinha (não desconta das entradas do mês)
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
  produtoId?: number // vazio = empresa em geral
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

/**
 * De onde saiu o dinheiro de um gasto da empresa:
 * caixa da empresa, cartão da empresa, do meu bolso (Pix/débito/dinheiro) ou meu cartão pessoal.
 * "bolso" e "cartao-pessoal" são "pago por mim" (a empresa me reembolsa).
 */
export type OrigemPagamento = 'caixa' | 'cartao-empresa' | 'bolso' | 'cartao-pessoal'

export interface PagamentoCobranca {
  id?: number
  cobrancaId: number
  valor: number // sempre em reais (centavos)
  valorOriginal?: number // em dólar, se for o caso
  pagoEm: string
  pagoPorMim: boolean
  reembolsadoEm?: string
  comprovante?: string
  origem?: OrigemPagamento
  cartaoId?: number // cartão pessoal, quando origem = cartao-pessoal
  gastoPessoalId?: number // compra criada na fatura do cartão pessoal
}

export interface GastoEmpresa {
  id?: number
  valor: number
  descricao: string
  produtoId?: number // vazio = empresa em geral
  categoriaId: number
  data: string
  pagoPorMim: boolean
  reembolsadoEm?: string
  comprovante?: string
  origem?: OrigemPagamento
  cartaoId?: number // cartão pessoal, quando origem = cartao-pessoal
  gastoPessoalId?: number // compra criada na fatura do cartão pessoal
}

/** Cliente ou contrato que paga a empresa todo mês (ex.: assinatura do PaintFlow). */
export interface ClienteEmpresa {
  id?: number
  nome: string
  produtoId?: number
  valor: number
  dia: number
  inicio: string // AAAA-MM
  fim?: string // AAAA-MM
  ativa: 0 | 1
}

/** Dinheiro que entrou na empresa: de um cliente recorrente ou avulso (venda, serviço). */
export interface EntradaEmpresa {
  id?: number
  clienteId?: number
  competencia: string // AAAA-MM
  descricao: string
  valor: number
  data: string
  produtoId?: number
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
  clientes!: EntityTable<ClienteEmpresa, 'id'>
  entradasEmpresa!: EntityTable<EntradaEmpresa, 'id'>
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
    this.version(4).stores({
      clientes: '++id, ativa, produtoId',
      entradasEmpresa: '++id, clienteId, competencia, data, produtoId',
    })
  }
}

export const db = new BancoFinanceiro()

/** Tabelas na ordem usada pelo backup. */
export const TABELAS = [
  'categorias', 'gastos', 'contas', 'pagamentosConta', 'ajustesConta', 'cartoes', 'parcelas',
  'pagamentosFatura', 'produtos', 'plataformas', 'cobrancas', 'pagamentosCobranca',
  'gastosEmpresa', 'retiradas', 'recebimentos', 'entradas', 'clientes', 'entradasEmpresa', 'config',
] as const

export async function lerConfig<T>(chave: string, padrao: T): Promise<T> {
  const item = await db.config.get(chave)
  return item === undefined ? padrao : (item.valor as T)
}

export async function salvarConfig(chave: string, valor: unknown): Promise<void> {
  await db.config.put({ chave, valor })
}
