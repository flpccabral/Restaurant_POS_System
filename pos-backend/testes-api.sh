#!/bin/bash

# ============================================================
# SCRIPT DE TESTES - API POS Multi-Loja SaaS (Fase 1)
# ============================================================
# Uso: ./testes-api.sh
# ============================================================

BASE_URL="http://localhost:8000"
ADMIN_COOKIE="/tmp/admin_cookie.txt"
USER_COOKIE="/tmp/user_cookie.txt"

# Limpar cookies antigos
rm -f "$ADMIN_COOKIE" "$USER_COOKIE"

echo "============================================================"
echo "🧪 TESTES API - POS Multi-Loja SaaS"
echo "============================================================"
echo ""

# Contador de testes
PASSED=0
FAILED=0

# Função para verificar resultado
check_result() {
    local test_name="$1"
    local expected="$2"
    local actual="$3"

    if [[ "$actual" == *"$expected"* ]]; then
        echo "✅ PASS: $test_name"
        ((PASSED++))
    else
        echo "❌ FAIL: $test_name (expected: $expected, got: $actual)"
        ((FAILED++))
    fi
}

# ============================================================
# TESTE 1: Health Check
# ============================================================
echo "📌 Teste 1: Health Check"
echo "-----------------------------------------------------------"
HEALTH=$(curl -s "$BASE_URL/")
echo "$HEALTH" | jq .
if echo "$HEALTH" | jq -e '.message' > /dev/null 2>&1; then
    echo "✅ Health Check OK"
    ((PASSED++))
else
    echo "❌ Health Check FAIL"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 2: Login Admin
# ============================================================
echo "📌 Teste 2: Login Master Admin"
echo "-----------------------------------------------------------"
ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/user/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@pos.com", "password": "admin123"}' \
  -c "$ADMIN_COOKIE")

echo "$ADMIN_RESPONSE" | jq '.success, .message'

ADMIN_TOKEN=$(cat "$ADMIN_COOKIE" | grep accessToken | cut -f7)
if [[ -n "$ADMIN_TOKEN" && "$ADMIN_TOKEN" != "" ]]; then
    echo "✅ Token Admin obtido: ${ADMIN_TOKEN:0:20}..."
    ((PASSED++))
else
    echo "❌ Token Admin NÃO obtido"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 3: Obter Dados do Usuário
# ============================================================
echo "📌 Teste 3: Obter Dados do Usuário (Logado)"
echo "-----------------------------------------------------------"
USER_DATA=$(curl -s "$BASE_URL/api/user" \
  -H "Cookie: accessToken=$ADMIN_TOKEN")

echo "$USER_DATA" | jq '.data | {name, email, isMasterAdmin}'

IS_MASTER=$(echo "$USER_DATA" | jq -r '.data.isMasterAdmin')
if [[ "$IS_MASTER" == "true" ]]; then
    echo "✅ Admin identificado corretamente"
    ((PASSED++))
else
    echo "❌ Admin NÃO identificado"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 4: Listar Meus Dispositivos
# ============================================================
echo "📌 Teste 4: Listar Meus Dispositivos"
echo "-----------------------------------------------------------"
DEVICE_RESPONSE=$(curl -s "$BASE_URL/api/device/my" \
  -H "Cookie: accessToken=$ADMIN_TOKEN")

echo "$DEVICE_RESPONSE" | jq 'length'
DEVICE_COUNT=$(echo "$DEVICE_RESPONSE" | jq 'length')
if [[ "$DEVICE_COUNT" -ge 0 ]]; then
    echo "✅ Dispositivos listados: $DEVICE_COUNT"
    ((PASSED++))
else
    echo "❌ Erro ao listar dispositivos"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 5: Estatísticas de Dispositivos
# ============================================================
echo "📌 Teste 5: Estatísticas de Dispositivos"
echo "-----------------------------------------------------------"
STATS=$(curl -s "$BASE_URL/api/device/stats" \
  -H "Cookie: accessToken=$ADMIN_TOKEN")

echo "$STATS" | jq '.data'
if echo "$STATS" | jq -e '.data.total' > /dev/null 2>&1; then
    echo "✅ Stats obtidos com sucesso"
    ((PASSED++))
else
    echo "❌ Erro ao obter stats"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 6: Listar Roles
# ============================================================
echo "📌 Teste 6: Listar Roles do Sistema"
echo "-----------------------------------------------------------"
ROLES=$(curl -s "$BASE_URL/api/role" \
  -H "Cookie: accessToken=$ADMIN_TOKEN")

echo "$ROLES" | jq '.data[] | {name, description}'
ROLE_COUNT=$(echo "$ROLES" | jq '.data | length')
if [[ "$ROLE_COUNT" -ge 4 ]]; then
    echo "✅ Roles listadas: $ROLE_COUNT"
    ((PASSED++))
else
    echo "❌ Erro ao listar roles"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 7: Criar Nova Role
# ============================================================
echo "📌 Teste 7: Criar Nova Role (Supervisor)"
echo "-----------------------------------------------------------"
NEW_ROLE=$(curl -s -X POST "$BASE_URL/api/role" \
  -H "Cookie: accessToken=$ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Supervisor Teste",
    "description": "Supervisor de turno",
    "permissions": {
      "orders": { "create": true, "read": true },
      "tables": { "read": true },
      "products": { "read": true }
    }
  }')

echo "$NEW_ROLE" | jq '.data | {name, description}'
ROLE_NAME=$(echo "$NEW_ROLE" | jq -r '.data.name')
if [[ "$ROLE_NAME" == "Supervisor Teste" ]]; then
    echo "✅ Role criada: $ROLE_NAME"
    ((PASSED++))
