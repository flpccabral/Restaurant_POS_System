---
name: phase9_1a_complete
description: Fase 9.1A - Stock Impact Rule implementada, migrada, builds/testes passando, relatorio publicado no Notion
metadata:
  type: project
---

# Fase 9.1A — Stock Impact Rule completa

**Status:** Concluida em 2026-05-24

## O que foi implementado

- Product model com sellableType, stockImpactRule, directStockItem, directStockQuantity, directStockUnit
- GlobalIngredient com itemType='industrialized' e isSellableDirectly
- productReadinessService com computeProductReadinessStatus (6 estados)
- Product controller enriquecido com readiness e stock impact fields
- orderCheckoutService roteando por stockImpactRule (recipe_composition, stock_item_direct, no_stock_impact, combo_components)
- ObservabilityService atualizado para evitar falsos positivos
- OperationalAlertModel com novo tipo product_missing_stock_rule
- pos-admin: Products page com status operacional, formulario com campos condicionais
- Recipes UI: bloqueia criacao de receita para produtos sem recipe_composition
- Script de migracao idempotente para Loja Demo - Matriz
- Todos os builds e testes passando
- Relatorio publicado no Notion (36a457fd-4753-8163-a64f-d8a58970022d)

## Resultados do Checkpoint Runtime (2026-05-24)

### Migracao
- 5 produtos atualizados na Loja Demo - Matriz (storeId=6a1101372ff5c713c1b1a147)
- 1 nao encontrado: "Hamburguer Artesanal" (sem acento — o produto real e "Hamburguer Artesanal" com acento)
- Refrigerante Lata marcado isSellableDirectly=true, itemType=industrialized
- Idempotente: re-execucao mostra todos como ja configurados

### Validacao API Products (GET /api/product)
- Hamburgue: ready_for_sale (recipe_composition, hasActiveRecipe)
- Pizza Margherita: ready_for_sale (recipe_composition, hasActiveRecipe)
- Refrigerante: ready_direct_ok (stock_item_direct, directStockItem=Refrigerante Lata)
- Refrigerante Teste: ready_direct_ok
- Produto Sem Receita: ready_missing_recipe (inativo)
- Todos os 6 campos retornados: sellableType, stockImpactRule, productReadinessStatus, productReadinessLabel, productReadinessReason, hasActiveRecipe

### ProductReadinessService (6 estados)
- ready_for_sale: recipe_composition com Recipe ativa
- ready_direct_ok: stock_item_direct com config valida
- ready_no_stock_impact: sem baixa intencional
- ready_missing_recipe: recipe_composition sem Recipe
- ready_missing_direct: stock_item_direct sem config
- incomplete_config: combo_components ou desconhecido

### OrderCheckoutService (roteamento)
- recipe_composition: baixa por Recipe com transacao, StockMovement type=recipe_deduction, CMV por composicao
- stock_item_direct: baixa direta, StockMovement type=direct_sale_deduction, CMV = averageCost x qty
- no_stock_impact: not_applicable, CMV=0, sem movimento
- combo_components: incomplete_config, gera alerta
- Alertas: problemáticos sao no_recipe, incomplete_config, error (not_applicable NAO gera alerta)

### Alertas (ObservabilityService.checkProductsWithoutRecipe)
- stock_item_direct valido: sem alerta
- no_stock_impact: sem alerta (break explicito)
- combo_components: sem alerta (break explicito)
- recipe_composition sem Recipe: product_without_recipe
- stock_item_direct invalido: product_missing_stock_rule

### Builds/Testes
- backend: 19 passed, 1 suite (exit 0)
- pos-admin: Compiled successfully (Next.js 16.2.6)
- pos-frontend: Built in 1.80s (Vite)

## Problemas encontrados
1. Server rodava codigo desatualizado — readiness fields nao retornados ate restart
2. "Hamburguer Artesanal" (sem acento) nao encontrado — produto real tem acento
3. Produtos de outras lojas herdam defaults do modelo (recipe_composition) mesmo se semanticamente incorretos

## Decisao sobre piloto
SIM com ressalvas. Corrigir acento no Hamburguer, executar 1 venda controlada de Refrigerante, criar 1 produto no_stock_impact de teste antes do piloto real.

## Arquivos principais alterados/criados

- `pos-backend/models/productModel.js` — novos campos + validacao pre-save
- `pos-backend/models/globalIngredientModel.js` — industrialized + isSellableDirectly
- `pos-backend/models/operationalAlertModel.js` — product_missing_stock_rule
- `pos-backend/services/productReadinessService.js` (NOVO)
- `pos-backend/services/orderCheckoutService.js` — roteamento por stockImpactRule
- `pos-backend/services/observabilityService.js` — alertas cientes da regra
- `pos-backend/controllers/productController.js` — readiness + novos campos
- `pos-backend/controllers/observabilityController.js` — productsMissingStockRule
- `pos-backend/scripts/migrate-stock-impact-rules-phase9-1a.js` (NOVO)
- `pos-admin/src/types/index.ts` — Product + Ingredient atualizados
- `pos-admin/src/app/(dashboard)/products/page.tsx` — UI completa com readiness
- `pos-admin/src/app/(dashboard)/recipes/page.tsx` — bloqueio para nao-recipe

## Decisao arquitetural

Opcao A da Fase 9.0A: evoluir modelos existentes em vez de criar entidade separada StockImpactRule. Defaults preservam comportamento atual (prepared_product + recipe_composition). combo_components existe no enum mas retorna incomplete_config.
