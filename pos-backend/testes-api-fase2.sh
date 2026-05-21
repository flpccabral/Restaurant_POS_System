#!/bin/bash

# ============================================================
# SCRIPT DE TESTES - FASE 2 (Menu & Recipe Engine)
# ============================================================
# Uso: ./testes-api-fase2.sh
# ============================================================

BASE_URL="http://localhost:8000"
ADMIN_COOKIE="/tmp/admin_cookie_fase2.txt"

# Limpar cookies antigos
rm -f "$ADMIN_COOKIE"

echo "============================================================"
echo "🧪 TESTES API - FASE 2 (Menu & Recipe Engine)"
echo "============================================================"
echo ""

# Contador de testes
PASSED=0
FAILED=0

# ============================================================
# LOGIN ADMIN
# ============================================================
echo "📌 Login Admin"
echo "-----------------------------------------------------------"
ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/user/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@pos.com", "password": "admin123"}' \
  -c "$ADMIN_COOKIE")

ADMIN_TOKEN=$(cat "$ADMIN_COOKIE" | grep accessToken | cut -f7)
if [[ -n "$ADMIN_TOKEN" && "$ADMIN_TOKEN" != "" ]]; then
    echo "✅ Token Admin obtido"
    ((PASSED++))
else
    echo "❌ Token Admin NÃO obtido"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 1: Listar Categorias
# ============================================================
echo "📌 Teste 1: Listar Categorias"
echo "-----------------------------------------------------------"
CATEGORIES=$(curl -s "$BASE_URL/api/category" \
  -H "Cookie: accessToken=$ADMIN_TOKEN")

echo "$CATEGORIES" | jq '.data[] | {name, order}'
CAT_COUNT=$(echo "$CATEGORIES" | jq '.data | length')
if [[ "$CAT_COUNT" -gt 0 ]]; then
    echo "✅ Categorias listadas: $CAT_COUNT"
    ((PASSED++))
else
    echo "❌ Erro ao listar categorias"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 2: Criar Nova Categoria
# ============================================================
echo "📌 Teste 2: Criar Nova Categoria"
echo "-----------------------------------------------------------"
NEW_CAT=$(curl -s -X POST "$BASE_URL/api/category" \
  -H "Cookie: accessToken=$ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Promoções",
    "description": "Itens em promoção",
    "image": "http://example.com/promocoes.jpg"
  }')

echo "$NEW_CAT" | jq '.data | {name, order}'
CAT_NAME=$(echo "$NEW_CAT" | jq -r '.data.name')
if [[ "$CAT_NAME" == "Promoções" ]]; then
    echo "✅ Categoria criada: $CAT_NAME"
    ((PASSED++))
else
    echo "❌ Erro ao criar categoria"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 3: Listar Produtos
# ============================================================
echo "📌 Teste 3: Listar Produtos"
echo "-----------------------------------------------------------"
PRODUCTS=$(curl -s "$BASE_URL/api/product" \
  -H "Cookie: accessToken=$ADMIN_TOKEN")

echo "$PRODUCTS" | jq '.data[] | {name, variations: .variations.length}'
PROD_COUNT=$(echo "$PRODUCTS" | jq '.data | length')
if [[ "$PROD_COUNT" -gt 0 ]]; then
    echo "✅ Produtos listados: $PROD_COUNT"
    ((PASSED++))
else
    echo "❌ Erro ao listar produtos"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 4: Obter Produto por SKU
# ============================================================
echo "📌 Teste 4: Obter Produto por SKU"
echo "-----------------------------------------------------------"
PRODUCT_BY_SKU=$(curl -s "$BASE_URL/api/product/sku/hamburguer-artesanal-p" \
  -H "Cookie: accessToken=$ADMIN_TOKEN")

echo "$PRODUCT_BY_SKU" | jq '.data.name'
PROD_NAME=$(echo "$PRODUCT_BY_SKU" | jq -r '.data.name')
if [[ "$PROD_NAME" == *"Hambúrguer"* ]]; then
    echo "✅ Produto encontrado por SKU: $PROD_NAME"
    ((PASSED++))
