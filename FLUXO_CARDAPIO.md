# FLUXO DE CARDÁPIO — CATEGORIAS, PRODUTOS, VARIAÇÕES E FICHAS TÉCNICAS

## VISÃO GERAL NO SETOR

O cardápio de restaurante no Brasil muda **toda semana** — promoção de quarta, prato do dia no almoço, festival de pizza no fim de semana, prato que saiu porque faltou ingrediente. A gestão precisa ser ágil, não burocrática.

O `productReadinessStatus` (prontidão para venda) é um conceito válido, mas na prática:
- 90% dos restaurantes: "Se está no cardápio, vende — se faltar ingrediente, o garçom avisa na hora"
- 10% dos restaurantes: "Se não tem ficha técnica completa, não vende" (redes, fast food)

```
  REALIDADE BRASILEIRA — CARDÁPIO:

  CATEGORIA (ex: "Grelhados", "Bebidas")
     └── PRODUTO (ex: "Filé c/ Fritas")
            ├── VARIAÇÃO 1 (300g) → R$ 35,00 (almoço)
            ├── VARIAÇÃO 2 (500g) → R$ 45,00 (jantar)
            ├── FICHA TÉCNICA (recipe) — OPCIONAL
            └── STATUS: Ativo? → vende | Inativo → oculto

   ⚠️ Não ter ficha técnica NUNCA impede a venda
      — o restaurante não pode parar de vender porque
      falta configurar o sistema
```

---

## 1. MODELOS DE DADOS

### 1.1 Categoria (Category)

```javascript
{
  _id, storeId,
  name: String,                        // "Grelhados", "Bebidas", "Sobremesas"
  description: String,
  icon: String,                        // Emoji ou ícone (ex: "🍔")
  color: String,                       // Cor da categoria no PDV
  order: Number,                       // Ordem de exibição
  isActive: Boolean,
  station: String,                     // kitchen | bar | dessert (para KDS)
  image: String,                       // URL da imagem
  parentCategory: ObjectId             // Categoria pai (subcategorias)
}
```

### 1.2 Produto (Product)

```javascript
{
  _id, storeId,
  name: String,                        // "Filé c/ Fritas"
  description: String,
  sku: String,                         // Código único
  category: ObjectId,                  // Categoria
  photos: [String],

  // Tipo de venda (Fase 9.1A)
  sellableType: String,                // prepared_product | industrialized_resale | combo | service_fee
  stockImpactRule: String,             // recipe_composition | stock_item_direct | no_stock_impact | combo_components
  directStockItem: ObjectId,           // GlobalIngredient (obrigatório se stock_item_direct)
  directStockQuantity: Number,         // Quantidade deduzida por venda (se stock_item_direct)

  // Preço
  price: Number,                       // Preço base (se sem variação)
  costPrice: Number,                   // Custo (calculado pela recipe)

  // Disponibilidade
  isActive: Boolean,                   // Se aparece no PDV
  isCurrent: Boolean,                  // Se é a versão atual do produto

  // Informações do produto
  productReadinessStatus: String,      // ready | ready_missing_recipe | ready_missing_direct | incomplete_config
  productReadinessLabel: String,       // "Config pendente" | "Pronto"

  // Ficha técnica
  hasRecipe: Boolean,
  hasDirectStockImpact: Boolean,

  // Atributos
  attributes: [{ attribute, value }],  // Ex: { "Tipo": "Carnes" }

  // Variações
  variations: [{
    name: String,                      // "300g", "Coca-Cola"
    sku: String,
    price: Number,
    costPrice: Number,
    isActive: Boolean,
    sellableType: String,
    stockImpactRule: String
  }],

  // Metadata
  averageRating: Number,
  totalSold: Number,
  tags: [String],                      // hashtag: "promocao", "novo", "vegano"
  createdAt, updatedAt
}
```

### 1.3 Atributo (Attribute)

```javascript
{
  _id, storeId,
  name: String,                        // "Tipo de carne", "Tamanho"
  values: [String],                    // ["Bovina", "Suína", "Frango"]
  isActive: Boolean
}
```

### 1.4 Product Readiness — versão realista

| Status | Significado | Pode vender? | Na prática |
|--------|-------------|:------------:|------------|
| `ready` | Configuração completa | ✅ Sim | Funcionamento normal |
| `ready_missing_recipe` | `recipe_composition` sem Recipe ativa | ✅ Sim (aviso amarelo) | 80% dos restaurantes — apenas informativo |
| `ready_missing_direct` | `stock_item_direct` com configuração inválida | ✅ Sim (aviso amarelo) | Ingrediente direto não vinculado |
| `incomplete_config` | `combo_components` ou configuração desconhecida | ✅ Sim (aviso) | Configuração pendente |

> Produto oculto do PDV é controlado por `isActive: false` (campo separado, não é um status de readiness).