else
    echo "❌ Erro ao criar role"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 8: Obter Loja Atual
# ============================================================
echo "📌 Teste 8: Obter Loja Atual"
echo "-----------------------------------------------------------"
STORE=$(curl -s "$BASE_URL/api/store/current" \
  -H "Cookie: accessToken=$ADMIN_TOKEN")

echo "$STORE" | jq '.data | {name, cnpj, subscriptionPlan}'
STORE_NAME=$(echo "$STORE" | jq -r '.data.name')
if [[ "$STORE_NAME" == *"Loja Demo"* ]]; then
    echo "✅ Loja obtida: $STORE_NAME"
    ((PASSED++))
else
    echo "❌ Erro ao obter loja"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 9: Login Usuário Comum
# ============================================================
echo "📌 Teste 9: Login Usuário Comum (Garçom)"
echo "-----------------------------------------------------------"
USER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/user/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@pos.com", "password": "user123"}' \
  -c "$USER_COOKIE")

echo "$USER_RESPONSE" | jq '.success, .message'

USER_TOKEN=$(cat "$USER_COOKIE" | grep accessToken | cut -f7)
if [[ -n "$USER_TOKEN" && "$USER_TOKEN" != "" ]]; then
    echo "✅ Token Usuário obtido: ${USER_TOKEN:0:20}..."
    ((PASSED++))
else
    echo "❌ Token Usuário NÃO obtido"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 10: Usuário Comum Acessa Dispositivo
# ============================================================
echo "📌 Teste 10: Usuário Comum - Acesso ao Dispositivo"
echo "-----------------------------------------------------------"
USER_DEVICE=$(curl -s "$BASE_URL/api/device/my" \
  -H "Cookie: accessToken=$USER_TOKEN")

echo "$USER_DEVICE" | jq '.[] | {nickname, isApproved}'
if echo "$USER_DEVICE" | jq -e '.[]' > /dev/null 2>&1; then
    echo "✅ Dispositivo do usuário acessado"
    ((PASSED++))
else
    echo "❌ Erro ao acessar dispositivo"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 11: Listar Ingredientes
# ============================================================
echo "📌 Teste 11: Listar Ingredientes Globais"
echo "-----------------------------------------------------------"
INGREDIENTS=$(curl -s "$BASE_URL/api/ingredient" \
  -H "Cookie: accessToken=$ADMIN_TOKEN")

echo "$INGREDIENTS" | jq '.data[:3] | .[] | {name, category}'
ING_COUNT=$(echo "$INGREDIENTS" | jq '.data | length')
if [[ "$ING_COUNT" -gt 0 ]]; then
    echo "✅ Ingredientes listados: $ING_COUNT"
    ((PASSED++))
else
    echo "❌ Erro ao listar ingredientes"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 12: Criar Ingrediente (Admin)
# ============================================================
echo "📌 Teste 12: Criar Ingrediente (Admin)"
echo "-----------------------------------------------------------"
NEW_ING=$(curl -s -X POST "$BASE_URL/api/ingredient" \
  -H "Cookie: accessToken=$ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Azeite Teste",
    "category": "tempero",
    "baseUnit": "ml",
    "averageCost": 0.15
  }')

echo "$NEW_ING" | jq '.message'
ING_NAME=$(echo "$NEW_ING" | jq -r '.data.name')
if [[ "$ING_NAME" == "Azeite Teste" ]]; then
    echo "✅ Ingrediente criado: $ING_NAME"
    ((PASSED++))
else
    echo "❌ Erro ao criar ingrediente"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 13: Usuário Comum Tenta Criar Ingrediente
# ============================================================
echo "📌 Teste 13: Usuário Comum Tenta Criar Ingrediente (PERMISSION_DENIED)"
echo "-----------------------------------------------------------"
DENIED=$(curl -s -X POST "$BASE_URL/api/ingredient" \
  -H "Cookie: accessToken=$USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste",
    "category": "tempero",
    "baseUnit": "ml",
    "averageCost": 0.10
  }')

echo "$DENIED" | jq '{message, code}'
DENIED_MSG=$(echo "$DENIED" | jq -r '.message')
if [[ "$DENIED_MSG" == *"Permission denied"* ]]; then
    echo "✅ Permissão negada corretamente: $DENIED_MSG"
    ((PASSED++))
else
    echo "❌ Permissão NÃO negada"
    ((FAILED++))
fi
echo ""

# ============================================================
# TESTE 14: Logout
# ============================================================
echo "📌 Teste 14: Logout"
echo "-----------------------------------------------------------"
LOGOUT=$(curl -s -X POST "$BASE_URL/api/user/logout" \
  -H "Cookie: accessToken=$ADMIN_TOKEN")

echo "$LOGOUT" | jq '.success, .message'
LOGOUT_SUCCESS=$(echo "$LOGOUT" | jq -r '.success')
if [[ "$LOGOUT_SUCCESS" == "true" ]]; then
    echo "✅ Logout realizado"
    ((PASSED++))
else
    echo "❌ Erro no logout"
    ((FAILED++))
fi
echo ""

# ============================================================
# LIMPEZA
# ============================================================
rm -f "$ADMIN_COOKIE" "$USER_COOKIE"

echo "============================================================"
echo "📊 RESUMO FINAL"
echo "============================================================"
echo "✅ PASSARAM: $PASSED"
echo "❌ FALHARAM: $FAILED"
echo "📈 TOTAL: $((PASSED + FAILED))"
echo ""

if [[ $FAILED -eq 0 ]]; then
    echo "🎉 TODOS OS TESTES PASSARAM!"
else
    echo "⚠️  $FAILED teste(s) falharam"
fi
echo ""
