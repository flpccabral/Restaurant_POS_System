---
name: pos-estoque-e-checkout
description: >-
  Use quando precisar entender ou modificar o mecanismo de baixa de estoque,
  cálculo de COGS (Custo de Mercadoria Vendida), reversão de estoque por cancelamento,
  transferências entre localizações/lojas, receitas de produtos ou batches de produção interna.
---

# Estoque e Checkout — Restaurant POS System

## Quando usar

- Desenvolver ou alterar lógica no `orderCheckoutService.js` ou `stockReversalService.js`
- Modificar estruturas de receitas (`recipeModel.js`) ou regras de impacto de produto (`productModel.js`)
- Implementar novas movimentações em `stockMovementModel.js`
- Alterar cálculos de COGS em pedidos (`orderModel.js`)
- Trabalhar com produção interna (`productionService.js`) ou transferências (`transferService.js`)

## Quando não usar

- Operações genéricas de CRUD em entidades não relacionadas a insumos/produtos
- Ajustes de rotas de autorização pura sem impacto em estoque

---

## Núcleo do Mecanismo de Baixa de Estoque (`orderCheckoutService`)

A baixa de estoque ocorre através da função `processOrderStockDeduction`, executada obrigatoriamente dentro de uma **sessão transacional do MongoDB**.

```
Pedido Finalizado
       │
       ▼
Inicia MongoDB Session (Session & Transaction)
       │
       ├─► Busca Produtos do Pedido & Receitas Vinculadas
       │
       ├─► Calcula Insumos Necessários (Fator de Conversão de Unidades)
       │
       ├─► Verifica Saldo em StockBalance (Localização da Loja)
       │
       ├─► Decisão de Erro:
       │     ├── Hard Error: Cancela Transação (Abort) -> Retorna Erro HTTP
       │     └── Soft Error: Marca Aviso no Pedido -> Conclui Transação
       │
       ├─► Atualiza Saldo em StockBalance & Registra StockMovement (type: 'sale_deduction')
       │
       ├─► Calcula COGS (Custo Total dos Insumos) & Registra no Order
       │
       ▼
Commit da Transação & Fecha Sessão
```

---

## Classificação de Erros na Baixa de Estoque

| Tipo de Erro | Condição Trigger | Ação do Sistema | Impacto no Banco |
|---|---|---|---|
| **Hard Error** | Saldo insuficiente (em modo estrito); Localização de estoque não encontrada | Aborta a transação (`session.abortTransaction()`) | Nenhuma alteração é gravada |
| **Soft Error** | Produto sem receita mapeada; Insumo opcional ausente | Grava `stockDeductionStatus = 'partial'`, adiciona mensagem em `stockDeductionReason` | Transação é efetuada; pedido é pago/concluído |

---

## Reversão de Estoque (`stockReversalService`)

Quando um pedido ou item de pedido é cancelado:

1. O serviço `stockReversalService.reverseOrderStockDeduction` é chamado com uma sessão Mongoose.
2. Identifica os `StockMovement` originais vinculados ao pedido (`type: 'sale_deduction'`).
3. Cria movimentos inversos de compensação (`type: 'sale_reversal'`).
4. Incrementa novamente os saldos correspondentes em `stockBalanceModel`.
5. Atualiza o status de reversão do pedido (`stockReversalStatus = 'reversed'`).

---

## Regras de Impacto por Tipo de Produto (`productModel`)

Os produtos possuem a propriedade `stockImpactType`:
- `recipe_derived`: Baixa calculada dinamicamente com base nas quantidades da receita vinculada (`recipeModel`).
- `stock_item_direct`: Baixa direta de 1 unidade do ingrediente/item associado.
- `industrialized_resale`: Produto industrializado de revenda — sem baixa em insumos fracionados.

---

## Skills Relacionadas

- `pos-contrato-de-arquitetura` — fundamentação da obrigatoriedade de transações ACID
- `pos-dados-e-modelos` — schemas de `StockMovement`, `StockBalance` e `Recipe`

## Proveniência e Manutenção

- Verificado em: 2026-07-20
- Fontes primárias:
  - `pos-backend/services/orderCheckoutService.js`
  - `pos-backend/services/stockReversalService.js`
  - `pos-backend/models/stockMovementModel.js`
  - `pos-backend/models/recipeModel.js`