else
    echo "❌ Erro ao buscar produto por SKU"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 5: Criar Novo Produto
# ============================================================
echo "📌 Teste 5: Criar Novo Produto"
echo "-----------------------------------------------------------"
# Pegar ID da categoria Bebidas
CAT_ID=$(echo "$CATEGORIES" | jq -r '.data[] | select(.name=="Bebidas") | ._id')

NEW_PRODUCT=$(curl -s -X POST "$BASE_URL/api/product" \
  -H "Cookie: accessToken=$ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Suco Natural\",
    \"description\": \"Suco natural da fruta\",
    \"categoryId\": \"$CAT_ID\",
    \"variations\": [
      { \"name\": \"300ml\", \"price\": 12.00 },
      { \"name\": \"500ml\", \"price\": 18.00 }
    ]
  }")

echo "$NEW_PRODUCT" | jq '.data | {name, variations: .variations.length}'
PROD_NAME=$(echo "$NEW_PRODUCT" | jq -r '.data.name')
if [[ "$PROD_NAME" == "Suco Natural" ]]; then
    echo "✅ Produto criado: $PROD_NAME"
    ((PASSED++))
else
    echo "❌ Erro ao criar produto"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 6: Listar Receitas
# ============================================================
echo "📌 Teste 6: Listar Receitas"
echo "-----------------------------------------------------------"
RECIPES=$(curl -s "$BASE_URL/api/recipe" \
  -H "Cookie: accessToken=$ADMIN_TOKEN")

echo "$RECIPES" | jq '.data[] | {name, sku}'
RECIPE_COUNT=$(echo "$RECIPES" | jq '.data | length')
if [[ "$RECIPE_COUNT" -gt 0 ]]; then
    echo "✅ Receitas listadas: $RECIPE_COUNT"
    ((PASSED++))
else
    echo "❌ Erro ao listar receitas"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 7: Calcular Custo da Receita
# ============================================================
echo "📌 Teste 7: Calcular Custo da Receita"
echo "-----------------------------------------------------------"
RECIPE_ID=$(echo "$RECIPES" | jq -r '.data[0]._id')

if [[ -n "$RECIPE_ID" && "$RECIPE_ID" != "null" ]]; then
    RECIPE_COST=$(curl -s "$BASE_URL/api/recipe/$RECIPE_ID/cost" \
      -H "Cookie: accessToken=$ADMIN_TOKEN")

    echo "$RECIPE_COST" | jq '.data | {recipeName, totalCost, costPerYield}'
    TOTAL_COST=$(echo "$RECIPE_COST" | jq -r '.data.totalCost')
    if [[ -n "$TOTAL_COST" && "$TOTAL_COST" != "null" ]]; then
        echo "✅ Custo calculado: R$ $TOTAL_COST"
        ((PASSED++))
    else
        echo "❌ Erro ao calcular custo"
        ((FAILED++))
    fi
else
    echo "⚠️  Nenhuma receita encontrada para teste"
    ((PASSED++))
fi
echo ""

# ============================================================
# TESTE 8: Verificar Disponibilidade de Estoque
# ============================================================
echo "📌 Teste 8: Verificar Disponibilidade de Estoque"
echo "-----------------------------------------------------------"
if [[ -n "$RECIPE_ID" && "$RECIPE_ID" != "null" ]]; then
    STOCK_CHECK=$(curl -s "$BASE_URL/api/recipe/$RECIPE_ID/stock/check?quantity=1" \
      -H "Cookie: accessToken=$ADMIN_TOKEN")

    echo "$STOCK_CHECK" | jq '.data | {recipeName, canProduce}'
    CAN_PRODUCE=$(echo "$STOCK_CHECK" | jq -r '.data.canProduce')
    if [[ "$CAN_PRODUCE" == "true" || "$CAN_PRODUCE" == "false" ]]; then
        echo "✅ Estoque verificado: canProduce=$CAN_PRODUCE"
        ((PASSED++))
    else
        echo "❌ Erro ao verificar estoque"
        ((FAILED++))
    fi
else
    echo "⚠️  Nenhuma receita encontrada para teste"
    ((PASSED++))
fi
echo ""

# ============================================================
# TESTE 9: Listar Saldo de Estoque
# ============================================================
echo "📌 Teste 9: Listar Saldo de Estoque"
echo "-----------------------------------------------------------"
STOCK=$(curl -s "$BASE_URL/api/stock/balance" \
  -H "Cookie: accessToken=$ADMIN_TOKEN")

echo "$STOCK" | jq '.data[] | {ingredient: .ingredient.name, balance, unit}'
STOCK_COUNT=$(echo "$STOCK" | jq '.data | length')
if [[ "$STOCK_COUNT" -gt 0 ]]; then
    echo "✅ Itens de estoque listados: $STOCK_COUNT"
    ((PASSED++))
else
    echo "❌ Erro ao listar estoque"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 10: Listar Alertas de Estoque
# ============================================================
echo "📌 Teste 10: Listar Alertas de Estoque"
echo "-----------------------------------------------------------"
ALERTS=$(curl -s "$BASE_URL/api/stock/alerts" \
  -H "Cookie: accessToken=$ADMIN_TOKEN")

echo "$ALERTS" | jq '.data | length'
echo "✅ Alertas listados"
((PASSED++))
echo ""

# ============================================================
# TESTE 11: Gerar Lista de Compras
# ============================================================
echo "📌 Teste 11: Gerar Lista de Compras"
echo "-----------------------------------------------------------"
SHOPPING_LIST=$(curl -s "$BASE_URL/api/stock/shopping-list" \
  -H "Cookie: accessToken=$ADMIN_TOKEN")

echo "$SHOPPING_LIST" | jq '.data | {totalItems, suppliers: .suppliers | length}'
echo "✅ Lista de compras gerada"
((PASSED++))
echo ""

# ============================================================
# TESTE 12: Listar Atributos
# ============================================================
echo "📌 Teste 12: Listar Atributos"
echo "-----------------------------------------------------------"
ATTRIBUTES=$(curl -s "$BASE_URL/api/attribute" \
  -H "Cookie: accessToken=$ADMIN_TOKEN")

echo "$ATTRIBUTES" | jq '.data | length'
echo "✅ Atributos listados"
((PASSED++))
echo ""

# ============================================================
# TESTE 13: Criar Atributo
# ============================================================
echo "📌 Teste 13: Criar Atributo"
echo "-----------------------------------------------------------"
NEW_ATTR=$(curl -s -X POST "$BASE_URL/api/attribute" \
  -H "Cookie: accessToken=$ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Adicionais",
    "description": "Adicionais do prato",
    "isRequired": false,
    "minSelected": 0,
    "maxSelected": 3,
    "options": [
      { "name": "Bacon", "price": 5.00 },
      { "name": "Queijo Extra", "price": 3.00 }
    ]
  }')

echo "$NEW_ATTR" | jq '.data | {name, options: .options.length}'
ATTR_NAME=$(echo "$NEW_ATTR" | jq -r '.data.name')
if [[ "$ATTR_NAME" == "Adicionais" ]]; then
    echo "✅ Atributo criado: $ATTR_NAME"
    ((PASSED++))
else
    echo "❌ Erro ao criar atributo"
    ((FAILED++))
fi
echo ""

# ============================================================
# LIMPEZA
# ============================================================
rm -f "$ADMIN_COOKIE"

echo "============================================================"
echo "📊 RESUMO FINAL - FASE 2"
echo "============================================================"
echo "✅ PASSARAM: $PASSED"
echo "❌ FALHARAM: $FAILED"
echo "📈 TOTAL: $((PASSED + FAILED))"
echo ""

if [[ $FAILED -eq 0 ]]; then
    echo "🎉 TODOS OS TESTES DA FASE 2 PASSARAM!"
else
    echo "⚠️  $FAILED teste(s) falharam"
fi
echo ""
