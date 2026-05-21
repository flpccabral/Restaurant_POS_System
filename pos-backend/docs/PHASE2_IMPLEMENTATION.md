# Fase 2: Menu Builder & Recipe Engine

## Visão Geral

A Fase 2 implementou o sistema de gestão de cardápios e fichas técnicas, permitindo:

1. **Ingredientes Globais** - Catálogo unificado para todas as lojas
2. **Fichas Técnicas (Receitas)** - Mapeamento de ingredientes por produto
3. **Cálculo de Custos** - Precificação baseada em ingredientes
4. **Gestão de Estoque** - Controle de saldo e movimentos
5. **Alertas de Reposição** - Notificações de estoque baixo

---

## Arquitetura

### Modelo de Dados

```
┌─────────────────┐         ┌─────────────────┐
│ GlobalIngredient│         │   Store (Loja)  │
│ (Catálogo Global)│         │                 │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │                           │
         ▼                           ▼
┌─────────────────────────────────────────────────┐
│              StockBalance (Por Loja)            │
│  - Saldo de ingrediente específico na loja      │
│  - Minimum stock, reserved, available           │
└─────────────────────────────────────────────────┘
         │
         │
         ▼
┌─────────────────┐         ┌─────────────────┐
│     Recipe      │────────►│     Product     │
│ (Ficha Técnica)│         │  (Com Variações)│
└─────────────────┘         └─────────────────┘
```

---

## Ingredientes Globais

### Propósito

Catálogo centralizado de ingredientes que todas as lojas podem utilizar.

### Modelo

```javascript
// models/globalIngredientModel.js
const globalIngredientSchema = {
    name: String,           // Nome do ingrediente
    category: String,       // Categoria (Proteína, Laticínio, etc.)
    baseUnit: String,       // Unidade base (g, ml, un)
    averageCost: Number,    // Custo médio de referência
    synonyms: [String],     // Nomes alternativos
    isGeneric: Boolean      // Se é genérico ou específico
};
```

### Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/global-ingredients` | Listar ingredientes globais |
| GET | `/api/global-ingredients/:id` | Obter ingrediente específico |
| POST | `/api/global-ingredients` | Criar novo ingrediente |
| PUT | `/api/global-ingredients/:id` | Atualizar ingrediente |
| DELETE | `/api/global-ingredients/:id` | Deletar ingrediente |

### Script de Seed

```javascript
// scripts/seed.js - Ingredientes globais
const ingredients = [
    { name: 'Carne Bovina', category: 'Proteína', baseUnit: 'g' },
    { name: 'Queijo Mussarela', category: 'Laticínio', baseUnit: 'g' },
    { name: 'Pão de Hambúrguer', category: 'Panificação', baseUnit: 'un' },
    { name: 'Alface', category: 'Hortaliça', baseUnit: 'g' },
    { name: 'Tomate', category: 'Hortaliça', baseUnit: 'g' },
    { name: 'Bacon', category: 'Proteína', baseUnit: 'g' },
    { name: 'Ovo', category: 'Proteína', baseUnit: 'un' },
    { name: 'Leite', category: 'Laticínio', baseUnit: 'ml' },
    { name: 'Açúcar', category: 'Tempero', baseUnit: 'g' },
    { name: 'Sal', category: 'Tempero', baseUnit: 'g' }
];
```

---

## Fichas Técnicas (Recipes)

### Estrutura da Receita

```javascript
// models/recipeModel.js
const recipeSchema = {
    store: ObjectId,        // Loja proprietária
    sku: String,            // SKU único (ex: hamburguer-artesanal-p)
    product: ObjectId,      // Produto vinculado
    variation: ObjectId,    // Variação específica
    name: String,           // Nome da receita
    ingredients: [{
        ingredient: ObjectId,  // Ingrediente global
        netQuantity: Number,   // Quantidade líquida
        lossFactor: Number,    // Fator de perda (0-1)
        substitute: ObjectId,  // Ingrediente substituto
        unit: String           // Unidade de medida
    }],
    preparationTime: Number,  // Tempo de preparo (minutos)
    instructions: String,     // Modo de preparo
    yieldQuantity: Number,    // Rendimento (porções)
    isActive: Boolean         // Status da receita
};
```

### Cálculo de Custo

