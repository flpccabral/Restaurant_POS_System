#!/usr/bin/env bash
# =============================================================================
# verify.sh — Script de verificação local (Restaurant POS System — Backend)
# Execute a partir de pos-backend/:   bash scripts/verify.sh
# Retorna código 0 se tudo passou, 1 em caso de qualquer falha.
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PASS=0
FAIL=0
WARN=0

ok()   { echo "  ✅ $*"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $*"; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠️  $*"; WARN=$((WARN+1)); }
header() { echo; echo "━━━ $* ━━━"; }

# ─────────────────────────────────────────────────────────────────────────────
header "1. Verificação de pré-requisitos"
# ─────────────────────────────────────────────────────────────────────────────

if node --version | grep -qE '^v(18|19|20|21|22)'; then
  ok "Node.js $(node --version)"
else
  fail "Node.js >= 18 necessário. Versão atual: $(node --version 2>/dev/null || echo 'não encontrada')"
fi

if command -v npm &>/dev/null; then
  ok "npm $(npm --version)"
else
  fail "npm não encontrado"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "2. Verificação de arquivos obrigatórios"
# ─────────────────────────────────────────────────────────────────────────────

REQUIRED_FILES=(
  "app.js"
  "config/config.js"
  "config/database.js"
  ".env.example"
  "package.json"
  "jest.config.js"
  "docs/runbook.md"
)

for f in "${REQUIRED_FILES[@]}"; do
  if [ -f "$f" ]; then
    ok "Arquivo presente: $f"
  else
    fail "Arquivo ausente: $f"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
header "3. Verificação de .env"
# ─────────────────────────────────────────────────────────────────────────────

if [ ! -f ".env" ]; then
  warn ".env não encontrado — testes usarão defaults. Copie .env.example para .env para desenvolvimento local."
else
  ok ".env presente"

  # Verificar se JWT_SECRET foi alterado do valor padrão
  if grep -q "your-super-secret-jwt-key" .env 2>/dev/null; then
    fail "JWT_SECRET usa o valor padrão inseguro — gere um novo com: openssl rand -hex 32"
  else
    ok "JWT_SECRET foi alterado do padrão"
  fi

  # Verificar se MONGODB_URI foi configurado
  if grep -q "mongodb://localhost" .env 2>/dev/null; then
    warn "MONGODB_URI aponta para localhost — certifique-se de que MongoDB está em modo Replica Set para suporte a transações"
  else
    ok "MONGODB_URI configurado (não é localhost)"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
header "4. Verificação de segredos no código fonte"
# ─────────────────────────────────────────────────────────────────────────────

if grep -rn "your-super-secret-jwt-key\|mongodb+srv://.*:.*@" \
    --include="*.js" --include="*.ts" \
    --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null | grep -v ".env\|.env.example\|verify.sh"; then
  fail "Possíveis segredos hardcoded encontrados no código fonte (ver saída acima)"
else
  ok "Nenhum segredo hardcoded detectado no código fonte"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "5. Instalação de dependências"
# ─────────────────────────────────────────────────────────────────────────────

if [ -d "node_modules" ]; then
  ok "node_modules presente"
else
  echo "  → Instalando dependências..."
  npm install --silent
  ok "Dependências instaladas"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "6. Verificação de imports quebrados (require)"
# ─────────────────────────────────────────────────────────────────────────────

if node -e "require('./app.js')" 2>&1 | grep -q "Cannot find module"; then
  fail "Import quebrado detectado em app.js — verificar dependências e caminhos de módulo"
else
  ok "app.js carrega sem imports quebrados"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "7. Execução dos testes"
# ─────────────────────────────────────────────────────────────────────────────

echo "  → Executando: npm test"
if NODE_ENV=test JWT_SECRET=verify-script-test-key npm test -- --forceExit --silent 2>&1; then
  ok "Todos os testes passaram"
else
  fail "Falha nos testes — ver saída acima"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "8. Verificação de scripts do package.json"
# ─────────────────────────────────────────────────────────────────────────────

node -e "
const pkg = require('./package.json');
const scripts = pkg.scripts || {};
const fs = require('fs');
let missing = [];
Object.entries(scripts).forEach(([key, val]) => {
  const m = val.match(/jest (tests\/\S+\.test\.js)/);
  if (m) {
    const file = m[1];
    if (!fs.existsSync(file)) missing.push({key, file});
  }
});
if (missing.length > 0) {
  missing.forEach(({key, file}) =>
    console.log('  ⚠️  npm run ' + key + ' → ' + file + ' (arquivo não encontrado)'));
  process.exit(2);
} else {
  console.log('  ✅ Todos os test scripts referenciam arquivos existentes');
}
" || WARN=$((WARN+1))

# ─────────────────────────────────────────────────────────────────────────────
header "9. Verificação de ADRs"
# ─────────────────────────────────────────────────────────────────────────────

ADR_DIR="docs/adr"
if [ -d "$ADR_DIR" ]; then
  ADR_COUNT=$(find "$ADR_DIR" -name "ADR-*.md" | wc -l | tr -d ' ')
  ok "$ADR_COUNT ADRs encontrados em $ADR_DIR/"
else
  warn "Diretório $ADR_DIR não encontrado"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "10. Resumo"
# ─────────────────────────────────────────────────────────────────────────────

echo
echo "  Passou:    $PASS"
echo "  Avisos:    $WARN"
echo "  Falhou:    $FAIL"
echo

if [ "$FAIL" -gt 0 ]; then
  echo "❌ Verificação FALHOU — corrija os problemas acima antes de fazer commit."
  exit 1
else
  echo "✅ Verificação PASSOU"
  [ "$WARN" -gt 0 ] && echo "⚠️  Existem $WARN aviso(s) — revise antes de fazer deploy."
  exit 0
fi
