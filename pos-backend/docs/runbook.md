# Runbook Operacional — Restaurant POS System (Backend)

> Documento de referência para operação, diagnóstico, backup e resposta a incidentes.
> Atualizado em: 2026-07-20

---

## 1. Topologia

```
[Internet]
    │ HTTPS (443)
    ↓
[Servidor Node.js — pos-backend]
    │ Porta 8000 (HTTP/WebSocket)
    ├── Express (REST API — 23 grupos de rotas)
    └── Socket.io (WebSocket — rooms por store:storeId)
         │
         ↓
[MongoDB Atlas — Replica Set]
    │ Conexão via MONGODB_URI (TLS obrigatório no Atlas)
    └── Database: pos-saas (ou nome configurado na URI)

[pos-frontend — React SPA]   → http://localhost:5173 (dev) | domínio configurado (prod)
[pos-admin — Next.js]        → http://localhost:5174 (dev) | domínio configurado (prod)
```

### Portas

| Componente | Porta padrão | Configuração |
|---|---|---|
| Backend API + WS | 8000 | `PORT` em `.env` |
| Frontend POS | 5173 | `vite.config.js` |
| Admin Panel | 5174 | `next.config.js` |

### Ordem de inicialização

1. MongoDB Atlas (gerenciado externamente — verificar conectividade)
2. `pos-backend` (npm run dev ou npm start)
3. `pos-frontend` e `pos-admin` (qualquer ordem após o backend)

### Ordem de encerramento

1. Frontends (Ctrl+C nos processos npm)
2. Backend (Ctrl+C — Express termina conexões abertas)
3. MongoDB (gerenciado pelo Atlas)

---

## 2. Inicialização

### Desenvolvimento

```bash
cd pos-backend
cp .env.example .env      # Configurar credenciais reais
npm install
npm run db:seed           # Popular banco com dados iniciais
npm run dev               # Inicia com nodemon (auto-reload)
```

### Produção

```bash
cd pos-backend
NODE_ENV=production node app.js
# Ou com PM2:
pm2 start app.js --name pos-backend --env production
```

### Seed inicial (primeira vez)

```bash
# Cria: 1 loja demo, 4 roles (Admin, Gerente, Caixa, Garçom), 2 usuários, 42 ingredientes
npm run db:seed

# Credenciais padrão após seed:
# Master Admin: admin@pos.com / admin123
# Garçom:       user@pos.com  / user123
```

### Seed do piloto controlado (5 lojas PILOT_*)

```bash
node scripts/pilot-seed.js
# Cria: 5 lojas PILOT_*, usuários por loja, ingredientes, saldos iniciais, políticas
```

### Migrações

```bash
# Ver o que seria migrado (sem alterar dados)
node scripts/migrate-all.js --dry-run

# Executar migrações
npm run db:migrate

# Migração específica de isolamento de loja
npm run db:migrate:store-isolation:dry   # Simular
npm run db:migrate:store-isolation       # Executar
```

---

## 3. Health Checks

| Componente | Como verificar | Resultado esperado | Ação em caso de falha |
|---|---|---|---|
| Backend HTTP | `curl http://localhost:8000/` | `{"message":"Hello from POS Server!"}` | Verificar logs do processo; reiniciar `npm run dev` |
| Conectividade MongoDB | Log do backend na inicialização | `✅ MongoDB Connected: <host>` | Ver seção de diagnóstico de banco |
| Socket.io | Conectar cliente ao WS e emitir `join:store` | Evento sem erro | Verificar CORS_ORIGINS e porta |
| Login funcional | `POST /api/user/login` com credenciais válidas | HTTP 200 + cookie `accessToken` | Verificar JWT_SECRET e conexão com MongoDB |

> **Nota:** Endpoint `/health` não implementado ainda — adicioná-lo é item P1-04 do roadmap.

---

## 4. Diagnóstico

### Backend não inicia

