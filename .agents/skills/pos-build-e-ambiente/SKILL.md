---
name: pos-build-e-ambiente
description: >-
  Use quando precisar configurar o ambiente de desenvolvimento do Restaurant POS System
  do zero, ou quando o ambiente está com problemas: servidor não sobe, MongoDB não conecta,
  testes falham por problema de ambiente, npm install com erro, versão de Node incompatível,
  MongoDB sem suporte a transações (Replica Set), variáveis de ambiente faltando.
  Também use antes de executar qualquer teste ou iniciar o servidor pela primeira vez.
---

# Build e Ambiente — Restaurant POS System

## Quando usar

- Primeiro setup da máquina de desenvolvimento
- Máquina nova ou ambiente limpo
- Servidor não inicia com erro de módulo ou conexão
- MongoDB recusa transação com erro sobre Replica Set
- `npm test` falha com erro de ambiente, não de lógica

## Quando não usar

- Servidor já está rodando e você quer entender como executar operações (→ `pos-execucao-e-operacao`)
- Erro de lógica de negócio em endpoint funcionando (→ `pos-playbook-de-depuracao`)

---

## Pré-requisitos

| Ferramenta | Versão mínima | Como verificar |
|---|---|---|
| Node.js | 18 LTS (22 verificado em 2026-07-20) | `node --version` |
| npm | 9+ | `npm --version` |
| MongoDB | Atlas M0+ ou local ≥ 6.0 com Replica Set | `mongosh --version` |
| Git | qualquer | `git --version` |

**Crítico — MongoDB Replica Set:** As transações do `orderCheckoutService.js` exigem MongoDB em Replica Set. MongoDB Atlas M0 (gratuito) já inclui RS. `mongod` local padrão (`mongod --dbpath /data/db`) NÃO suporta transações — ver seção de problemas comuns.

---

## Setup do zero (15 minutos)

```bash
# 1. Clonar repositório
git clone <url-do-repositorio>
cd Restaurant_POS_System

# 2. Backend — instalar dependências
cd pos-backend
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Abrir .env e preencher:
#   MONGODB_URI → URI do MongoDB Atlas ou local com RS
#   JWT_SECRET → gerar com: openssl rand -hex 32
# Deixar PORT=8000, NODE_ENV=development

# 4. Verificar que o ambiente está correto
bash scripts/verify.sh
# Saída esperada: "✅ Verificação PASSOU" ou apenas avisos (⚠️)

# 5. Seed inicial (cria loja demo, roles, usuários)
npm run db:seed

# 6. Iniciar servidor
npm run dev
# Saída esperada: "☑️  POS Server is listening on port 8000 (with Socket.io)"

# 7. Validar
curl http://localhost:8000/
# Esperado: {"message":"Hello from POS Server!"}

# 8. Frontend (outra janela de terminal)
cd ../pos-frontend
npm install
npm run dev   # → http://localhost:5173

# 9. Admin (outra janela de terminal)
cd ../pos-admin
npm install
npm run dev   # → http://localhost:5174
```

---

## Referência completa de variáveis de ambiente (pos-backend)

| Variável | Obrigatória | Padrão em .env.example | Lida em | Sensível |
|---|:---:|---|---|:---:|
| `PORT` | Não | `8000` | `config/config.js` L7 | Não |
| `NODE_ENV` | Não | `development` | `config/config.js` L9, `app.js` L128 | Não |
| `MONGODB_URI` | **Sim** | `mongodb://localhost:27017/pos-saas` | `config/config.js` L8 | **Sim** |
| `JWT_SECRET` | **Sim** | `your-super-secret-jwt-key-change-this` | `config/config.js` L10 | **Sim** |
| `RAZORPAY_KEY_ID` | Não | — | `config/config.js` L11 | **Sim** |
| `RAZORPAY_KEY_SECRET` | Não | — | `config/config.js` L12 | **Sim** |
| `RAZORPAY_WEBHOOK_SECRET` | Não | — | `config/config.js` L13 | **Sim** |
| `CORS_ORIGINS` | Não | `http://localhost:5173,...` | `config/config.js` L14 | Não |
| `TZ` | Não | `America/Sao_Paulo` | `config/config.js` L4 | Não |

> **Atenção:** `SOCKET_CORS_ORIGIN` aparece no `.env.example` mas não é lida pelo código (o servidor usa `CORS_ORIGINS` para HTTP e Socket.io). Ignorar essa variável.

> **Gerar JWT_SECRET seguro:** `openssl rand -hex 32`

---

## Configurar MongoDB local com Replica Set

