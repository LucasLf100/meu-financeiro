# Meu Financeiro — Especificação

Versão 2.0 · Novembro de 2026 · Uso pessoal (Lucas)

---

## 1. Objetivo

Um app para **controlar o que eu devo e o que eu gasto**, na vida pessoal e no meu negócio (Valtaris), num lugar só.

O app **não substitui o banco**: o saldo eu vejo lá. O foco aqui é a **dívida**, os **compromissos** e os **gastos**.

## 2. Princípios

- **Funciona no celular, sem internet.** Os dados ficam só no aparelho e nunca vão para servidor nenhum.
- **Instalável como app** (PWA): abre por um link e vai para a tela inicial com o próprio ícone.
- **Custo zero:** hospedagem grátis no GitHub Pages.
- **Backup manual:** exportar e importar um arquivo, para não perder nada se o navegador for limpo.
- **Rápido de lançar:** registrar um gasto tem que levar poucos segundos.
- **Não guarda senhas.** Só o e-mail usado em cada plataforma.

## 3. Estrutura

No topo do app, um seletor **Pessoal | Empresa** troca o app inteiro de modo. Cada modo tem as próprias telas e a própria barra de baixo.

| Pessoal | Empresa |
|---|---|
| Início · Gastos · **+** · Contas · Cartões | Início · Plataformas · **+** · Cobranças · Retiradas |

O botão **+** do meio abre o lançamento rápido do modo atual.

---

## 4. Modo Pessoal

### 4.1 Início
- **Dívida total** em destaque: contas fixas em aberto + faturas + parcelas futuras.
- Logo abaixo, dividida em:
  - **Vence este mês**: o que é urgente;
  - **Parcelas futuras**: o que já está comprometido para depois.
- Barra de progresso: quanto já paguei no mês.
- Próximos vencimentos (7 dias).
- Contas atrasadas, em vermelho.
- Uso dos cartões (limite usado e limite disponível).
- Gráfico da dívida nos últimos 6 meses.
- **A receber da Valtaris:** total dos reembolsos pendentes (ver 5.5).

### 4.2 Gastos (avulsos)
O que não é conta fixa. Exemplo: uma camiseta paga no débito.

- **Novo gasto:** valor, descrição, forma de pagamento, categoria e data (hoje, por padrão).
- **Formas de pagamento:**
  - **Débito, Pix e dinheiro:** entram como pagos. Contam nos gastos do mês, mas **não** aumentam a dívida.
  - **Crédito:** pede o cartão e o número de parcelas. O valor vai para a fatura e **soma na dívida**.
- **Lista do mês** agrupada por dia, com:
  - o total gasto;
  - as categorias onde mais gastei;
  - filtro por forma de pagamento.

### 4.3 Contas fixas
Aluguel, luz, internet, celular, assinaturas…

- Cada conta tem: nome, valor, dia de vencimento, categoria e se o valor é fixo ou varia.
- Status no mês: **paga**, **pendente** ou **atrasada** (passou do vencimento sem pagar).
- **Marcar como paga** com um toque, registrando a data e o valor real.
- **Editar uma conta** oferece três opções:
  1. só este mês;
  2. este e os próximos;
  3. todos os futuros.
- Conta com valor variável (luz, água): o valor previsto é a média dos últimos meses, e eu ajusto quando a fatura chega.
- Conta com fim, por exemplo um financiamento de 24 meses: mostra "parcela 5 de 24".

### 4.4 Cartões
- Cada cartão tem: nome, limite, dia de fechamento e dia de vencimento.
- **Fatura atual:** compras do período, total, datas e botão **Pagar fatura**.
- **Compras parceladas:** "parcela 3 de 10", com o valor que ainda falta.
- Limite disponível = limite − (fatura atual + parcelas futuras).
- **Regra do fechamento:** compra feita depois do fechamento cai na fatura seguinte.

### 4.5 Relatórios (botão na tela Início)
- Gastos por categoria no mês e comparação com o mês anterior.
- Evolução da dívida.
- Quanto foi para contas fixas, cartões e gastos avulsos.

---

## 5. Modo Empresa (Valtaris)

