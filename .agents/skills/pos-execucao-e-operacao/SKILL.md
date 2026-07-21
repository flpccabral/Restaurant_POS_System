---
name: pos-execucao-e-operacao
description: >-
  Use quando precisar saber como iniciar, parar, reiniciar ou operar o Restaurant POS System:
  comandos de desenvolvimento vs. produção, seed de dados, migrações, reset de banco,
  seed do piloto, deploy, procedimento de release, como adicionar a primeira loja,
  como criar o primeiro usuário admin, como rodar o piloto controlado.
  Carregue quando o ambiente já está configurado e você precisa executar operações.
---

# Execução e Operação — Restaurant POS System

## Quando usar

- Iniciar o servidor (dev ou produção)
- Executar seed inicial ou reset do banco
- Rodar migrações de dados
- Fazer deploy
- Criar primeira loja e primeiro usuário
- Executar piloto controlado

## Quando não usar

- Ambiente não está configurado ainda (→ `pos-build-e-ambiente`)
- Depurando um erro específico (→ `pos-playbook-de-depuracao`)

---

## Comandos de execução

### Desenvolvimento

```bash
cd pos-backend
npm run dev
# Usa nodemon — auto-reload em mudanças de arquivo
# Porta: 8000 (ou PORT no .env)
# Saída esperada: "☑️  POS Server is listening on port 8000 (with Socket.io)"
```

### Produção

```bash
cd pos-backend
NODE_ENV=production node app.js

# Com PM2 (recomendado para produção)
pm2 start app.js --name pos-backend --env production
pm2 save           # Persistir configuração
pm2 startup        # Iniciar automaticamente no boot
```

### Frontend POS

```bash
cd pos-frontend
npm run dev        # Desenvolvimento → http://localhost:5173
npm run build      # Build de produção → dist/
```

### Admin Panel

```bash
cd pos-admin
npm run dev        # Desenvolvimento → http://localhost:5174
npm run build      # Build de produção → .next/
```

---

## Comandos de banco de dados

| Comando | O que faz | Seguro em produção? |
|---|---|---|
| `npm run db:seed` | Cria loja demo + roles padrão + 2 usuários + 42 ingredientes | ⚠️ Apenas em banco vazio |
| `npm run db:clean` | Remove dados do banco (executa `scripts/migration-cleanup.js`) | ❌ Destrói dados |
| `npm run db:reset` | `db:clean` + `db:seed` | ❌ Destrói e recria |
| `npm run db:migrate` | Executa todas as migrações em `scripts/migrate-all.js` | ✅ Com backup prévio |
| `npm run db:migrate:store-isolation:dry` | Simula migração de isolamento de loja (dry-run) | ✅ Somente leitura |
| `npm run db:migrate:store-isolation` | Executa migração de isolamento de loja | ⚠️ Com backup prévio |

### Seed inicial (primeira instalação)

```bash
cd pos-backend
npm run db:seed

# Cria:
# - 1 loja demo (nome: "Restaurante Demo")
# - Roles: Admin, Gerente, Caixa, Garçom
# - Usuários:
#     admin@pos.com / admin123  (Master Admin)
#     user@pos.com  / user123   (Garçom)
# - 42 ingredientes globais pré-cadastrados
```

### Seed do piloto controlado (5 lojas)

```bash
cd pos-backend
node scripts/pilot-seed.js

# Cria:
# - PILOT_Hamburgueria, PILOT_Pizzaria, PILOT_Arabe, PILOT_Bar, PILOT_Central
# - Usuários por loja (formato: loja@piloto.com / senha123)
# - Saldos iniciais de estoque por loja
# - Políticas de alerta configuradas
# - Dados suficientes para operação do piloto
```

### Resetar banco para estado limpo

```bash
cd pos-backend
# ATENÇÃO: apaga todos os dados
npm run db:reset
# Equivale a: db:clean && db:seed
```

---

## Ciclo de vida de uma loja (bootstrapping)

### 1. Criar a primeira loja

```
POST /api/store/register
{
  "name": "Meu Restaurante",
  "cnpj": "00.000.000/0001-00",
  "email": "contato@restaurante.com",
  "password": "SenhaSegura123!"
}
```