Se não usar Atlas, o MongoDB local precisa de RS para suportar transações:

```bash
# Iniciar mongod com Replica Set
mongod --replSet rs0 --dbpath /data/db --port 27017 &

# Na primeira vez — inicializar o RS (uma única vez)
mongosh --eval "rs.initiate()"

# Verificar status
mongosh --eval "rs.status()"
# Esperado: "stateStr" : "PRIMARY" em um dos members

# URI para usar no .env
MONGODB_URI=mongodb://localhost:27017/pos-saas?replicaSet=rs0
```

---

## Problemas comuns e soluções

### Erro: "Transaction numbers are only allowed on a replica set member"

**Causa:** MongoDB local sem Replica Set.  
**Solução:** Ver seção "Configurar MongoDB local com Replica Set" acima, ou usar MongoDB Atlas.

### Erro: "Cannot find module './config/config'"

**Causa:** Execução do servidor a partir de diretório errado.  
**Solução:**
```bash
cd pos-backend
node app.js  # Sempre a partir de pos-backend/
```

### Erro: "EADDRINUSE: address already in use :::8000"

**Causa:** Processo anterior ainda está rodando na porta.  
**Solução:**
```bash
lsof -i :8000         # Encontrar PID
kill -9 <PID>         # Encerrar
npm run dev           # Reiniciar
```

### Conexão MongoDB falha mas URI parece correta

**Verificar:**
1. IP da máquina está na whitelist do Atlas (Network Access)
2. Usuário do banco tem permissão adequada (Atlas → Database Access)
3. URI tem o formato correto: `mongodb+srv://usuario:senha@cluster.mongodb.net/banco`
4. Senha não tem caracteres especiais sem encoding URI (`@`, `:`, `/` precisam de `%40`, `%3A`, `%2F`)

### `npm install` falha com erro de permissão

```bash
npm install --no-optional  # Evitar dependências opcionais problemáticas
# Ou limpar cache:
npm cache clean --force
rm -rf node_modules
npm install
```

### `npm test` falha com "MongoServerError: command insert requires authentication"

**Causa:** Teste está tentando conectar a um MongoDB real em vez do in-memory.  
**Verificação:**
```bash
cat pos-backend/jest.config.js  # Deve ter globalSetup apontando para setup que usa mongodb-memory-server
grep -n "mongodb-memory-server\|MongoMemoryServer" pos-backend/tests/*.test.js
```
Os testes devem usar `mongodb-memory-server`. Se conectam a banco real, há problema na configuração do jest.

---

## Script de verificação local

```bash
cd pos-backend
bash scripts/verify.sh
```

O script verifica:
1. Node.js ≥ 18 e npm disponível
2. Arquivos obrigatórios presentes
3. `.env` configurado sem valor padrão inseguro no JWT_SECRET
4. Nenhum segredo hardcoded no código fonte
5. `node_modules` instalado
6. `app.js` carrega sem import quebrado
7. `npm test` passa
8. Scripts de package.json referenciam arquivos existentes
9. ADRs presentes em `docs/adr/`

Retorna 0 em sucesso, 1 em falha bloqueante.

---

## Critérios de aceitação

- `curl http://localhost:8000/` retorna `{"message":"Hello from POS Server!"}`
- `npm test` retorna 19 testes passando (verificado em 2026-07-20 — reverificar: `npm test -- --verbose`)
- `bash scripts/verify.sh` retorna "✅ Verificação PASSOU"
- Login funciona: `POST /api/user/login {"email":"admin@pos.com","password":"admin123"}` retorna HTTP 200

## Skills relacionadas

- `pos-execucao-e-operacao` — comandos para rodar seed, migrate, iniciar em produção
- `pos-validacao-e-qa` — como executar testes e interpretar resultados
- `pos-configuracao-e-flags` — referência completa de variáveis e flags

## Proveniência e manutenção

- Verificado em: 2026-07-20
- Fontes primárias:
  - `pos-backend/.env.example`
  - `pos-backend/config/config.js`
  - `pos-backend/package.json`
  - `pos-backend/scripts/verify.sh`
  - `CONTRIBUTING.md`
- Comandos de reverificação:
  - `node --version` (verificar ≥ 18)
  - `npm test -- --forceExit 2>&1 | tail -5` (verificar testes passando)
  - `bash pos-backend/scripts/verify.sh`
- Condições que exigem revisão:
  - Adição de nova variável de ambiente obrigatória em `config.js`
  - Mudança na versão mínima do Node.js
  - Adição de nova dependência opcional com problemas de instalação conhecidos
