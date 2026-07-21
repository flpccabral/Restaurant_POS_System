# FLUXO DE RELATÓRIOS — MÉTRICAS, KPIs, PERIODICIDADE E EXPORTAÇÃO

## VISÃO GERAL

Os relatórios transformam dados brutos (pedidos, estoque, caixa) em informação para tomada de decisão. O sistema oferece KPIs em tempo real no dashboard e relatórios detalhados por período com exportação.

---

## 1. TIPOS DE RELATÓRIO

### 1.1 Dashboard — KPIs em tempo real

| KPI | Fonte | Cálculo | Período |
|-----|-------|---------|---------|
| Faturamento bruto | Orders | `sum(bills.totalWithTax)` | Hoje, 7d, 30d, mês |
| Ticket médio | Orders | `avg(bills.totalWithTax)` | Hoje, 7d, 30d, mês |
| Pedidos | Orders | `count()` | Hoje, 7d, 30d, mês |
| Alertas ativos | StockAlert | `count({status: 'active'})` | Agora |
| Produtos ativos | Product | `count({isActive: true})` | Agora |
| Estoque total | StockBalance | `sum(balance * avgCost)` | Agora |
| CMV | Orders + Recipes | `totalCost / totalRevenue` | Mês atual |
| Rupturas | StockAlert | `count({type: 'stockout'})` | Agora |

### 1.2 Relatórios detalhados

| Relatório | Conteúdo | Formato |
|-----------|----------|---------|
| **Vendas por período** | Receita, pedidos, ticket médio, comparativo período anterior | Tabela + gráfico linha |
| **Formas de pagamento** | Distribuição % por método | Pizza |
| **Produtos mais vendidos** | Top N por qtd e por receita | Barra |
| **Vendas por garçom** | Total, pedidos, comissão | Tabela |
| **Vendas por horário** | Distribuição por hora do dia | Barra |
| **Vendas por dia da semana** | Média por dia | Barra |
| **Estoque — Giro** | Consumo diário médio, dias até ruptura | Tabela |
| **Estoque — Perdas** | Ajustes negativos por período | Tabela |
| **Caixa — Diferenças** | Fechamentos com diferença | Tabela |
| **Caixa — Sangrias** | Sangrias por período, motivo | Tabela |
| **Fiscal — NFC-e emitidas** | Quantidade, valor, rejeições | Tabela |
| **Cancelamentos** | Pedidos cancelados, motivo, valor | Tabela |

---

## 2. API DE RELATÓRIOS

### 2.1 Endpoints

```javascript
// Dashboard (KPIs)
GET /api/dashboard/kpi?period=&storeId=
  → { revenue: { gross, net, tax },
      orders: { count, avgTicket },
      operational: { activeAlerts, activeProducts } }

// Vendas
GET /api/dashboard/sales?period=&storeId=
  → [{ date, revenue, orders, avgTicket }]

// Produtos mais vendidos
GET /api/dashboard/products/top?period=&limit=&storeId=
  → [{ product, name, quantity, revenue }]

// Formas de pagamento
GET /api/reports/payment-methods?period=&storeId=
  → [{ method, amount, percentage }]

// Vendas por garçom
GET /api/reports/by-attendant?period=&storeId=
  → [{ attendant, name, totalSales, totalOrders, commissionRate, commissionValue }]

// Vendas por horário
GET /api/reports/by-hour?period=&storeId=
  → [{ hour, orderCount, revenue }]

// Vendas por dia da semana
GET /api/reports/by-weekday?period=&storeId=
  → [{ weekday, avgOrders, avgRevenue }]

// CMV
GET /api/dashboard/cmv?period=&storeId=
  → { cmvPercentage, classification, totalCost, totalRevenue }

// Estoque — Giro
GET /api/reports/stock-turnover?period=&storeId=
  → [{ ingredient, avgDailyConsumption, currentBalance, daysUntilStockout }]

// Cancelamentos
GET /api/reports/cancellations?period=&storeId=
  → [{ date, reason, amount, operator }]

// Caixa — Diferenças
GET /api/reports/cash-differences?period=&storeId=
  → [{ date, operator, expected, actual, difference, status }]
```

### 2.2 Parâmetro de período

```javascript
// Valores aceitos:
// today | yesterday | 7days | 30days | this_week | this_month | last_month | custom

// Custom:
// ?start=2026-07-01&end=2026-07-14

// Exemplo completo:
// GET /api/dashboard/sales?period=this_month&storeId=abc123

// Resposta padronizada:
{
  success: true,
  data: { ... },
  metadata: {
    period: 'this_month',
    start: '2026-07-01T00:00:00-03:00',
    end: '2026-07-14T23:59:59-03:00',
    storeId: 'abc123',
    generatedAt: '2026-07-14T20:30:00-03:00'
  }
}
```

---

## 3. INDICADORES E FÓRMULAS

### 3.1 Principais indicadores

```
Faturamento Bruto = Σ valor total dos pedidos (bills.totalWithTax)
Faturamento Líquido = Faturamento Bruto - Impostos - Cancelamentos
Ticket Médio = Faturamento Bruto / Número de Pedidos
CMV (%) = (Custo das Mercadorias Vendidas / Faturamento Bruto) × 100
Margem Bruta (%) = (1 - CMV) × 100
Giro de Estoque = Consumo do Período / Estoque Médio
Dias de Cobertura = Estoque Atual / Consumo Diário Médio
Taxa de Cancelamento (%) = (Cancelados / Total Pedidos) × 100
Ticket por Pessoa = Faturamento / (Número de Convidados)
```