Isso cria: Loja + primeiro usuário Master Admin da loja.

### 2. Aprovar dispositivo do usuário

Na primeira tentativa de login, o dispositivo é registrado como pendente. O admin deve aprovar:

```
GET  /api/device/pending        (lista dispositivos pendentes)
POST /api/device/:id/approve    (aprova o dispositivo)
```

Após aprovação, o usuário consegue logar normalmente.

### 3. Criar ingredientes locais e receitas

```
POST /api/ingredient/local      (ingrediente local da loja)
POST /api/recipe                (receita vinculando produto a ingredientes)
```

### 4. Criar produtos e cardápio

```
POST /api/category              (categoria do cardápio)
POST /api/product               (produto com tipo e receita vinculada)
```

### 5. Criar mesas e abrir sessão de caixa

```
POST /api/table                 (criar mesa)
POST /api/pdv/cash-session/open (abrir sessão de caixa)
```

---

## Procedimento de release

1. Garantir que `npm test` passa localmente
2. Atualizar `CHANGELOG.md` com as mudanças da versão
3. Criar PR de `dev` → `main`
4. Aguardar CI verde (`.github/workflows/ci.yml`)
5. Fazer merge
6. Criar tag: `git tag -a v<major>.<minor>.<patch> -m "Descrição"`
7. Fazer backup do banco de produção: `mongodump --uri="$MONGODB_URI" --out="backup-$(date +%Y%m%d)"`
8. Executar migrações se necessário: `npm run db:migrate`
9. Reiniciar processo: `pm2 restart pos-backend`
10. Validar: `curl https://<dominio>/` e testar login

---

## Backup e restauração

### Backup

```bash
# Exportar banco completo (usar fora do horário de pico)
mongodump --uri="$MONGODB_URI" --out="./backup-$(date +%Y%m%d-%H%M%S)"

# Exportar coleção específica (ex: pedidos do dia)
mongoexport --uri="$MONGODB_URI" --collection=orders \
  --query='{"createdAt":{"$gte":{"$date":"2026-07-20T00:00:00Z"}}}' \
  --out=orders-20260720.json
```

### Restauração

```bash
# Restaurar banco completo
mongorestore --uri="$MONGODB_URI_STAGING" ./backup-20260720-120000/

# Validar restauração
cd pos-backend
MONGODB_URI=$MONGODB_URI_STAGING npm test
```

---

## Health check manual

```bash
# Verificar servidor
curl http://localhost:8000/
# Esperado: {"message":"Hello from POS Server!"}

# Verificar login
curl -X POST http://localhost:8000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pos.com","password":"admin123"}' \
  -c cookies.txt -v 2>&1 | grep "< HTTP"
# Esperado: < HTTP/1.1 200 OK

# Verificar rota autenticada
curl http://localhost:8000/api/store/ \
  -b cookies.txt
# Esperado: lista de lojas do usuário
```

---

## Critérios de aceitação

- Servidor responde em `http://localhost:8000/` com status 200
- Login com credenciais do seed retorna cookie `accessToken`
- Seed de dados cria as coleções esperadas no MongoDB

## Skills relacionadas

- `pos-build-e-ambiente` — setup inicial do ambiente
- `pos-validacao-e-qa` — como executar testes
- `pos-dados-e-modelos` — schemas e migrações
- `pos-observabilidade` — logs e diagnóstico durante operação

## Proveniência e manutenção

- Verificado em: 2026-07-20
- Fontes primárias:
  - `pos-backend/package.json` (scripts)
  - `pos-backend/scripts/seed.js`
  - `pos-backend/scripts/pilot-seed.js`
  - `pos-backend/app.js`
  - `pos-backend/docs/runbook.md`
- Comandos de reverificação:
  - `cat pos-backend/package.json | node -e "const d=require('/dev/stdin'); console.log(Object.keys(d.scripts).join('\n'))"`
  - `ls pos-backend/scripts/`
- Condições que exigem revisão:
  - Adição de novos scripts em `package.json`
  - Criação de novo script de migração em `scripts/`
  - Mudança nas credenciais padrão do seed
