# Fase 5: Dashboard & Analytics

## Visão Geral

A Fase 5 implementou um sistema completo de dashboards e relatórios analíticos, proporcionando visibilidade total das operações do negócio através de:

1. **KPIs em Tempo Real** - Métricas principais do negócio
2. **Relatório de Vendas** - Análise temporal de vendas
3. **Ranking de Produtos** - Top produtos mais vendidos
4. **Análise de Fornecedores** - Performance e gastos por fornecedor
5. **Gestão de Estoque** - Status e valor do inventário
6. **CMV (Custo de Mercadoria Vendida)** - Indicador de rentabilidade
7. **Exportação de Dados** - Relatórios em JSON e CSV

---

## Arquitetura

### Fluxo de Dados

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  MongoDB    │───►│  Controller  │───►│  Frontend   │
│  (Dados)    │    │  (Agregação) │    │  (Visual)   │
└─────────────┘    └──────────────┘    └─────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │  Analytics   │
                   │  (Cálculos)  │
                   └──────────────┘
```

### Pipeline de Agregação

Os relatórios utilizam MongoDB Aggregation Framework para:
- Filtrar dados por loja e período
- Agrupar por datas, produtos, fornecedores
- Calcular totais, médias e percentuais
- Ordenar e limitar resultados

---

## Endpoints

### Dashboard KPIs

| Método | Endpoint | Descrição | Parâmetros |
|--------|----------|-----------|------------|
| GET | `/api/dashboard/kpi` | KPIs gerais do dashboard | `period` (today, 7days, 30days) |

### Relatórios

| Método | Endpoint | Descrição | Parâmetros |
|--------|----------|-----------|------------|
| GET | `/api/dashboard/sales` | Relatório de vendas | `period`, `groupBy` (hour, day, week, month) |
| GET | `/api/dashboard/products/top` | Ranking de produtos | `limit`, `period` |
| GET | `/api/dashboard/suppliers` | Análise de fornecedores | `period` |
| GET | `/api/dashboard/inventory` | Análise de estoque | - |
| GET | `/api/dashboard/cmv` | Relatório de CMV | `period` |
| GET | `/api/dashboard/users` | Estatísticas de usuários | - |

### Exportação

| Método | Endpoint | Descrição | Parâmetros |
|--------|----------|-----------|------------|
| GET | `/api/dashboard/export` | Exportar dados | `type` (sales, purchases, inventory), `period`, `format` (json, csv) |

---

## Implementação do Controller

### Dashboard KPIs

```javascript
const getDashboardKPIs = async (req, res, next) => {
    try {
        const { period = 'today' } = req.query;
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;
        const dateRange = getDateRange(period);

        // Vendas totais no período
        const salesResult = await Order.aggregate([
            {
                $match: {
                    storeId: new mongoose.Types.ObjectId(storeRef),
                    orderDate: { $gte: dateRange.start, $lte: dateRange.end },
                    orderStatus: { $nin: ['cancelled', 'pending'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$bills.totalWithTax' },
                    totalOrders: { $sum: 1 },
                    totalTax: { $sum: '$bills.tax' }
                }
            }
        ]);

        const { totalRevenue = 0, totalOrders = 0 } = salesResult[0] || {};

        // CMV baseado nas compras recebidas
        const purchasesResult = await PurchaseOrder.aggregate([
            {
                $match: {
                    store: new mongoose.Types.ObjectId(storeRef),
                    status: 'received',
                    receivedDate: { $gte: dateRange.start, $lte: dateRange.end }
                }
            },
            {
                $group: {
                    _id: null,
                    totalCost: { $sum: '$total' }
                }
            }
        ]);

        const totalCost = purchasesResult[0]?.totalCost || 0;
        const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

        // Pedidos pendentes e alertas
        const pendingOrders = await Order.countDocuments({
            storeId: new mongoose.Types.ObjectId(storeRef),
            orderStatus: 'pending'
        });

        const activeAlerts = await StockAlert.countDocuments({
            store: new mongoose.Types.ObjectId(storeRef),
            status: { $in: ['pending', 'acknowledged'] }
        });

        res.status(200).json({
            success: true,
            data: {
                revenue: { total: totalRevenue, orders: totalOrders },
                costs: { total: totalCost },
                margins: { gross: grossMargin.toFixed(2) },
                operational: { pendingOrders, activeAlerts }
            }
        });
    } catch (error) {
        next(error);
    }
};
```

### Relatório de Vendas

```javascript
const getSalesReport = async (req, res, next) => {
    try {
        const { period = '7days', groupBy = 'day' } = req.query;
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;
        const dateRange = getDateRange(period);

        // Definir grupo de data
        let dateGroup;
        if (groupBy === 'hour') {
            dateGroup = { $dateToString: { format: '%Y-%m-%d %H', date: '$orderDate' } };
        } else if (groupBy === 'day') {
            dateGroup = { $dateToString: { format: '%Y-%m-%d', date: '$orderDate' } };
        } else if (groupBy === 'month') {
            dateGroup = { $dateToString: { format: '%Y-%m', date: '$orderDate' } };
        }

        const salesData = await Order.aggregate([
            {
                $match: {
                    storeId: new mongoose.Types.ObjectId(storeRef),
                    orderDate: { $gte: dateRange.start, $lte: dateRange.end },
                    orderStatus: { $nin: ['cancelled', 'pending'] }
                }
            },
            {
                $group: {
                    _id: dateGroup,
                    revenue: { $sum: '$bills.totalWithTax' },
                    orders: { $sum: 1 },
                    avgTicket: { $avg: '$bills.totalWithTax' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                period, groupBy, dateRange,
                sales: salesData,
                summary: {
                    totalRevenue: salesData.reduce((acc, item) => acc + item.revenue, 0),
                    totalOrders: salesData.reduce((acc, item) => acc + item.orders, 0)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};
```

### Ranking de Produtos

```javascript
const getTopProducts = async (req, res, next) => {
    try {
        const { limit = 10, period = '7days' } = req.query;
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;
        const dateRange = getDateRange(period);

        const topProducts = await Order.aggregate([
            {
                $match: {
                    storeId: new mongoose.Types.ObjectId(storeRef),
                    orderDate: { $gte: dateRange.start, $lte: dateRange.end },
                    orderStatus: { $nin: ['cancelled', 'pending'] }
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.product',
                    productName: { $first: '$items.name' },
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: parseInt(limit) }
        ]);

        res.status(200).json({
            success: true,
            data: { period, products: topProducts }
        });
    } catch (error) {
        next(error);
    }
};
```

### Análise de Fornecedores

```javascript
const getSupplierAnalytics = async (req, res, next) => {
    try {
        const { period = '30days' } = req.query;
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;
        const dateRange = getDateRange(period);

        const supplierData = await PurchaseOrder.aggregate([
            {
                $match: {
                    store: new mongoose.Types.ObjectId(storeRef),
                    status: 'received',
                    receivedDate: { $gte: dateRange.start, $lte: dateRange.end }
                }
            },
            {
                $lookup: {
                    from: 'suppliers',
                    localField: 'supplier',
                    foreignField: '_id',
                    as: 'supplierInfo'
                }
            },
            { $unwind: '$supplierInfo' },
            {
                $group: {
                    _id: '$supplier',
                    supplierName: { $first: '$supplierInfo.name' },
                    totalSpent: { $sum: '$total' },
                    orderCount: { $sum: 1 },
                    avgOrderValue: { $avg: '$total' }
                }
            },
            { $sort: { totalSpent: -1 } }
        ]);

        res.status(200).json({
            success: true,
            data: { period, suppliers: supplierData }
        });
    } catch (error) {
        next(error);
    }
};
```

### Relatório de CMV

```javascript
const getCMVReport = async (req, res, next) => {
    try {
        const { period = '30days' } = req.query;
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;
        const dateRange = getDateRange(period);

        // Vendas totais
        const salesResult = await Order.aggregate([
            {
                $match: {
                    storeId: new mongoose.Types.ObjectId(storeRef),
                    orderDate: { $gte: dateRange.start, $lte: dateRange.end },
                    orderStatus: { $nin: ['cancelled', 'pending'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$bills.totalWithTax' }
                }
            }
        ]);

        const totalRevenue = salesResult[0]?.totalRevenue || 0;

        // Compras recebidas
        const purchasesResult = await PurchaseOrder.aggregate([
            {
                $match: {
                    store: new mongoose.Types.ObjectId(storeRef),
                    status: 'received',
                    receivedDate: { $gte: dateRange.start, $lte: dateRange.end }
                }
            },
            {
                $group: {
                    _id: null,
                    totalCost: { $sum: '$total' }
                }
            }
        ]);

        const totalCost = purchasesResult[0]?.totalCost || 0;
        const cmvPercent = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;
        const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

        res.status(200).json({
            success: true,
            data: {
                period,
                cmv: { total: totalCost, percent: cmvPercent.toFixed(2) },
                revenue: { total: totalRevenue },
                margin: { gross: grossMargin.toFixed(2) },
                interpretation: getCMVInterpretation(cmvPercent)
            }
        });
    } catch (error) {
        next(error);
    }
};
```

---

## Helper Functions

### Date Range

```javascript
function getDateRange(period) {
    const now = new Date();
    const start = new Date();

    switch (period) {
        case 'today':
            start.setHours(0, 0, 0, 0);
            break;
        case '7days':
            start.setDate(start.getDate() - 7);
            break;
        case '30days':
            start.setDate(start.getDate() - 30);
            break;
        case 'this_month':
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            break;
        default:
            start.setDate(start.getDate() - 30);
    }

    return { start, end: now, startStr: start.toISOString(), endStr: now.toISOString() };
}
```

### Interpretação de CMV

```javascript
function getCMVInterpretation(cmvPercent) {
    if (cmvPercent === 0) {
        return 'Sem dados suficientes para cálculo';
    } else if (cmvPercent < 25) {
        return 'CMV excelente - abaixo da média do setor';
    } else if (cmvPercent < 35) {
        return 'CMV dentro da média do setor';
    } else if (cmvPercent < 45) {
        return 'CMV acima da média - atenção necessária';
    } else {
        return 'CMV crítico - ação imediata recomendada';
    }
}
```

---

## Arquivos Criados

### Novos Controllers

| Arquivo | Descrição |
|---------|-----------|
| `controllers/dashboardController.js` | KPIs, relatórios e analytics |

### Novas Rotas

| Arquivo | Descrição |
|---------|-----------|
| `routes/dashboardRoutes.js` | Rotas de dashboard e relatórios |

### Arquivos Modificados

| Arquivo | Modificação |
|---------|-------------|
| `app.js` | Registro das rotas de dashboard |

---

## Exemplos de Uso

### Obter KPIs do Dashboard

```bash
# KPIs de hoje
curl "http://localhost:8000/api/dashboard/kpi?period=today" \
  -H "Authorization: Bearer <token>"

# KPIs dos últimos 7 dias
curl "http://localhost:8000/api/dashboard/kpi?period=7days" \
  -H "Authorization: Bearer <token>"
```

**Resposta:**
```json
{
    "success": true,
    "data": {
        "revenue": {
            "total": 15750.50,
            "orders": 87,
            "tax": 850.25,
            "net": 14900.25
        },
        "costs": {
            "total": 5250.00,
            "stockValue": 28450.00
        },
        "margins": {
            "gross": "66.67",
            "grossAmount": 10500.50
        },
        "operational": {
            "pendingOrders": 5,
            "activeAlerts": 3,
            "activeProducts": 42
        }
    }
}
```

### Relatório de Vendas

```bash
# Vendas por dia (últimos 7 dias)
curl "http://localhost:8000/api/dashboard/sales?period=7days&groupBy=day" \
  -H "Authorization: Bearer <token>"

# Vendas por hora (hoje)
curl "http://localhost:8000/api/dashboard/sales?period=today&groupBy=hour" \
  -H "Authorization: Bearer <token>"
```

**Resposta:**
```json
{
    "success": true,
    "data": {
        "period": "7days",
        "groupBy": "day",
        "sales": [
            {
                "period": "2026-05-15",
                "revenue": 2150.50,
                "orders": 12,
                "avgTicket": 179.21
            },
            {
                "period": "2026-05-16",
                "revenue": 2890.75,
                "orders": 18,
                "avgTicket": 160.60
            }
        ],
        "summary": {
            "totalRevenue": 15750.50,
            "totalOrders": 87,
            "avgDailyRevenue": 2250.07
        }
    }
}
```

### Ranking de Produtos

```bash
# Top 10 produtos mais vendidos
curl "http://localhost:8000/api/dashboard/products/top?limit=10&period=7days" \
  -H "Authorization: Bearer <token>"
```

**Resposta:**
```json
{
    "success": true,
    "data": {
        "period": "7days",
        "products": [
            {
                "productId": "65f1234567890abcdef12345",
                "productName": "Hambúrguer Artesanal",
                "totalQuantity": 156,
                "totalRevenue": 4672.40,
                "timesOrdered": 89,
                "avgPrice": 29.95
            },
            {
                "productId": "65f1234567890abcdef12346",
                "productName": "Pizza Margherita",
                "totalQuantity": 98,
                "totalRevenue": 4410.00,
                "timesOrdered": 67,
                "avgPrice": 45.00
            }
        ]
    }
}
```

### Análise de Fornecedores

```bash
# Gastos por fornecedor (últimos 30 dias)
curl "http://localhost:8000/api/dashboard/suppliers?period=30days" \
  -H "Authorization: Bearer <token>"
```

### Relatório de CMV

```bash
# CMV dos últimos 30 dias
curl "http://localhost:8000/api/dashboard/cmv?period=30days" \
  -H "Authorization: Bearer <token>"
```

**Resposta:**
```json
{
    "success": true,
    "data": {
        "period": "30days",
        "cmv": {
            "total": 15750.00,
            "percent": "32.50"
        },
        "revenue": {
            "total": 48461.54
        },
        "margin": {
            "gross": "67.50",
            "amount": 32711.54
        },
        "interpretation": "CMV dentro da média do setor"
    }
}
```

### Exportar Dados

```bash
# Exportar vendas em JSON
curl "http://localhost:8000/api/dashboard/export?type=sales&period=30days&format=json" \
  -H "Authorization: Bearer <token>"

# Exportar compras em CSV
curl "http://localhost:8000/api/dashboard/export?type=purchases&period=30days&format=csv" \
  -H "Authorization: Bearer <token>" \
  -o purchases.csv
```

---

## KPIs e Métricas

### KPIs de Receita

| KPI | Descrição | Cálculo |
|-----|-----------|---------|
| Total Revenue | Receita total bruta | Soma de todos os pedidos |
| Net Revenue | Receita líquida | Receita bruta - impostos |
| Avg Ticket | Ticket médio | Receita total / Nº pedidos |
| Order Count | Nº de pedidos | Contagem de pedidos |

### KPIs de Custo

| KPI | Descrição | Cálculo |
|-----|-----------|---------|
| Total Cost | Custo total | Soma das compras recebidas |
| Stock Value | Valor em estoque | Soma (saldo × preço) |
| CMV % | Custo sobre vendas | (Custo / Receita) × 100 |

### KPIs de Margem

| KPI | Descrição | Cálculo |
|-----|-----------|---------|
| Gross Margin % | Margem bruta | ((Receita - Custo) / Receita) × 100 |
| Gross Amount | Valor da margem | Receita - Custo |

### KPIs Operacionais

| KPI | Descrição |
|-----|-----------|
| Pending Orders | Pedidos pendentes |
| Active Alerts | Alertas de estoque ativos |
| Active Products | Produtos ativos no cardápio |

---

## Benchmarks de CMV

| CMV % | Classificação | Ação Recomendada |
|-------|---------------|------------------|
| < 25% | Excelente | Manter práticas atuais |
| 25-35% | Dentro da média | Monitorar continuamente |
| 35-45% | Acima da média | Revisar custos e preços |
| > 45% | Crítico | Ação imediata necessária |

---

## Troubleshooting

### Problema: KPIs retornam zero

**Causa**: Sem dados no período selecionado

**Solução**: Verificar se existem pedidos/compras no período ou ampliar o range de datas

### Problema: CMV negativo

**Causa**: Compras maiores que vendas no período (comum em períodos curtos)

**Solução**: Usar períodos maiores (30+ dias) para análise de CMV

### Problema: Ranking vazio

**Causa**: Pedidos sem itens ou todos cancelados

**Solução**: Verificar status dos pedidos e estrutura dos itens

### Problema: Exportação CSV com formatação incorreta

**Causa**: Dados com vírgulas ou aspas

**Solução**: Usar formato JSON ou tratar caracteres especiais no CSV

---

## Integração com Frontend

### React Hook Example

```javascript
// hooks/useDashboard.js
import { useState, useEffect } from 'react';
import api from '../services/api';

const useDashboard = (period = '7days') => {
    const [kpis, setKpis] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchKPIs = async () => {
            try {
                const response = await api.get(`/dashboard/kpi?period=${period}`);
                setKpis(response.data.data);
            } catch (error) {
                console.error('Error fetching KPIs:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchKPIs();
    }, [period]);

    return { kpis, loading };
};

export default useDashboard;
```

### Componente de KPI Card

```javascript
// components/Dashboard/KPICard.js
const KPICard = ({ title, value, subtitle, trend }) => (
    <div className="kpi-card">
        <h3>{title}</h3>
        <div className="value">{value}</div>
        {subtitle && <div className="subtitle">{subtitle}</div>}
        {trend && (
            <div className={`trend ${trend > 0 ? 'up' : 'down'}`}>
                {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </div>
        )}
    </div>
);

// Uso no Dashboard
const Dashboard = () => {
    const { kpis, loading } = useDashboard('7days');

    if (loading) return <Loading />;

    return (
        <div className="dashboard">
            <KPICard
                title="Receita Total"
                value={`R$ ${kpis.revenue.total.toFixed(2)}`}
                subtitle={`${kpis.revenue.orders} pedidos`}
                trend={12.5}
            />
            <KPICard
                title="Margem Bruta"
                value={`${kpis.margins.gross}%`}
                subtitle={`R$ ${kpis.margins.grossAmount.toFixed(2)}`}
            />
            <KPICard
                title="Pedidos Pendentes"
                value={kpis.operational.pendingOrders}
            />
            <KPICard
                title="Alertas de Estoque"
                value={kpis.operational.activeAlerts}
                trend={-5}
            />
        </div>
    );
};
```

---

## Próximos Passos (Fase 6)

Com a Fase 5 completa, o sistema está pronto para:

1. **Subscription & Billing** - Modelo SaaS com assinaturas
2. **Previsão de Demanda** - Machine learning para sugestão de compras
3. **Alertas Preditivos** - Antecipar rupturas de estoque
4. **Dashboard em Tempo Real** - Atualizações via WebSocket

---

## Referências

- [PHASE4_IMPLEMENTATION.md](./PHASE4_IMPLEMENTATION.md) - Purchase Orders
- [PHASE3_IMPLEMENTATION.md](./PHASE3_IMPLEMENTATION.md) - WebSockets
- [PHASE2_IMPLEMENTATION.md](./PHASE2_IMPLEMENTATION.md) - Recipe Engine

---

*Documentação criada em: 2026-05-21*
