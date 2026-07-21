# 🍔 iFood Scraper

Scraper automatizado do **Portal do Parceiro iFood** usando [Playwright](https://playwright.dev/).

Extrai dados de pedidos, financeiro, cardápio, avaliações e configurações da loja.

## 📦 Instalação

```bash
cd pos-backend/ifood-scraper
npm install
```

> O Playwright e o Chromium serão instalados automaticamente via `postinstall`.

## 🚀 Uso

### Primeiro uso (login)

Na primeira execução, o navegador abrirá para você fazer login manualmente:

```bash
node index.js --login-only
```

Os cookies serão salvos em `auth-state/` para reutilização automática nas próximas execuções.

### Extrair tudo

```bash
node index.js --all
```

### Extrair seções específicas

```bash
# Apenas pedidos
node index.js --orders

# Apenas financeiro
node index.js --financial

# Apenas cardápio
node index.js --menu

# Apenas avaliações
node index.js --reviews

# Apenas dados da loja
node index.js --store
```

### Filtros

```bash
# Pedidos por status
node index.js --orders --status concluidos
node index.js --orders --status cancelados
node index.js --orders --status aberto

# Pedidos por data
node index.js --orders --date 26/05/2026

# Financeiro por mês
node index.js --financial --month 2026-05

# Sem detalhes individuais (mais rápido)
node index.js --orders --no-details

# Formato de saída
node index.js --all --format json
node index.js --all --format csv
node index.js --all --format both
```

### Modo headless

```bash
node index.js --all --headless
```

## 📁 Saída

Os dados são salvos em `output/`:

```
output/
├── orders/
│   ├── pedidos_2026-05-26_14-30-00.json
│   ├── pedidos_2026-05-26_14-30-00.csv
│   └── pedidos_latest.json
├── financials/
│   ├── financeiro_2026-05-26_14-30-00.json
│   ├── repasses_2026-05-26_14-30-00.csv
│   └── financeiro_latest.json
├── menu/
│   ├── cardapio_2026-05-26_14-30-00.json
│   ├── produtos_2026-05-26_14-30-00.csv
│   └── cardapio_latest.json
├── reviews/
│   ├── avaliacoes_2026-05-26_14-30-00.json
│   └── avaliacoes_latest.json
└── store/
    ├── loja_2026-05-26_14-30-00.json
    └── loja_latest.json
```

## 📊 Dados Extraídos

### Pedidos
- Horário, Nº do pedido, Canal, Situação, Valor de venda, Valor líquido
- **Detalhes**: Forma de pagamento, Tipo de entrega, Itens do pedido (qtd, nome, valor), Histórico

### Financeiro
- Faturamento: Vendas, Taxas, Promoções, Ajustes, Total
- Repasses: Data, Período, Status, Subtotal, Taxa de antecipação, Valor
- Comissões: Delivery, Retirada, Dados bancários

### Cardápio
- Categorias, Produtos (nome, preço, descrição, status), Complementos

### Avaliações
- Nota média, Distribuição de estrelas, Avaliações individuais com comentários

### Dados da Loja
- Perfil (nome, CNPJ, endereço), Horários, Formas de pagamento, Métricas do dashboard

## 🔒 Segurança

- Cookies e dados de saída estão no `.gitignore`
- Nenhuma credencial é armazenada no código
- O login é feito manualmente pelo usuário

## 🐛 Debug

```bash
DEBUG=1 node index.js --all
```