```javascript
// services/recipeService.js
const calculateCost = async (recipeId, ingredientPrices) => {
    const recipe = await Recipe.findById(recipeId);

    let totalCost = 0;
    const ingredientCosts = [];

    for (const item of recipe.ingredients) {
        const ingredient = await GlobalIngredient.findById(item.ingredient);
        const price = ingredientPrices?.[item.ingredient] || ingredient.averageCost;

        // Aplicar fator de perda
        const effectiveQuantity = item.netQuantity * (1 + item.lossFactor);
        const cost = (effectiveQuantity / 1000) * price; // Para kg

        totalCost += cost;
        ingredientCosts.push({
            ingredientName: ingredient.name,
            quantity: item.netQuantity,
            unit: item.unit,
            cost
        });
    }

    return {
        recipeName: recipe.name,
        totalCost,
        costPerServing: totalCost / recipe.yieldQuantity,
        ingredients: ingredientCosts
    };
};
```

### Endpoints de Receita

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/recipe` | Listar receitas |
| GET | `/api/recipe/:id` | Obter receita por ID |
| GET | `/api/recipe/sku/:sku` | Obter receita por SKU |
| POST | `/api/recipe` | Criar receita |
| PUT | `/api/recipe/:id` | Atualizar receita |
| DELETE | `/api/recipe/:id` | Deletar receita |
| GET | `/api/recipe/:id/cost` | Calcular custo |
| GET | `/api/recipe/:id/stock/check` | Verificar disponibilidade |
| POST | `/api/recipe/:id/stock/deduct` | Realizar baixa |

---

## Gestão de Estoque

### Stock Balance

Saldo de estoque por loja e ingrediente.

```javascript
// models/stockBalanceModel.js
const stockBalanceSchema = {
    store: ObjectId,        // Loja
    ingredient: ObjectId,   // Ingrediente global
    balance: Number,        // Saldo atual
    reserved: Number,       // Reservado (pedidos em aberto)
    available: Number,      // Disponível (balance - reserved)
    unit: String,           // Unidade
    minimumStock: Number,   // Estoque mínimo
    lastPurchasePrice: Number, // Preço última compra
    lastPurchaseDate: Date, // Data última compra
    supplier: ObjectId      // Fornecedor habitual
};
```

### Stock Movements

Histórico de todos os movimentos de estoque.

```javascript
// models/stockMovementModel.js
const stockMovementSchema = {
    store: ObjectId,        // Loja
    ingredient: ObjectId,   // Ingrediente
    type: String,           // 'in', 'out', 'adjustment', 'recipe_deduction'
    quantity: Number,       // Quantidade
    unit: String,           // Unidade
    balanceBefore: Number,  // Saldo antes
    balanceAfter: Number,   // Saldo depois
    reason: String,         // Motivo
    user: ObjectId,         // Usuário que fez
    recipe: ObjectId,       // Receita (se deduction)
    createdAt: Date         // Timestamp
};
```

### Tipos de Movimento

| Tipo | Descrição | Quando |
|------|-----------|--------|
| `in` | Entrada | Compra manual |
| `out` | Saída | Baixa manual |
| `adjustment` | Ajuste | Correção de saldo |
| `recipe_deduction` | Baixa de receita | Produção de prato |

---

## Alertas de Estoque

### Modelo

```javascript
// models/stockAlertModel.js
const stockAlertSchema = {
    store: ObjectId,        // Loja
    ingredient: ObjectId,   // Ingrediente
    type: String,           // 'low_stock', 'out_of_stock'
    severity: String,       // 'low', 'medium', 'high'
    currentBalance: Number, // Saldo atual
    minimumStock: Number,   // Mínimo configurado
    status: String,         // 'active', 'acknowledged', 'resolved'
    acknowledgedBy: ObjectId, // Quem reconheceu
    resolvedBy: ObjectId,   // Quem resolveu
    notes: String           // Observações
};
```

### Lógica de Alerta

```javascript
// models/stockAlertModel.js
const checkAndCreateAlerts = async (storeId) => {
    const stockItems = await StockBalance.find({ store: storeRef })
        .populate('ingredient');

    const newAlerts = [];

    for (const item of stockItems) {
        // Ignorar sem mínimo configurado
        if (!item.minimumStock || item.minimumStock <= 0) continue;

        const percentage = (item.balance / item.minimumStock) * 100;

        // Verificar alerta existente
        const existing = await StockAlert.findOne({
            store: storeRef,
            ingredient: item.ingredient._id,
            status: 'active'
        });

        if (existing) continue; // Já tem alerta ativo

        // Criar alerta
        if (item.balance === 0) {
            // Out of stock
            newAlerts.push(await StockAlert.create({
                store: storeRef,
                ingredient: item.ingredient._id,
                type: 'out_of_stock',
                severity: 'high',
                currentBalance: item.balance,
                minimumStock: item.minimumStock
            }));
        } else if (percentage < 50) {
            // Low stock (abaixo de 50% do mínimo)
            newAlerts.push(await StockAlert.create({
                store: storeRef,
                ingredient: item.ingredient._id,
                type: 'low_stock',
                severity: 'medium',
                currentBalance: item.balance,
                minimumStock: item.minimumStock
            }));
        }
    }

    return newAlerts;
};
```

---

## Arquivos Criados/Modificados

### Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `models/globalIngredientModel.js` | Schema de ingredientes globais |
| `models/recipeModel.js` | Schema de fichas técnicas |
| `models/stockBalanceModel.js` | Schema de saldo de estoque |
| `models/stockMovementModel.js` | Schema de movimentos |
| `models/stockAlertModel.js` | Schema de alertas |
| `services/recipeService.js` | Serviços de receita e estoque |
| `controllers/recipeController.js` | CRUD de receitas |
| `controllers/stockController.js` | Gestão de estoque |
| `controllers/globalIngredientController.js` | Ingredientes globais |
| `routes/recipeRoutes.js` | Rotas de receitas |
| `routes/stockRoutes.js` | Rotas de estoque |
| `routes/globalIngredientRoutes.js` | Rotas de ingredientes |

### Arquivos Modificados

| Arquivo | Modificação |
|---------|-------------|
| `models/productModel.js` | Adicionado método `addVariation` com SKU |
| `app.js` | Registro de novas rotas |
| `config/config.js` | Adicionado `socketCorsOrigin` |

---

## Implementação do Controller

### Criar Receita

```javascript
const createRecipe = async (req, res, next) => {
    try {
        const { sku, product, variation, name, ingredients } = req.body;

        // Validações
        if (!sku || !product || !variation || !name) {
            throw createHttpError(400, "SKU, product, variation and name are required!");
        }

        if (!ingredients || ingredients.length === 0) {
            throw createHttpError(400, "At least one ingredient is required!");
        }

        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Verificar produto
        const productDoc = await Product.findOne({ _id: product, store: storeRef });
        if (!productDoc) {
            throw createHttpError(400, "Invalid product ID!");
        }

        // Verificar SKU duplicado
        const existing = await Recipe.findOne({ store: storeRef, sku });
        if (existing) {
            throw createHttpError(400, "Recipe with this SKU already exists!");
        }

        // Validar ingredientes
        const validatedIngredients = [];
        for (const item of ingredients) {
            if (!item.ingredientId || !item.netQuantity) continue;

            const ingredient = await GlobalIngredient.findById(item.ingredientId);
            if (!ingredient) continue;

            validatedIngredients.push({
                ingredient: item.ingredientId,
                netQuantity: item.netQuantity,
                lossFactor: item.lossFactor || 0,
                substitute: item.substituteId || null,
                unit: item.unit
            });
        }

        // Criar receita
        const recipe = await Recipe.create({
            store: storeRef,
            sku,
            product,
            variation,
            name,
            ingredients: validatedIngredients,
            preparationTime: req.body.preparationTime || 0,
            instructions: req.body.instructions || '',
            yieldQuantity: req.body.yieldQuantity || 1
        });

        res.status(201).json({
            success: true,
            message: "Recipe created successfully!",
            data: recipe
        });
    } catch (error) {
        next(error);
    }
};
```

### Baixa de Estoque (Recipe Production)

```javascript
const deductStock = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { quantity } = req.body;

        if (!quantity || quantity < 1) {
            throw createHttpError(400, "Valid quantity is required!");
        }

        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        const result = await recipeService.deductStock(id, quantity, req.user._id);

        // Emit WebSocket events
        const io = req.app.get('io');

        if (result.deducted && result.deducted.length > 0) {
            for (const item of result.deducted) {
                ws.emitInventoryUpdated(io, storeRef, {
                    type: 'recipe_deduction',
                    ingredientId: item.ingredientId,
                    ingredientName: item.ingredientName,
                    quantity: item.quantityDeducted,
                    balance: item.balanceAfter,
                    unit: item.unit
                });
            }
        }

        ws.emitRecipeProduced(io, storeRef, {
            recipeId: id,
            quantity: quantity,
            ingredients: result.deducted
        });

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Failed to deduct stock for some ingredients",
                data: result
            });
        }

        res.status(200).json({
            success: true,
            message: "Stock deducted successfully!",
            data: result
        });
    } catch (error) {
        next(error);
    }
};
```

---

## Service Layer

### Recipe Service - Deduct Stock

```javascript
// services/recipeService.js
const deductStock = async (recipeId, quantity, userId) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const recipe = await Recipe.findById(recipeId);
        if (!recipe) {
            throw new Error("Recipe not found");
        }

        const storeRef = recipe.store;
        const deducted = [];
        let allSuccess = true;

        for (const item of recipe.ingredients) {
            const totalQuantity = item.netQuantity * quantity * (1 + item.lossFactor);

            const stockBalance = await StockBalance.findOne({
                store: storeRef,
                ingredient: item.ingredient
            }).session(session);

            if (!stockBalance) {
                allSuccess = false;
                deducted.push({
                    ingredientId: item.ingredient,
                    ingredientName: 'Unknown',
                    requiredQuantity: totalQuantity,
                    balanceAfter: 0,
                    success: false,
                    error: 'No stock balance found'
                });
                continue;
            }

            const balanceBefore = stockBalance.balance;
            stockBalance.balance -= totalQuantity;
            stockBalance.available = stockBalance.balance - stockBalance.reserved;
            await stockBalance.save({ session });

            // Criar movimento
            await StockMovement.create([{
                store: storeRef,
                ingredient: item.ingredient,
                type: 'recipe_deduction',
                quantity: totalQuantity,
                unit: item.unit,
                balanceBefore,
                balanceAfter: stockBalance.balance,
                reason: `Production of ${recipe.name} (x${quantity})`,
                user: userId,
                recipe: recipeId
            }], { session });

            const ingredient = await GlobalIngredient.findById(item.ingredient);
            deducted.push({
                ingredientId: item.ingredient.toString(),
                ingredientName: ingredient.name,
                requiredQuantity: totalQuantity,
                balanceAfter: stockBalance.balance,
                unit: item.unit,
                success: true
            });
        }

        await session.commitTransaction();

        return {
            success: allSuccess,
            recipeName: recipe.name,
            quantity,
            deducted
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};
```

---

## Scripts de Seed

### Seed de Ingredientes Globais

```javascript
// scripts/seed.js
const seedGlobalIngredients = async () => {
    const ingredients = [
        { name: 'Carne Bovina', category: 'Proteína', baseUnit: 'g', averageCost: 35 },
        { name: 'Queijo Mussarela', category: 'Laticínio', baseUnit: 'g', averageCost: 45 },
        { name: 'Pão de Hambúrguer', category: 'Panificação', baseUnit: 'un', averageCost: 250 },
        { name: 'Alface Americana', category: 'Hortaliça', baseUnit: 'g', averageCost: 15 },
        { name: 'Tomate', category: 'Hortaliça', baseUnit: 'g', averageCost: 12 },
        { name: 'Bacon', category: 'Proteína', baseUnit: 'g', averageCost: 60 },
        { name: 'Ovo', category: 'Proteína', baseUnit: 'un', averageCost: 80 },
        { name: 'Leite Integral', category: 'Laticínio', baseUnit: 'ml', averageCost: 5 },
        { name: 'Açúcar', category: 'Tempero', baseUnit: 'g', averageCost: 4 },
        { name: 'Sal', category: 'Tempero', baseUnit: 'g', averageCost: 2 },
        { name: 'Pimenta do Reino', category: 'Tempero', baseUnit: 'g', averageCost: 120 },
        { name: 'Azeite de Oliva', category: 'Tempero', baseUnit: 'ml', averageCost: 80 },
        { name: 'Cebola', category: 'Hortaliça', baseUnit: 'g', averageCost: 8 },
        { name: 'Alho', category: 'Tempero', baseUnit: 'g', averageCost: 25 },
        { name: 'Manteiga', category: 'Laticínio', baseUnit: 'g', averageCost: 50 }
    ];

    for (const ing of ingredients) {
        await GlobalIngredient.findOneAndUpdate(
            { name: ing.name },
            ing,
            { upsert: true, new: true }
        );
    }

    console.log(`✅ Seeded ${ingredients.length} global ingredients`);
};
```

---

## Testes

### Testar Criação de Receita

```bash
# 1. Criar produto (pré-requisito)
curl -X POST http://localhost:8000/api/product \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hambúrguer Artesanal",
    "categoryId": "<category-id>",
    "variations": [{
      "name": "Tradicional - P",
      "price": 29.90
    }]
  }'

