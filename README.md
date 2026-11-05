# Meu Financeiro

App pessoal para controlar dívidas e gastos, no modo **Pessoal** e no modo **Empresa** (Valtaris).

- Funciona offline e instala no celular (PWA).
- Os dados ficam **só no aparelho** (IndexedDB). Nada vai para servidor nem para este repositório.
- Backup manual em arquivo `.json`, em **Ajustes**.

Especificação completa: [ESPECIFICACAO.md](ESPECIFICACAO.md).

## Rodar no computador

```bash
npm install
npm run dev
```

## Publicar

Cada envio para a branch `main` publica sozinho no GitHub Pages (`.github/workflows/publicar.yml`).