### 5.1 Início
- **Custo mensal da empresa**: recorrentes mensais + anuais divididos por 12 (exemplo: R$ 40/ano aparece como R$ 3,33/mês).
- **Gasto real do mês**: o que foi pago de fato, incluindo cobranças por uso.
- **Custo por produto:** Valtaris (geral) · PaintFlow · Ritmê.
- **Próximas renovações** (60 dias), com aviso se a renovação é **manual**.
- **Reembolsos pendentes:** o que eu paguei do meu bolso para a empresa.

### 5.2 Plataformas
O catálogo de tudo o que a empresa usa.

| Campo | Exemplo |
|---|---|
| Nome | Zoho Mail |
| Para que serve | E-mail da empresa |
| Produto | Valtaris / PaintFlow / Ritmê |
| Link do painel | mailadmin.zoho.com |
| E-mail da conta | lucas@valtaris.com.br |
| Plano | Mail Lite 5 GB, 1 usuário |
| Status | Ativa / Em teste / Planejada / Cancelada |
| Observações | Texto livre |

Cada plataforma pode ter **uma ou mais cobranças** (ver 5.3).

### 5.3 Cobranças
Três tipos:

- **Recorrente:** mensal ou anual.
  - Guarda: valor, moeda, próxima renovação, se renova sozinha ou é manual, e a forma de pagamento.
  - Ao pagar, a próxima data avança sozinha um mês ou um ano.
- **Única:** compra avulsa, por exemplo a taxa de abertura do CNPJ ou um registro de marca no INPI.
- **Por uso:** valor que varia todo mês, como a OpenAI. Eu lanço o valor quando a fatura chega.
  - Pode ter um **limite esperado**, com aviso se passar dele.

**Moeda:** R$ ou US$. Para US$, guardo o valor em dólar e o valor em reais efetivamente cobrado (a fatura do cartão já mostra o valor convertido). Os totais são sempre em reais; para o custo previsto em US$, uso uma cotação de referência que eu edito manualmente.

### 5.4 Gastos avulsos da empresa
Funciona igual ao **Novo gasto** pessoal, só que com o campo **produto** e sem cartão parcelado no começo.

### 5.5 Pago por mim (reembolsos)
Enquanto a empresa não tem CNPJ e conta própria, eu pago tudo do meu bolso.

- Toda cobrança ou gasto da empresa tem a opção **"Pago por mim, a reembolsar"**.
- O app soma o total que a Valtaris me deve.
- Botão **Marcar como reembolsado**, com a data.
- No modo Pessoal, o total aparece em **A receber da Valtaris**.
- Campo para anotar onde está o comprovante (para a contabilidade depois).

### 5.6 Retiradas (pró-labore)
Para o futuro, quando a empresa faturar:
- Registra uma saída na Empresa.
- Mostra a entrada correspondente no Pessoal.
- Os dois lados ficam ligados, sem misturar os números.

### 5.7 Dados iniciais (já conhecidos)

| Plataforma | Produto | Tipo | Valor | Renovação | Status |
|---|---|---|---|---|---|
| registro.br — valtaris.com.br | Valtaris | Anual | ~R$ 40 | ~28/10/2027, conferir | Ativa · pago por mim |
| Zoho Mail Lite (1 usuário) | Valtaris | Anual, **manual** (Pix) | R$ 60 | 30/10/2027 | Ativa · pago por mim |
| Domínio ritmestudio.com.br | Ritmê | Anual | a preencher | a preencher | Ativa |
| Vercel Hobby | Ritmê | Grátis | R$ 0 | — | Ativa (trocar antes de cobrar) |
| Render (API) | PaintFlow | Grátis | R$ 0 | — | Planejada |
| Neon (banco) | PaintFlow | Grátis | R$ 0 | — | Planejada |
| Cloudflare Pages | PaintFlow | Grátis | R$ 0 | — | Planejada |
| Resend (e-mails) | PaintFlow | Grátis | R$ 0 | — | Planejada |
| OpenAI | PaintFlow | Por uso, US$ | varia | — | Planejada |
| Sentry | PaintFlow | Grátis | R$ 0 | — | Planejada |

Plataformas grátis também ficam no catálogo: assim eu sei o que uso, com qual e-mail, e quando um plano grátis pode virar pago.