### 3.2 Classificação CMV

| CMV | Classificação | Ação |
|:---:|:-------------|------|
| < 25% | ✅ Excelente | Manter |
| 25% — 35% | 🟡 Dentro da média | Monitorar |
| 35% — 45% | 🟠 Atenção | Revisar preços ou custos |
| > 45% | 🔴 Crítico | Ação imediata necessária |

---

## 4. GRÁFICOS E VISUALIZAÇÃO

### 4.1 Gráficos no Dashboard

| Gráfico | Tipo | Biblioteca | Dados |
|---------|------|:-----------:|-------|
| Tendência de faturamento | Linha (LineChart) | Recharts | Série temporal de receita |
| Produtos mais vendidos | Barra (BarChart) | Recharts | Top 5 por receita |
| Formas de pagamento | Pizza (PieChart) | Recharts | Distribuição % |
| Vendas por horário | Barra | Recharts | Pico de vendas |
| Distribuição diária | Barra | Recharts | Dia da semana |

### 4.2 Layout sugerido

```
  ┌─────────────────────────────────────────────┐
  │  RELATÓRIO DE VENDAS — Julho 2026           │
  │  [Hoje] [7 dias] [30 dias] [Personalizado]  │
  ├──────────────────────┬──────────────────────┤
  │  📈 TENDÊNCIA        │  🥧 PAGAMENTOS       │
  │  ┌──────────────┐   │  ┌──────────────┐   │
  │  │ Linha do     │   │  │ Pizza: Pix   │   │
  │  │ faturamento  │   │  │ 45%, Din.    │   │
  │  │ nos últimos  │   │  │ 30%, Cartão  │   │
  │  │ 30 dias      │   │  │ 25%          │   │
  │  └──────────────┘   │  └──────────────┘   │
  ├──────────────────────┴──────────────────────┤
  │  🏆 TOP 5 PRODUTOS                          │
  │  ┌──────────────────────────────────────┐   │
  │  │ ████████████ Filé c/ Fritas — R$ 12K │   │
  │  │ ██████████   Pizza Mussarela — R$ 8K │   │
  │  │ ████████     Salada Caesar — R$ 5K   │   │
  │  │ ██████       Coca-Cola — R$ 3K       │   │
  │  │ ████         Petit Gateau — R$ 2K    │   │
  │  └──────────────────────────────────────┘   │
  ├─────────────────────────────────────────────┤
  │  📊 TABELA DETALHADA                        │
  │  ┌──────┬───────┬──────┬──────┬──────┐    │
  │  │ Data │ Venda │ Ped. │ Ticket│ CMV  │    │
  │  ├──────┼───────┼──────┼──────┼──────┤    │
  │  │ 01/07│ 4.200 │  120 │ 35,00│ 28%  │    │
  │  │ 02/07│ 3.800 │  105 │ 36,19│ 27%  │    │
  │  └──────┴───────┴──────┴──────┴──────┘    │
  ├─────────────────────────────────────────────┤
  │  [📥 Exportar CSV] [🖨️ Imprimir]            │
  └─────────────────────────────────────────────┘
```

---

## 5. EXPORTAÇÃO

### 5.1 CSV

```javascript
// GET /api/reports/sales/export.csv?period=this_month&storeId=
// Retorna Content-Type: text/csv

data,receita,pedidos,ticket_medio
2026-07-01,4200.00,120,35.00
2026-07-02,3800.00,105,36.19
...
```

### 5.2 Impressão

Versão amigável para impressão (sem gráficos, apenas tabelas):
- Remove fundos coloridos
- Remove sombras
- Ajusta para largura A4
- Adiciona cabeçalho "Restro Sabor — Relatório de Vendas — Julho 2026"
- Adiciona rodapé com data de geração

---

## 6. REGRAS DE NEGÓCIO

| # | Regra |
|---|-------|
| 1 | Relatórios sempre filtrados por storeId (nunca globais para não-admin) |
| 2 | Período máximo de consulta: 1 ano (performance) |
| 3 | Dados agregados (nunca expor dados de clientes individuais) |
| 4 | Cache de relatórios pesados (30s para KPIs, 5min para relatórios históricos) |
| 5 | Exportação CSV respeita mesmo filtro de período |
| 6 | Gráficos responsivos (funcionam em mobile) |
| 7 | Relatório de vendas EXCLUI cancelados da contagem (mas mostra separado) |
| 8 | Ticket médio considera APENAS pedidos concluídos/pagos |

---

## 7. ENDPOINTS COMPLETOS

```javascript
// Dashboard
GET /api/dashboard/kpi                    // KPIs gerais
GET /api/dashboard/sales                  // Vendas por período (série)
GET /api/dashboard/products/top           // Top produtos
GET /api/dashboard/cmv                    // CMV

// Reports
GET /api/reports/payment-methods
GET /api/reports/by-attendant
GET /api/reports/by-hour
GET /api/reports/by-weekday
GET /api/reports/stock-turnover
GET /api/reports/cancellations
GET /api/reports/cash-differences
GET /api/reports/service-charge-summary   // Resumo de gorjetas

// Export
GET /api/reports/sales/export.csv
GET /api/reports/products/export.csv
GET /api/reports/attendants/export.csv
```
