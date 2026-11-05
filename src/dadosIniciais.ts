import { db, type Categoria, type Cobranca, type Modo, type PagamentoCobranca, type Plataforma } from './db'

const PESSOAL: Array<[string, string, string]> = [
  ['Alimentação', '🍽️', '#f97316'],
  ['Mercado', '🛒', '#65a30d'],
  ['Transporte', '🚗', '#0ea5e9'],
  ['Casa', '🏠', '#a16207'],
  ['Saúde', '💊', '#ef4444'],
  ['Lazer', '🎉', '#d946ef'],
  ['Roupas', '👕', '#6366f1'],
  ['Educação', '📚', '#14b8a6'],
  ['Assinaturas', '🔁', '#64748b'],
  ['Presentes', '🎁', '#ec4899'],
  ['Outros', '📦', '#94a3b8'],
]

const EMPRESA: Array<[string, string, string]> = [
  ['Hospedagem', '☁️', '#0ea5e9'],
  ['Domínio', '🌐', '#6366f1'],
  ['E-mail', '✉️', '#f59e0b'],
  ['Banco de dados', '🗄️', '#14b8a6'],
  ['IA', '🤖', '#a855f7'],
  ['Ferramentas', '🧰', '#64748b'],
  ['Impostos e taxas', '🧾', '#ef4444'],
  ['Contador', '📊', '#0d9488'],
  ['Marketing', '📣', '#ec4899'],
  ['Equipamentos', '💻', '#475569'],
  ['Outros', '📦', '#94a3b8'],
]

function montar(modo: Modo, lista: Array<[string, string, string]>): Categoria[] {
  return lista.map(([nome, icone, cor], ordem) => ({ modo, nome, icone, cor, arquivada: 0, ordem }))
}

/** Cria categorias e produtos na primeira vez que o app abre. */
export async function prepararDadosIniciais(): Promise<void> {
  await db.transaction('rw', db.categorias, db.produtos, db.config, async () => {
    if (await db.config.get('dadosIniciais')) return
    if ((await db.categorias.count()) === 0) {
      await db.categorias.bulkAdd([...montar('pessoal', PESSOAL), ...montar('empresa', EMPRESA)])
    }
    if ((await db.produtos.count()) === 0) {
      await db.produtos.bulkAdd([
        { nome: 'Valtaris', cor: '#2563eb' },
        { nome: 'PaintFlow', cor: '#f97316' },
        { nome: 'Ritmê', cor: '#d946ef' },
      ])
    }
    await db.config.put({ chave: 'dadosIniciais', valor: new Date().toISOString() })
  })
  await prepararDadosEmpresa()
}

type SementePlataforma = Omit<Plataforma, 'id' | 'produtoId'> & {
  produto: string
  cobranca?: Omit<Cobranca, 'id' | 'plataformaId'>
  pagamento?: Omit<PagamentoCobranca, 'id' | 'cobrancaId'>
}

const GRATIS = { tipo: 'gratis' as const, moeda: 'BRL' as const, valor: 0, renovacaoAutomatica: false, pagoPorMim: false }