---

## 6. Regras gerais

1. **Dívida** = contas fixas não pagas do mês + faturas em aberto + parcelas futuras. Débito, Pix e dinheiro nunca entram na dívida.
2. **Atrasada** = passou do vencimento e não está marcada como paga.
3. **Avisos** (dentro do app, ao abrir):
   - conta pessoal vencendo em até 3 dias;
   - renovação da empresa em até 30 dias, ou 45 dias se for **manual**;
   - cobrança por uso acima do limite esperado.
4. **Valores** são guardados em centavos, para não ter erro de arredondamento.
5. **Nada é apagado de verdade sem confirmação.** Pagamentos já feitos ficam no histórico mesmo que a conta seja excluída.
6. **Backup:** exportar e importar um arquivo `.json`. Lembrete para fazer backup a cada 30 dias.

---

## 7. Dados (visão simples)

**Pessoal**
- Categoria
- Gasto avulso
- Conta fixa
- Pagamento de conta
- Cartão
- Compra no cartão
- Parcela
- Pagamento de fatura

**Empresa**
- Categoria
- Produto
- Plataforma
- Cobrança
- Pagamento de cobrança
- Gasto avulso da empresa
- Reembolso
- Retirada

**Geral**
- Configurações: cotação do dólar, tema, data do último backup

---

## 8. Visual

- Fundo claro, com verde como cor principal no modo Pessoal.
- O modo Empresa usa outra cor de destaque (sugestão: azul), para saber na hora em que modo estou.
- Tema escuro opcional.
- Base: as telas já desenhadas no artefato do claude.ai (Início com dívida total, Gastos, Novo gasto, Contas fixas, Cartões).

---

## 9. Etapas de construção

| # | Etapa | O que entrega |
|---|---|---|
| 1 | **Fundação** | App instalável, funciona offline, banco de dados local, seletor Pessoal/Empresa, backup |
| 2 | **Gastos avulsos** | Novo gasto + lista do mês (já dá para usar no dia a dia) |
| 3 | **Contas fixas** | Contas, status, marcar como paga, as três opções de edição |
| 4 | **Cartões** | Faturas, parcelas, fechamento, limite |
| 5 | **Início pessoal** | Dívida total, vencimentos, gráfico, avisos |
| 6 | **Empresa** | Plataformas, cobranças, reembolsos, Início da empresa, dados iniciais |
| 7 | **Relatórios e acabamento** | Relatórios, tema escuro, publicar no GitHub Pages |

Cada etapa termina com o app funcionando, para você testar no celular antes de ir para a próxima.

---

## 10. Fora do escopo (por enquanto)

- Sincronizar entre aparelhos ou com o sócio.
- Ler extrato ou conectar com o banco.
- Login e conta online.
- Notificações com o app fechado (só avisos ao abrir).
- App na Play Store.

## 11. Decisões

- [x] **Hospedagem:** GitHub Pages (repositório público; os dados financeiros nunca vão para o GitHub, só o código).
- [x] **Nome do modo:** Empresa.
- [x] **Categorias:** editáveis, com uma lista inicial (ver seção 12).

## 12. Categorias

As categorias são **minhas**: o app vem com uma lista inicial, e eu posso mudar tudo.

- **Adicionar** categoria nova, com nome, ícone e cor.
- **Renomear** e trocar ícone ou cor. Os gastos antigos acompanham a mudança.
- **Arquivar** em vez de apagar: some das opções de lançamento, mas o histórico continua certo nos relatórios.
- **Criar na hora:** no Novo gasto, a opção "+ Nova categoria" cria sem sair da tela.
- **Ordem:** as mais usadas aparecem primeiro no Novo gasto.
- Pessoal e Empresa têm **listas separadas**.

**Lista inicial — Pessoal:** Alimentação, Mercado, Transporte, Casa, Saúde, Lazer, Roupas, Educação, Assinaturas, Presentes, Outros.

**Lista inicial — Empresa:** Hospedagem, Domínio, E-mail, Banco de dados, IA, Ferramentas, Impostos e taxas, Contador, Marketing, Equipamentos, Outros.