# 2. Criar receita
curl -X POST http://localhost:8000/api/recipe \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "hamburguer-artesanal-p",
    "product": "<product-id>",
    "variation": "<variation-id>",
    "name": "Hambúrguer Artesanal - P",
    "ingredients": [
      {
        "ingredientId": "<carne-bovina-id>",
        "netQuantity": 150,
        "unit": "g",
        "lossFactor": 0.05
      },
      {
        "ingredientId": "<pao-hamburguer-id>",
        "netQuantity": 1,
        "unit": "un"
      },
      {
        "ingredientId": "<queijo-mussarela-id>",
        "netQuantity": 50,
        "unit": "g"
      }
    ],
    "preparationTime": 15,
    "yieldQuantity": 1
  }'
```

### Testar Baixa de Estoque

```bash
# 1. Registrar entrada de estoque
curl -X POST http://localhost:8000/api/stock/in \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "ingredientId": "<carne-bovina-id>",
    "quantity": 5000,
    "price": 35,
    "reason": "Compra inicial"
  }'

# 2. Verificar saldo
curl http://localhost:8000/api/stock/balance \
  -H "Authorization: Bearer <token>"

# 3. Produzir receita (baixa automática)
curl -X POST http://localhost:8000/api/recipe/<recipe-id>/stock/deduct \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 10}'