> ⚠️ Produto SEMPRE pode ser vendido se `isActive: true`. A completeza da ficha técnica NUNCA bloqueia venda.

---

## 2. FLUXO DE CRIAÇÃO

### 2.1 Criação de categoria

```
  ADMIN → CATEGORIAS
       │
       ▼
  ┌─────────────────────────────────────┐
  │  NOVA CATEGORIA                     │
  │                                     │
  │  Nome*: [________]                  │
  │  Descrição: [________]              │
  │  Ícone: [🍔 🥗 🍕 ☕ 🍰 🥤 ...]   │
  │  Estação KDS: kitchen | bar |       │
  │                dessert              │
  │  Ordem: [3]                         │
  │                                     │
  │  ┌─ Salvar ─┐  ┌─ Cancelar ─┐     │
  └─────────────────────────────────────┘
```

### 2.2 Criação de produto

```
  ADMIN → PRODUTOS
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  NOVO PRODUTO                           │
  │                                         │
  │  DADOS BÁSICOS                          │
  │  Nome*: [________]                      │
  │  Descrição: [________]                  │
  │  SKU: [auto | manual]                   │
  │  Categoria*: [select]                   │
  │                                         │
  │  TIPO DE VENDA (sellableType)           │
  │  ○ Produção própria (prepared_product)  │
  │  ○ Revenda (industrialized_resale)      │
  │  ○ Combo (combo)                        │
  │  ○ Taxa de serviço (service_fee)        │
  │                                         │
  │  IMPACTO NO ESTOQUE (stockImpactRule)   │
  │  ○ Ficha técnica (recipe_composition)   │
  │  ○ Ingrediente direto (stock_item_      │
  │    direct)                              │
  │  ○ Sem impacto (no_stock_impact)        │
  │  ○ Componentes do combo (combo_         │
  │    components)                          │
  │                                         │
  │  PREÇO (se sem variação)                │
  │  R$ [________]                          │
  │                                         │
  │  ┌─ Salvar ─┐  ┌─ Salvar + Variações ─┐│
  └─────────────────────────────────────────┘
```

### 2.3 Variações

```
  PRODUTO: Filé c/ Fritas
       │
       ▼
  ┌─────────────────────────────────────┐
  │  VARIAÇÕES                          │
  │                                     │
  │  ┌─────────────────────────────┐   │
  │  │ Nome     │ SKU    │ Preço   │   │
  │  ├─────────────────────────────┤   │
  │  │ 300g     │ F300   │ 35,00   │   │
  │  │ 500g     │ F500   │ 45,00   │   │
  │  │ Promoção │ FPRO   │ 29,90   │   │
  │  └─────────────────────────────┘   │
  │                                     │
  │  [+ Adicionar variação]            │
  │                                     │
  │  ┌─ Salvar ─┐  ┌─ Voltar ─┐      │
  └─────────────────────────────────────┘
```

**Regra de variação no PDV:**
- 0 variações → produto simples (usa `price` do produto)
- 1 variação ativa → exibe nome da variação, mas não mostra seletor
- 2+ variações ativas → seletor dropdown no card do produto

---

## 3. DISPONIBILIDADE (SCHEDULING FUTURO)

### 3.1 Turnos (planejado)

```javascript
// Planejado para implementação futura
product.availability = {
  monday:    { lunch: true, dinner: true },
  tuesday:   { lunch: true, dinner: true },
  sunday:    { lunch: false, dinner: true },
  holidays:  false
}
```

### 3.2 Controle atual

No momento, o controle é manual:
- `isActive: true/false` — liga/desliga o produto
- `isCurrent: true/false` — versão ativa (para histórico de preços)

---

## 4. FICHA TÉCNICA (RECIPE) — VINCULAÇÃO AO PRODUTO

### 4.1 Fluxo de vinculação

```
  PRODUTO "Filé c/ Fritas"
       │
       ├── hasRecipe: true
       │
       ▼
  ┌─────────────────────────────────────────────┐
  │  FICHA TÉCNICA — Filé c/ Fritas            │
  │                                             │
  │  Rendimento: 1 porção                       │
  │  Custo total: R$ 12,50                     │
  │                                             │
  │  INGREDIENTES:                              │
  │  ┌────────────┬──────┬──────┬────┬───────┐ │
  │  │ Ingrediente│ Qtd  │ Unid │%Per│ Custo │ │
  │  ├────────────┼──────┼──────┼────┼───────┤ │
  │  │ Filé mignon│ 250g │ g    │ 5% │ 8,50  │ │
  │  │ Batata     │ 200g │ g    │ 10%│ 1,50  │ │
  │  │ Sal        │  5g  │ g    │ 0% │ 0,05  │ │
  │  │ Óleo       │ 20ml │ ml   │ 0% │ 0,45  │ │
  │  │ Alface     │  50g │ g    │ 15%│ 0,50  │ │
  │  │ Tomate     │ 100g │ g    │ 10%│ 1,50  │ │
  │  └────────────┴──────┴──────┴────┴───────┘ │
  │  MÃO-DE-OBRA: R$ 2,00                      │
  │  CUSTOS INDIRETOS: R$ 1,00                 │
  │                                             │
  │  Margem: (35,00 - 12,50) / 35,00 = 64,29%  │
  │                                             │
  │  ┌─ Salvar ─┐  ┌─ Recalcular ─┐           │
  └─────────────────────────────────────────────┘
```