```bash
# Verificar se a porta está ocupada
lsof -i :8000
# Se ocupada, matar o processo anterior:
kill -9 <PID>

# Verificar se .env existe e tem MONGODB_URI
cat pos-backend/.env | grep MONGODB_URI

# Verificar se node está instalado na versão correta (>= 18)
node --version
```

### Banco de dados indisponível

Sintoma: `❌ Database connection failed: ...` no console ao iniciar.

```bash
# Verificar conectividade com Atlas
mongosh "mongodb+srv://<host>" --eval "db.runCommand({ping:1})"

# Verificar se credenciais na MONGODB_URI estão corretas
# Verificar whitelist de IPs no Atlas (Network Access)
# Verificar se o cluster está ativo no Atlas dashboard
```

### Token inválido / 401 em todas as requisições

Causas comuns:
1. `JWT_SECRET` diferente entre o token emitido e o servidor atual — verificar se `.env` foi alterado.
2. Token expirado (JWT tem `expiresIn: '1d'`) — refazer login.
3. Cookie não enviado — verificar se o cliente envia `credentials: 'include'` nas requisições.

```bash
# Verificar JWT_SECRET atual
grep JWT_SECRET pos-backend/.env
```

### 403 Permission denied

```bash
# Verificar qual permission está sendo exigida no log
# Exemplo: "Permission denied: orders:create"
# Verificar role do usuário no MongoDB
mongosh <URI> --eval "db.users.findOne({email:'usuario@exemplo.com'}, {role:1})"
# Verificar se a role tem a permissão
mongosh <URI> --eval "db.roles.findOne({_id: ObjectId('<roleId>')})"
```

### DEVICE_PENDING_APPROVAL ao fazer login

1. Admin deve aprovar o dispositivo: `POST /api/device/:id/approve`
2. Listar dispositivos pendentes: `GET /api/device/pending` (como admin)

### Transação MongoDB falha com "Transaction numbers are only allowed..."

O MongoDB não está em modo Replica Set. Usar MongoDB Atlas (M0+) ou iniciar mongod local com:
```bash
mongod --replSet rs0 --dbpath /data/db
# Na primeira vez, inicializar o RS:
mongosh --eval "rs.initiate()"
```

### Import quebrado / `Cannot find module`

```bash
cd pos-backend
node -e "require('./app.js')" 2>&1 | head -20
# Identifica o primeiro import que falha
npm install  # Reinstalar dependências se necessário
```

---

## 5. Logs e Observabilidade

**Localização atual:** console do processo Node.js (stdout/stderr). Sem arquivo de log.

**Formato atual:** texto livre via `console.log` e `console.error`. Sem structured logging.

**Padrões observados:**
- `[WebSocket]` — eventos de Socket.io
- `[orderController]` — operações de pedido
- `[AuditService]` — falhas de auditoria
- `✅ MongoDB Connected:` — conexão bem-sucedida
- `❌ Database connection failed:` — falha de conexão

**Como aumentar verbosidade:** Não há nível de log configurável atualmente — todos os `console.log` são sempre ativos.

**Dados sensíveis que NÃO devem ser logados:**
- Senhas em texto claro
- JWT tokens completos
- Números de cartão de crédito
- Dados de webhook Razorpay além do evento e ID

**Observabilidade futura (P1-04 do roadmap):**
- Substituir `console.log` por `pino` com structured JSON logging
- Adicionar `requestId` em cada log para rastreabilidade
- Adicionar endpoint `/health` com status do banco

---

## 6. Backup e Restauração

### O que deve ser copiado

| Dado | Onde fica | Frequência recomendada |
|---|---|---|
| Banco de dados MongoDB | Atlas (gerenciado) | Backup automático Atlas (configurar conforme plano) |
| Arquivo `.env` | Servidor local | Em secrets manager — NÃO versionar no Git |
| Scripts em `scripts/` | Repositório Git | Automático via Git |

### Backup manual do banco (desenvolvimento/piloto)