# 4. Verificar saldo após baixa
curl http://localhost:8000/api/stock/balance \
  -H "Authorization: Bearer <token>"
```

### Testar Alertas

```bash
# 1. Configurar estoque mínimo alto
curl -X PUT http://localhost:8000/api/stock/balance \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "ingredientId": "<queijo-mussarela-id>",
    "minimumStock": 2000
  }'

# 2. Verificar alertas
curl http://localhost:8000/api/stock/alerts \
  -H "Authorization: Bearer <token>"

# 3. Reconhecer alerta
curl -X POST http://localhost:8000/api/stock/alerts/<alert-id>/acknowledge \
  -H "Authorization: Bearer <token>"
```

---

## Troubleshooting

### Problema: Receita não encontra ingrediente

**Causa**: Ingrediente não existe no catálogo global

**Solução**: Executar seed de ingredientes globais primeiro

### Problema: Baixa falha com saldo insuficiente

**Causa**: Saldo disponível é menor que o necessário

**Solução**: Registrar entrada de estoque antes de produzir

### Problema: SKU duplicado

**Causa**: Receita com mesmo SKU já existe na loja

**Solução**: Usar SKU único ou deletar receita existente

### Problema: Custo calculado incorretamente

**Causa**: `averageCost` do ingrediente não está atualizado

**Solução**: Atualizar custo do ingrediente ou passar `ingredientPrices` no cálculo

---

## Próximos Passos (Fase 3)

Com a Fase 2 completa, o sistema está pronto para:

1. **WebSockets** - Notificações em tempo real de estoque e pedidos
2. **Kitchen Display System** - Tela de cozinha com atualizações automáticas
3. **Purchase Orders** - Pedidos de compra automáticos baseados em estoque
4. **Dashboard** - Analytics de custos e margens

---

## Referências

- [WEBSOCKETS.md](../WEBSOCKETS.md) - Documentação de eventos em tempo real
- [testes-api-fase2.sh](../testes-api-fase2.sh) - Script de testes da Fase 2
- [scripts/seed.js](../scripts/seed.js) - Seed completo de dados

---

*Documentação criada em: 2026-05-21*