### 4.2 Cálculo automático

```
PREÇO DE VENDA = R$ 35,00
CUSTO TOTAL    = R$ 12,50  (ingredientes + mão-de-obra + indiretos)
MARGEM         = R$ 22,50  (64,29%)
CMV            = 35,71%
```

---

## 5. EXIBIÇÃO NO PDV

### 5.1 Layout do card no PDV

```
  ┌──────────────────────┐
  │ 🍽️ GRELHADOS       │  ← Categoria (cor por paleta)
  │                      │
  │ ┌──────┐ ┌──────┐  │
  │ │Filé  │ │Picanh│  │
  │ │c/fr. │ │ia    │  │
  │ │R$35  │ │R$55  │  │
  │ │[- 0 +]│ │[- 0 +]│  │
  │ └──────┘ └──────┘  │
  │                      │
  │ ┌──────┐             │
  │ │Fraldi│ ← 🔴 sem   │
  │ │nha   │    ficha   │  ← ProductReadinessStatus = incomplete_config
  │ │R$42  │    técnica │
  │ │ 🚫   │             │
  │ └──────┘             │
  └──────────────────────┘
```

### 5.2 Regras de exibição

| Condição | Comportamento |
|----------|--------------|
| `isActive: false` | Produto NÃO aparece no PDV |
| `isCurrent: false` | Produto NÃO aparece (versão antiga) |
| `incomplete_config` | Card aparece, mas botão de adicionar desabilitado + badge vermelho |
| `ready_missing_recipe` | Card aparece com badge amarelo "Sem ficha" |
| `ready` | Card normal, pode vender |

---

## 6. REGRAS DE NEGÓCIO

| # | Regra |
|---|-------|
| 1 | Nome do produto é obrigatório e único por loja (caso-insensitive) |
| 2 | SKU é único por loja (pode ser auto-gerado) |
| 3 | Categoria é obrigatória (produto sem categoria não é exibido) |
| 4 | Produto sem preço não pode ser vendido (impossível calcular valor) |
| 5 | Produto sem ficha técnica pode ser vendido normalmente (aviso amarelo) |
| 6 | Alterar preço de produto existente NÃO altera pedidos já criados (cópia no momento da venda) |
| 7 | Desativar categoria desativa todos os produtos dela |
| 8 | Variação com `isActive: false` não aparece no seletor |
| 9 | Atributos são tags, não afetam preço (planejado: regras de preço por atributo) |
| 10 | Foto do produto aparece no cardápio digital e no PDV (se houver) |

---

## 7. ENDPOINTS

```javascript
// Categorias (routes/categoryRoute.js)
GET    /api/category
GET    /api/category/:id
POST   /api/category
PUT    /api/category/:id
PUT    /api/category/:id/move
PUT    /api/category/:id/toggle-status
DELETE /api/category/:id

// Produtos (routes/productRoute.js)
GET    /api/product
GET    /api/product/:id
GET    /api/product/sku/:sku
POST   /api/product
PUT    /api/product/:id
DELETE /api/product/:id
POST   /api/product/:id/variations
PUT    /api/product/:id/variations/:variationId
DELETE /api/product/:id/variations/:variationId

// Atributos (routes/attributeRoute.js)
GET    /api/attribute
GET    /api/attribute/:id
POST   /api/attribute
PUT    /api/attribute/:id
PUT    /api/attribute/:id/toggle-status
DELETE /api/attribute/:id
POST   /api/attribute/:id/options
PUT    /api/attribute/:id/options/:optionId
DELETE /api/attribute/:id/options/:optionId

// Fichas Técnicas (routes/recipeRoute.js)
GET    /api/recipe
GET    /api/recipe/:id
GET    /api/recipe/sku/:sku
POST   /api/recipe
PUT    /api/recipe/:id
PUT    /api/recipe/:id/toggle-status
DELETE /api/recipe/:id
GET    /api/recipe/:id/cost
GET    /api/recipe/:id/stock/check
POST   /api/recipe/:id/stock/deduct
GET    /api/recipe/product/:productId/sellable
```

> ⚠️ **Cardápio público digital** (`GET /api/public/:storeSlug/menu`) é **planejado — não implementado**. Não existem rotas públicas no backend atual; todas as rotas acima exigem autenticação (cookie JWT).