const PLATAFORMAS: SementePlataforma[] = [
  {
    nome: 'registro.br',
    descricao: 'Domínio valtaris.com.br',
    produto: 'Valtaris',
    link: 'https://registro.br',
    plano: 'valtaris.com.br, 1 ano',
    status: 'ativa',
    observacoes: 'Registrado no CPF; transferir para o CNPJ quando abrir. Valor aproximado: conferir no comprovante.',
    cobranca: { tipo: 'anual', moeda: 'BRL', valor: 4000, proximaRenovacao: '2027-10-28', renovacaoAutomatica: false, pagoPorMim: true },
    pagamento: { valor: 4000, pagoEm: '2026-10-28', pagoPorMim: true },
  },
  {
    nome: 'Zoho Mail',
    descricao: 'E-mail da empresa',
    produto: 'Valtaris',
    link: 'https://mailadmin.zoho.com',
    emailConta: 'lucas@valtaris.com.br',
    plano: 'Mail Lite 5 GB, 1 usuário',
    status: 'ativa',
    observacoes: 'Pago por Pix: não renova sozinho. Adicionar o sócio quando for usar (+R$ 60/ano).',
    cobranca: { tipo: 'anual', moeda: 'BRL', valor: 6000, proximaRenovacao: '2027-10-30', renovacaoAutomatica: false, formaPagamento: 'Pix', pagoPorMim: true },
    pagamento: { valor: 6000, pagoEm: '2026-10-30', pagoPorMim: true },
  },
  {
    nome: 'Domínio ritmestudio.com.br',
    descricao: 'Domínio do Ritmê',
    produto: 'Ritmê',
    status: 'ativa',
    observacoes: 'Preencher o valor e a data de renovação.',
    cobranca: { tipo: 'anual', moeda: 'BRL', valor: 0, renovacaoAutomatica: false, pagoPorMim: true },
  },
  {
    nome: 'Vercel',
    descricao: 'Hospedagem do app Ritmê',
    produto: 'Ritmê',
    link: 'https://vercel.com',
    plano: 'Hobby (grátis)',
    status: 'ativa',
    observacoes: 'O plano grátis não permite uso comercial: trocar por Cloudflare Pages (grátis) ou Vercel Pro antes de cobrar.',
    cobranca: GRATIS,
  },
  { nome: 'Render', descricao: 'API do PaintFlow', produto: 'PaintFlow', link: 'https://render.com', plano: 'Free', status: 'planejada', cobranca: GRATIS },
  { nome: 'Neon', descricao: 'Banco de dados (Postgres) do PaintFlow', produto: 'PaintFlow', link: 'https://neon.tech', plano: 'Free', status: 'planejada', cobranca: GRATIS },
  { nome: 'Cloudflare Pages', descricao: 'Site do PaintFlow', produto: 'PaintFlow', link: 'https://dash.cloudflare.com', plano: 'Free', status: 'planejada', cobranca: GRATIS },
  { nome: 'Resend', descricao: 'E-mails automáticos do PaintFlow', produto: 'PaintFlow', link: 'https://resend.com', plano: 'Free', status: 'planejada', cobranca: GRATIS },
  { nome: 'Sentry', descricao: 'Aviso de erros do PaintFlow', produto: 'PaintFlow', link: 'https://sentry.io', plano: 'Free', status: 'planejada', cobranca: GRATIS },
  {
    nome: 'OpenAI',
    descricao: 'Leitura de documentos por IA no PaintFlow',
    produto: 'PaintFlow',
    link: 'https://platform.openai.com',
    status: 'planejada',
    observacoes: 'É o custo que cresce com o uso. Colocar um limite de gasto na conta da OpenAI.',
    cobranca: { tipo: 'uso', moeda: 'USD', valor: 0, renovacaoAutomatica: true, pagoPorMim: true },
  },
]

/** Cadastra as plataformas da Valtaris já conhecidas, uma única vez. */
async function prepararDadosEmpresa(): Promise<void> {
  await db.transaction('rw', [db.plataformas, db.cobrancas, db.pagamentosCobranca, db.produtos, db.config], async () => {
    if (await db.config.get('dadosEmpresa')) return
    if ((await db.plataformas.count()) === 0) {
      const produtos = await db.produtos.toArray()
      for (const { produto, cobranca, pagamento, ...plataforma } of PLATAFORMAS) {
        const produtoId = produtos.find((p) => p.nome === produto)?.id
        if (!produtoId) continue
        const plataformaId = (await db.plataformas.add({ ...plataforma, produtoId })) as number
        if (!cobranca) continue
        const cobrancaId = (await db.cobrancas.add({ ...cobranca, plataformaId })) as number
        if (pagamento) await db.pagamentosCobranca.add({ ...pagamento, cobrancaId })
      }
    }
    await db.config.put({ chave: 'dadosEmpresa', valor: new Date().toISOString() })
  })
}