```bash
# Exportar banco completo
mongodump --uri="$MONGODB_URI" --out="./backup-$(date +%Y%m%d-%H%M%S)"

# Exportar coleção específica
mongoexport --uri="$MONGODB_URI" --collection=orders --out=orders-backup.json
```

### Restauração

```bash
# Restaurar banco completo
mongorestore --uri="$MONGODB_URI" ./backup-20260720-120000/

# Restaurar coleção específica
mongoimport --uri="$MONGODB_URI" --collection=orders orders-backup.json
```

### Consistência

Para garantir backup consistente com MongoDB Atlas:
- Usar MongoDB Atlas Snapshots (Point-in-Time Recovery se disponível no plano)
- Para backup manual, parar escritas ou usar `mongodump` com `--oplog` para captura consistente

### Teste de restauração

Executar restauração em banco de staging a cada ciclo de release:
```bash
mongorestore --uri="$MONGODB_URI_STAGING" ./backup-recente/
cd pos-backend && NODE_ENV=test MONGODB_URI=$MONGODB_URI_STAGING npm test
```

---

## 7. Migração e Rollback

### Fluxo de atualização com migração de schema

1. Criar script `scripts/migrate-<descricao>.js` com `--dry-run`
2. Executar com `--dry-run` em staging
3. Fazer backup do banco de produção
4. Executar a migração em produção
5. Validar com `npm test` no ambiente de produção
6. Monitorar logs por 30 minutos após deploy

### Rollback de migração

O sistema usa scripts de migração manuais (não usa migrate-mongo ou similar).

Para reverter:
1. Identificar a ação no `OperationalAuditLog` ou via `mongodump` pré-migração
2. Criar script de rollback inverso usando o campo `before` dos logs de auditoria quando disponível
3. Executar o rollback em horário de baixo tráfego

### Compatibilidade

- Migrações devem ser backward-compatible quando possível (adicionar campo, não remover)
- Remoção de campo: executar em dois deploys — (1) parar de usar o campo, (2) remover o campo

---

## 8. Resposta a Incidentes

### Procedimento mínimo

1. **Detectar:** Log de erro no console; relatório de usuário; health check falhando
2. **Conter:** Se houver risco de perda de dados, parar o servidor (`pm2 stop pos-backend`)
3. **Preservar evidências:** Copiar os últimos 500 linhas do log antes de reiniciar
4. **Restaurar:** Reiniciar o processo; verificar conectividade com banco; validar com `curl http://localhost:8000/`
5. **Validar:** Testar o fluxo afetado manualmente; executar `npm test`
6. **Registrar causa:** Criar issue no repositório com timestamp, sintoma, causa raiz e solução aplicada
7. **Prevenir recorrência:** Adicionar teste que teria capturado o problema; documentar no runbook

### Incidentes específicos

| Sintoma | Causa provável | Ação imediata |
|---|---|---|
| Todos os pedidos retornam 500 | Banco desconectado | Verificar Atlas; reiniciar processo |
| Login retorna 401 para todos | JWT_SECRET alterado | Restaurar .env; reiniciar processo |
| Estoque inconsistente | Transação abortada parcialmente | Executar `stockReversalService`; criar issue |
| WebSocket não atualiza | Socket.io desconectado | Verificar CORS_ORIGINS; recarregar cliente |
| `DEVICE_PENDING_APPROVAL` massivo | Dados de device corrompidos | Executar `scripts/migration-cleanup.js`; verificar deviceModel |

---

## 9. Procedimento de Release

1. Garantir que `npm test` passa localmente
2. Atualizar `CHANGELOG.md` com as mudanças da versão
3. Criar PR de `dev` → `main`
4. Aguardar revisão e CI verde (quando CI estiver configurado)
5. Fazer merge
6. Criar tag Git: `git tag -a v<major>.<minor>.<patch> -m "Descrição"`
7. Fazer backup do banco de produção
8. Executar migrações se houver: `npm run db:migrate`
9. Reiniciar o processo em produção
10. Validar health check e fluxo principal de login
