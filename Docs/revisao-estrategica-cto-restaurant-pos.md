# Revisão Estratégica de CTO — Restaurant POS System

> **Papel adotado:** CTO de produto com foco em levar sistemas de piloto a produção com recursos limitados  
> **Data:** 2026-07-20  
> **Base:** inspeção completa do repositório + revisão arquitetural anterior

---

## 1. Veredito Executivo

**Recomendação geral:** Continuar com refatoração incremental focada — não reescrever, não expandir funcionalidade ainda.

**Condição atual:** Piloto operacional funcional (console de estoque + gestão de loja) com acumulação de dívida técnica de segurança que precisa ser quitada antes de qualquer onboarding de clientes pagantes. O produto resolve um problema real e o caminho principal existe — mas há duas bombas de tempo ativas que podem destruir a credibilidade do sistema antes do primeiro cliente.

**Maior força:** O modelo de domínio é sólido. Schemas MongoDB bem indexados, separação de camadas real, política transacional de baixa de estoque com fallback documentado. Quem construiu isso entende o problema de negócio.

**Maior risco:** Credenciais do banco de dados de produção e JWT secret comprometidos no repositório Git. Se o repositório for público ou tiver sido clonado por alguém não autorizado, toda a base de dados está acessível agora.

**Decisão para os próximos 90 dias:** Fechar as três vulnerabilidades críticas (segredos, rate limiting, isolamento de socket) nas primeiras duas semanas. Construir a esteira mínima de CI + testes de integração nos próximos 30 dias. Normalizar a dívida de role dualidade e paginação nos 60 dias seguintes. Preparar para crescimento controlado no terceiro mês.

---

## 2. Contexto Validado

| Informação | Declarado | Encontrado no repositório | Divergência |
|---|---|---|---|
| Stack tecnológica | MERN (MongoDB, Express, React, Node.js) | Confirmado. Backend Node/Express/Mongoose, frontend React/Vite, admin Next.js | Nenhuma — admin usa Next.js não mencionado no README principal |
| Integração de pagamento | Razorpay | Confirmado. `paymentController.js` com HMAC-SHA256. Moeda hardcoded como `"INR"` | Sistema é descrito como brasileiro (BRL/CNPJ) mas a integração processa INR — divergência de mercado |
| Sistema multi-tenant | Declarado como SaaS multi-store | Confirmado e bem implementado em rotas principais. PDV sem `storeIsolation` | Bypass identificado — inconsistência entre declaração e implementação no módulo PDV |
| Testes automatizados | Scripts `test:phase1` a `test:phase8` no package.json | Somente `tests/phase8-pdv-models.test.js` existe. Scripts das fases 1–7 apontam para arquivos inexistentes | Cobertura declarada não existe — risco de regressão silenciosa |
| Estágio do produto | Piloto controlado (documentação extensa de piloto) | Confirmado. PILOT_CHECKLIST, PILOT_GUIDE, PILOT_ROLLBACK_PLAN, PILOT_METRICS todos presentes | Checklist não foi preenchido (todos os itens `[ ]`) — piloto pode ainda não ter ocorrido |
| CI/CD | Não declarado | Ausente. Nenhum `.github/`, `Dockerfile` ou configuração de deploy encontrada | Deploy é manual — risco de ambiente não reproduzível |
| Versão do Node.js | Não especificada | Ausente de `package.json` e sem `.nvmrc` | Risco de divergência entre ambientes |
| Mercado-alvo | Brasil (CNPJ no storeModel, BRL no storeSettings) | Confirmado para domínio. Mas pagamento via Razorpay (gateway indiano, INR) | Gateway incompatível com operação brasileira real |

---

## 3. O Que Está Bom

| Item | Evidência | Valor gerado | Preservar como |
|---|---|---|---|
| **Baixa de estoque transacional (MongoDB sessions)** | `orderCheckoutService.js` — política all-or-nothing com hard/soft errors documentados; `stockReversalService.js` usando `startSession()` | Garante consistência de dados em operações financeiras críticas; rollback automático em falha | Padrão mandatório para qualquer nova operação que afete saldo |
| **Middleware `storeIsolation` com injeção de `req.storeId`** | `middlewares/storeIsolation.js` + helpers `getStoreFilter`, `applyStoreToAggregation` | Isola dados entre lojas de forma consistente; reduz risco de cross-tenant nas rotas protegidas | Aplicado como primeiro middleware de todas as rotas após `isVerifiedUser` |
| **Sistema de roles dinâmicas com permissões por módulo** | `roleModel.js` com `hasPermission()`, `hasAnyPermission()`; `checkPermission.js` com suporte a múltiplas ações | Permite controle granular sem redeployar; configurável por loja | Manter o schema de permissões; migrar a dualidade string/ObjectId |
| **Auditoria operacional que nunca lança exceção** | `auditService.js` L31–38: `try/catch` com `return null` em vez de `throw` | Falha de auditoria não bloqueia operação do restaurante — correto para ambiente de produção | Padrão fire-and-forget para audit log |
| **Documentação operacional do piloto** | `PILOT_CHECKLIST.md`, `PILOT_ROLLBACK_PLAN.md`, `PILOT_METRICS.md`, `PILOT_GUIDE.md`, `PILOT_ROADMAP.md` | Equipe tem procedimentos escritos para piloto, rollback e métricas de sucesso | Manter e expandir para cobrir operação contínua pós-piloto |
| **Webhook Razorpay com validação HMAC-SHA256** | `paymentController.js` L57–61: `crypto.createHmac("sha256", secret).update(body).digest("hex")` | Valida autenticidade de eventos de pagamento — protege contra injeção de eventos falsos | Padrão para qualquer novo webhook externo |

---

## 4. O Que Está Ruim

| Problema | Componente | Severidade | Probabilidade | Impacto | Evidência |
|---|---|---:|---:|---|---|
| **Credenciais de produção no repositório** | `pos-backend/.env` | 🔴 Crítica | Alta | Comprometimento total do banco de dados e forja de tokens para qualquer loja | `.env` L5: URI MongoDB Atlas com usuário/senha; L8: JWT_SECRET com valor padrão fraco |
| **Sem rate limiting em login e registro** | `routes/userRoute.js` | 🔴 Alta | Alta | Brute-force de senhas; enumeração de usuários válidos; abuso de `/register` | Grep por 'rate limit' e 'express-rate-limit' sem resultado |
| **PDV sem `storeIsolation`** | `routes/pdvRoutes.js` | 🔴 Alta | Média | Operações de caixa e pagamento sem garantia de escopo de loja; vulnerabilidade cross-tenant | `pdvRoutes.js` L12–75: nenhuma referência a `storeIsolation`; `pdvController.js` L20 infere store de `req.user.store` diretamente |
| **Socket.io sem autenticação de handshake** | `app.js` L24–63 | 🟠 Alta | Média | Qualquer cliente pode entrar em room de qualquer loja e escutar pedidos, alertas e movimentos de estoque em tempo real | `app.js` L28: `socket.on('join:store', (storeId) => socket.join(...))` — sem verificação de pertencimento |
| **`/api/subscription/seed` sem controle de acesso** | `routes/subscriptionRoutes.js` L36 | 🟠 Alta | Baixa | Qualquer usuário autenticado pode recriar planos e alterar estrutura de precificação | `subscriptionRoutes.js` L36: `router.post('/seed', seedPlans)` — sem `checkPermission` ou verificação de `isMasterAdmin` |
| **Cobertura de testes inexistente** | `pos-backend/tests/` | 🟠 Alta | Alta | Regressões silenciosas em qualquer mudança; impossibilidade de medir impacto de refatorações | `tests/` contém apenas `phase8-pdv-models.test.js`; scripts `test:phase1`–`test:phase7` apontam para arquivos inexistentes |
| **Razorpay processando INR em sistema brasileiro** | `controllers/paymentController.js` L16 | 🟠 Alta | Alta (se usado em produção BR) | Pagamentos de clientes brasileiros criam ordens em rúpias indianas — operação inviável | `paymentController.js` L16: `currency: "INR"`; `storeModel.js` L53: `currency: 'BRL'` |
| **Sem CI/CD e sem ambiente reproduzível** | Raiz do projeto | 🟡 Média | Alta | Impossibilidade de rollback rápido; ambientes de dev e prod divergem silenciosamente; onboarding de novo desenvolvedor demora dias | Ausência total de `Dockerfile`, `.github/`, pipeline de deploy |

---

## 5. Melhorias Não Bloqueadoras

| Melhoria | Benefício | Esforço | Momento adequado |
|---|---|---:|---|
| Structured logging com `pino` | Habilita busca por `storeId`, correlação de erros, integração com ferramentas de observabilidade | M | 31–60 dias |
| Normalizar campo `role` de `Mixed` para `ObjectId` obrigatório | Elimina 3 branches condicionais de autorização; simplifica manutenção | M | 31–60 dias |
| Paginação server-side em listagens | Performance com crescimento de dados; hoje carrega tudo na memória | M | 31–60 dias |
| Corrigir enum `cancelled`/`canceled` no `subscriptionModel` | Previne queries com resultado inconsistente | S | 0–30 dias (junto de P0) |
| Health check em `GET /health` | Prerequisito para qualquer monitoramento ou balanceador de carga | S | 0–30 dias |
| `engines` no `package.json` | Fixa versão do Node.js; evita divergência entre ambientes | S | 0–30 dias |
| Separar `dashboardController.js` (803 linhas) em sub-controllers | Facilita leitura, manutenção e testes unitários por domínio | L | 61–90 dias |
| Validação de input com Zod/Joi no backend | Bloqueia dados malformados na fronteira da API; melhora mensagens de erro | L | 61–90 dias |
| TypeScript no `pos-frontend` | Admin já usa TS; unificar reduz erros em tempo de compilação | L | Backlog — não agora |
| Substituir gateway Razorpay/INR por gateway BR | Pré-requisito para operação comercial no Brasil | M | Depende da decisão de mercado |

---

## 6. Adequação Produto–Arquitetura

### 1. A arquitetura corresponde ao problema de negócio?

**Sim, com ressalvas.** O problema é gerir múltiplos pontos de venda em um food park ou rede de restaurantes, com controle centralizado de estoque. A arquitetura de monólito Express com multi-tenancy por middleware, WebSocket por loja e pipeline de baixa de estoque transacional está alinhada com o problema. A adição de um painel admin Next.js separado faz sentido operacional.

### 2. O sistema está mais complexo do que o necessário?

**Parcialmente.** O modelo de estoque (StockLocation, StockBalance, StockMovement, StockPolicy, StockAlert, productionBatch, recipes) é rico e necessário para o problema. O que é excessivo para o estágio atual: o módulo de Subscription/Billing com campos `stripeSubscriptionId`/`stripeCustomerId` que não têm implementação real — é schema preparado sem código de integração.

### 3. Há funcionalidades técnicas sem uso real?

- **Socket.io no frontend admin:** `socket.io-client` está no `package.json` do admin mas nunca é importado (`AUDITORIA.md` L31: "frontend NUNCA usa"). O backend emite eventos em tempo real que nenhum cliente consome.
- **Stripe no modelo de subscription:** Campos mapeados mas sem integração.
- **iFood Scraper:** Diretório `pos-backend/ifood-scraper/` existe mas não está integrado na aplicação.

### 4. Há riscos críticos escondidos por boa documentação?

**Sim.** A extensa documentação de piloto (`PILOT_CHECKLIST`, `PILOT_ROLLBACK_PLAN`) pode dar impressão de sistema maduro, mas o checklist está completamente em branco — nenhum item foi marcado. O piloto pode ainda não ter ocorrido.

### 5. O caminho principal do usuário está completo?

**Parcialmente.** O ciclo completo de venda (criar pedido → KDS → pagamento → baixa de estoque → fechamento de mesa) existe no backend. O frontend POS (`pos-frontend`) não foi inspecionado em detalhe, mas a documentação sugere que WebSocket e paginação ainda são gaps funcionais.

### 6. A arquitetura favorece aprendizado rápido com usuários?

**Moderadamente.** O piloto está bem documentado para validação com usuários reais. O sistema tem dados de seed, scripts de rollback e métricas definidas. O gap é a ausência de ambiente reproduzível (sem Docker) — cada setup é uma aventura.

### 7. Existe um núcleo simples que deveria ser preservado?

**Sim:** o tríptico `storeIsolation` + `checkPermission` + `orderCheckoutService` com MongoDB sessions. É o coração do valor do sistema e o que o diferencia de uma CRUD app comum.

### 8. Recomendação de continuidade

**Refatoração incremental.** Não há justificativa para reescrita: o modelo de domínio está correto, a separação de camadas existe, a documentação é relevante. O problema não é arquitetural — é de maturidade operacional: segredos, testes, CI/CD e alguns bypasses de segurança. Esses são corrígíveis com esforço S/M sem tocar na lógica de negócio.

---

## 7. Roadmap P0–P3

---

```
ID: P0-01
Título: Revogar e rotacionar credenciais expostas no repositório
Problema: URI do MongoDB Atlas com usuário/senha e JWT_SECRET com valor padrão estão em .env commitado no repositório.
Evidência: pos-backend/.env L5 (URI MongoDB Atlas com credenciais reais), L8 (JWT_SECRET=your-super-secret-jwt-key-change-this)
Impacto se não corrigido: Qualquer pessoa com acesso ao repositório pode conectar diretamente ao banco de produção e forjar tokens JWT válidos para qualquer loja e usuário.
Mudança proposta:
  1. Revogar imediatamente o usuário MongoDB Atlas (`felipeccabral2011_db_user`) e criar novo usuário com nova senha.
  2. Gerar novo JWT_SECRET com `openssl rand -hex 32`.
  3. Adicionar `pos-backend/.env` ao `.gitignore` e executar `git rm --cached pos-backend/.env`.
  4. Remover o arquivo do histórico Git com `git filter-repo --path pos-backend/.env --invert-paths` ou `BFG Repo Cleaner`.
  5. Adotar variáveis de ambiente via secrets manager (Doppler, Railway secrets, ou variáveis de ambiente do servidor).
Arquivos ou módulos afetados: pos-backend/.env, pos-backend/.gitignore, pos-backend/config/config.js
Dependências: Nenhuma — pode ser feito agora.
Esforço: S
Risco da implementação: Médio — serviços rodando precisam ser reiniciados com novas credenciais.
Critério de aceite: .env ausente do histórico Git; conexão ao banco funcional com novas credenciais; JWT_SECRET gerado com entropia adequada (≥32 bytes aleatórios); nenhum segredo hardcoded em config.js.
O que não deve ser feito: Não adicionar secrets em arquivos de configuração de código ou em comentários de código.
```

---

```
ID: P0-02
Título: Adicionar rate limiting em endpoints de autenticação e registro
Problema: POST /api/user/login e POST /api/user/register não têm throttling. Qualquer atacante pode tentar senhas em loop ou criar usuários arbitrários sem restrição.
Evidência: routes/userRoute.js L8-9 sem middleware de rate limit; grep por 'express-rate-limit' sem resultado em todo o repositório.
Impacto se não corrigido: Brute-force de credenciais de qualquer usuário; registro massivo de usuários fictícios; possível DoS do servidor.
Mudança proposta:
  Instalar `express-rate-limit`. Criar middleware com limite de 10 requisições/15 minutos por IP para `/api/user/login` e 5 requisições/hora por IP para `/api/user/register`. Responder HTTP 429 com mensagem "Too many requests" quando limite excedido. Aplicar o limiter antes de qualquer middleware de negócio nas rotas afetadas.
Arquivos ou módulos afetados: pos-backend/routes/userRoute.js, pos-backend/package.json
Dependências: P0-01 (ambiente de segredos estabilizado)
Esforço: S
Risco da implementação: Baixo — não afeta fluxo normal com uso humano.
Critério de aceite: Login bloqueado com HTTP 429 após 10 tentativas em 15 minutos do mesmo IP; registro bloqueado após 5 tentativas em 1 hora; testes automatizados validando o comportamento de bloqueio.
O que não deve ser feito: Não usar o IP do cliente como único identificador em cenários com balanceador de carga — configurar `trust proxy` no Express se houver reverse proxy à frente.
```

---

```
ID: P0-03
Título: Aplicar storeIsolation nas rotas do PDV
Problema: pdvRoutes.js usa apenas checkRole sem storeIsolation, deixando req.storeId indefinido. Os controllers do PDV inferem a store de req.user.store diretamente, sem a validação e injeção padronizada do middleware.
Evidência: pos-backend/routes/pdvRoutes.js L12-75 — nenhuma referência a storeIsolation; pos-backend/controllers/pdvController.js L20: `req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store` sem garantia de validação.
Impacto se não corrigido: Operações de caixa e pagamento sem isolamento formal de loja; em futuras expansões ou ao introduzir usuários multi-store, os controles falham sem aviso.
Mudança proposta:
  Adicionar `storeIsolation` como middleware em todas as 9 rotas de pdvRoutes.js, posicionado após `isVerifiedUser` e antes de `checkRole`. Verificar que todos os controllers do PDV usam `req.storeId` (injetado pelo middleware) e não `req.user.store` diretamente.
Arquivos ou módulos afetados: pos-backend/routes/pdvRoutes.js, pos-backend/controllers/pdvController.js
Dependências: Nenhuma.
Esforço: S
Risco da implementação: Baixo — storeIsolation já é testado nas demais rotas.
Critério de aceite: req.storeId sempre definido nas 9 rotas do PDV; teste automático validando que usuário de Loja A não consegue abrir sessão de caixa ou processar pagamento na Loja B.
O que não deve ser feito: Não remover a verificação inline existente em pdvController.js antes de validar que storeIsolation cobre todos os cenários do master admin.
```

---

```
ID: P0-04
Título: Implementar autenticação de handshake no Socket.io
Problema: Qualquer cliente TCP pode conectar ao Socket.io e emitir join:store com qualquer storeId, recebendo eventos de pedidos, alertas e estoque de qualquer loja.
Evidência: app.js L24-63: io.on('connection') sem verificação de token; socket.on('join:store', (storeId) => socket.join(`store:${storeId}`)) aceita qualquer valor sem autenticação.
Impacto se não corrigido: Vazamento de dados de pedidos e movimentos de estoque entre lojas concorrentes; espionagem de operação em tempo real.
Mudança proposta:
  Adicionar middleware de autenticação Socket.io com `io.use((socket, next) => { ... })` que:
  (1) Lê o JWT de `socket.handshake.auth.token`.
  (2) Verifica o token com `jwt.verify`.
  (3) Carrega o usuário do banco e valida isActive.
  (4) Armazena `socket.user` para uso nos handlers de join.
  No handler `join:store`, verificar que o storeId solicitado pertence ao `socket.user.store` ou que o usuário é masterAdmin. Rejeitar com `socket.emit('error', 'Unauthorized')` e desconectar.
Arquivos ou módulos afetados: pos-backend/app.js, ajuste nos clientes pos-frontend e pos-admin para enviar token no handshake.
Dependências: P0-01 (JWT_SECRET estabilizado).
Esforço: M
Risco da implementação: Médio — requer ajuste coordenado em backend e frontends.
Critério de aceite: Conexão sem token válido recebe erro e é desconectada; cliente de Loja A não recebe eventos emitidos para Loja B; testes de integração cobrindo conexão autenticada e tentativa não autorizada.
O que não deve ser feito: Não usar o storeId passado pelo cliente como única fonte de verdade — sempre validar contra o user carregado do banco.
```

---

```
ID: P1-01
Título: Proteger /api/subscription/seed e restringir /api/user/register
Problema: O endpoint POST /api/subscription/seed é acessível por qualquer usuário autenticado sem verificação de role de administrador. POST /api/user/register é público sem autenticação.
Evidência: subscriptionRoutes.js L36: router.post('/seed', seedPlans) sem middleware adicional; userRoute.js L8: router.route('/register').post(register) sem isVerifiedUser.
Impacto se não corrigido: Usuário autenticado pode recriar/sobrescrever estrutura de planos e precificação; qualquer pessoa pode criar usuários em lojas existentes se souber o storeId.
Mudança proposta:
  Para /seed: adicionar verificação inline `if (!req.user.isMasterAdmin) return next(createHttpError(403, 'Forbidden'))` ou criar middleware `requireMasterAdmin`.
  Para /register: criar endpoint `/invite` autenticado para criação de usuários por admin; manter /register apenas para o primeiro usuário da loja (bootstrapping) com validação de que a loja não tem usuários ativos.
Arquivos ou módulos afetados: pos-backend/routes/subscriptionRoutes.js, pos-backend/routes/userRoute.js, pos-backend/controllers/userController.js
Dependências: Nenhuma.
Esforço: S
Risco da implementação: Baixo — adicionar restrição, não remover funcionalidade.
Critério de aceite: /seed retorna 403 para não-masterAdmin; /register sem token retorna 401; testes cobrindo os dois cenários.
O que não deve ser feito: Não bloquear completamente o registro sem fornecer um fluxo alternativo de onboarding de novos usuários.
```

---

```
ID: P1-02
Título: Implementar CI/CD mínimo com execução automática de testes
Problema: Nenhum pipeline CI/CD existe. Deploy é manual. Os scripts test:phase1–phase7 declarados no package.json apontam para arquivos inexistentes.
Evidência: Ausência de .github/, Dockerfile, docker-compose.yml; tests/ contém apenas phase8-pdv-models.test.js; package.json L10-15 referencia arquivos de teste não encontrados.
Impacto se não corrigido: Regressões detectadas somente em produção; onboarding de novo desenvolvedor demora dias para configurar ambiente; impossibilidade de demonstrar qualidade a investidores ou clientes corporativos.
Mudança proposta:
  (1) Criar Dockerfile multi-stage para pos-backend (build + runtime).
  (2) Criar docker-compose.yml com pos-backend + MongoDB local para desenvolvimento.
  (3) Criar .github/workflows/ci.yml com jobs: install → lint → test → build.
  (4) Criar pelo menos 5 testes de integração cobrindo: autenticação bem-sucedida, rejeição cross-tenant em pedidos, baixa de estoque com saldo suficiente, baixa de estoque com saldo insuficiente, criação de sessão de caixa duplicada.
  (5) Remover os scripts test:phase1–phase7 do package.json ou criar os arquivos correspondentes.
Arquivos ou módulos afetados: pos-backend/Dockerfile, docker-compose.yml, .github/workflows/ci.yml, pos-backend/tests/
Dependências: P0-01 (secrets não podem estar hardcoded no CI).
Esforço: L
Risco da implementação: Baixo para CI; médio para Docker (pode revelar dependências implícitas de ambiente).
Critério de aceite: Push na branch main dispara pipeline que executa testes; falha bloqueia merge; docker compose up levanta o backend funcional; npm test passa com pelo menos 5 testes reais de integração.
O que não deve ser feito: Não usar banco de dados de produção nos testes; não commitar secrets no arquivo de CI.
```

---

```
ID: P1-03
Título: Adicionar helmet e headers de segurança HTTP
Problema: Nenhum header de segurança HTTP é enviado pelo servidor Express. Sem X-Frame-Options, Content-Security-Policy, X-Content-Type-Options, HSTS, X-XSS-Protection.
Evidência: Grep por 'helmet' sem resultado; app.js não configura nenhum header de segurança manualmente.
Impacto se não corrigido: Interface admin vulnerável a clickjacking; ausência de CSP facilita XSS persistente; sem HSTS em produção.
Mudança proposta:
  Instalar `helmet`. Adicionar `app.use(helmet())` em app.js imediatamente antes dos middlewares de rota. Configurar CSP adequada para o frontend (permitir conexões Socket.io, fontes do sistema). Testar com securityheaders.com após deploy.
Arquivos ou módulos afetados: pos-backend/app.js, pos-backend/package.json
Dependências: Nenhuma.
Esforço: S
Risco da implementação: Baixo — CSP pode bloquear recursos legítimos; testar em staging primeiro.
Critério de aceite: securityheaders.com retorna nota ≥ B para o domínio do backend; X-Frame-Options: DENY presente nas respostas; HSTS habilitado em produção com HTTPS.
O que não deve ser feito: Não aplicar CSP excessivamente restritiva antes de testar o frontend integrado — pode quebrar Socket.io e carregamento de fontes.
```

---

```
ID: P1-04
Título: Implementar health check e observabilidade mínima
Problema: Não há endpoint de health check. Todo o logging é via console.log sem estrutura. Impossível monitorar o sistema ou integrar com qualquer ferramenta de alerta.
Evidência: app.js sem rota /health; todos os controllers usam console.log/console.error sem contexto de storeId ou requestId.
Impacto se não corrigido: Downtime detectado apenas por usuário reclamando; impossibilidade de diagnosticar incidentes em produção; sem SLA verificável.
Mudança proposta:
  (1) Adicionar GET /health que retorna { status: 'ok', db: 'connected'|'disconnected', uptime, timestamp } verificando mongoose.connection.readyState.
  (2) Instalar `pino` e substituir console.log/console.error pelo logger estruturado, incluindo campos: level, timestamp, requestId (gerado por middleware uuid), storeId (quando disponível), message.
  (3) Adicionar middleware de requestId que injeta UUID em req.id e nos headers de resposta (X-Request-Id).
Arquivos ou módulos afetados: pos-backend/app.js, todos os controllers e services com console.log (25 arquivos aprox.)
Dependências: Nenhuma.
Esforço: M
Risco da implementação: Baixo — substituição de logging não altera lógica de negócio.
Critério de aceite: GET /health retorna 200 com db:connected quando MongoDB está acessível; retorna 503 quando desconectado; logs em formato JSON com campos obrigatórios; requestId rastreável entre entrada e saída de uma requisição.
O que não deve ser feito: Não expor /health sem autenticação se o endpoint revelar informações sensíveis de infraestrutura; limitar ao status básico de conectividade.
```

---

```
ID: P1-05
Título: Substituir gateway Razorpay/INR por gateway compatível com operação brasileira
Problema: paymentController.js hardcoda currency: "INR" (rúpia indiana). O sistema é declarado como brasileiro — CNPJ no storeModel, BRL como moeda padrão nas configurações.
Evidência: paymentController.js L16: currency: "INR"; storeModel.js L53: currency: 'BRL'; storeModel.js L17: cnpj: { type: String, required: true }.
Impacto se não corrigido: Impossibilidade de processar pagamentos reais de clientes brasileiros; cobranças incorretas se o sistema for usado em produção com este código.
Mudança proposta:
  Avaliar gateway brasileiro adequado ao porte do projeto (Mercado Pago, PagSeguro, Stripe BR, Asaas). Refatorar paymentController.js para usar o gateway escolhido com currency: "BRL". Atualizar config.js com novas variáveis de ambiente do gateway. Manter a estrutura de validação de webhook por HMAC que já existe — apenas trocar o provider.
Arquivos ou módulos afetados: pos-backend/controllers/paymentController.js, pos-backend/config/config.js, pos-backend/.env.example
Dependências: Decisão de produto sobre gateway alvo.
Esforço: M
Risco da implementação: Médio — requer integração com novo provider e testes de homologação.
Critério de aceite: Pagamentos processados em BRL; webhook validado com HMAC do novo gateway; nenhuma referência a INR ou Razorpay no código de produção.
O que não deve ser feito: Não manter os dois gateways em paralelo sem estratégia clara de migração — aumenta complexidade sem benefício.
```

---

```
ID: P2-01
Título: Normalizar campo role de Mixed para ObjectId com migração de dados
Problema: userModel.js define role como mongoose.Schema.Types.Mixed — pode ser string ('Admin', 'Garçom') ou ObjectId. Isso cria branches condicionais em checkPermission.js, tokenVerification.js e userController.js com risco de bypass de autorização pelo caminho legacy.
Evidência: userModel.js L46-50; checkPermission.js L202-212; userController.js L186-204 com permissões hardcoded para role string 'Admin'.
Impacto se não corrigido: Complexidade crescente a cada novo módulo; risk de inconsistência entre permissões declaradas e permissões aplicadas; dificulta testes automatizados.
Mudança proposta:
  (1) Criar script de migração que encontra todos os usuários com role do tipo string e os associa à Role ObjectId correspondente (buscando por nome).
  (2) Alterar userModel.js: role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true }.
  (3) Remover todos os branches de string legacy de checkPermission.js e userController.js.
  (4) Atualizar tests/setup.js para criar usuários com role ObjectId.
Arquivos ou módulos afetados: pos-backend/models/userModel.js, pos-backend/middlewares/checkPermission.js, pos-backend/controllers/userController.js, novo script de migração
Dependências: P1-02 (CI deve estar ativo para validar que a migração não quebra testes).
Esforço: M
Risco da implementação: Médio — migração de dados em produção requer rollback plan.
Critério de aceite: Todos os usuários têm role como ObjectId; nenhum branch de string legacy no código; testes de permissão cobrindo todos os módulos do roleModel.
O que não deve ser feito: Não fazer a migração sem backup do banco; não remover o código legacy antes de validar que todos os registros foram migrados.
```

---

```
ID: P2-02
Título: Implementar paginação server-side nos controllers de listagem
Problema: Controllers de listagem (produtos, pedidos, ingredientes, movimentos de estoque) retornam todos os registros sem paginação. Frontend carrega tudo na memória.
Evidência: AUDITORIA.md L34-38 (GAP-002): "DataTable carrega TODOS os registros de uma vez; Backend Controllers não suportam ?page=&limit=".
Impacto se não corrigido: Performance degradada com crescimento de dados; potencial timeout de API com >1000 registros; experiência do usuário ruim.
Mudança proposta:
  Criar helper `paginate(query, req)` que extrai page e limit do query string, aplica .skip() e .limit() no Mongoose, e retorna { data, total, page, totalPages }. Aplicar em todos os controllers de listagem. Ajustar frontend para consumir metadados de paginação e renderizar controles de página.
Arquivos ou módulos afetados: controllers/*.js (todos com Model.find() sem limite), pos-frontend/src/, pos-admin/src/
Dependências: P1-02 (testes existentes devem cobrir paginação).
Esforço: M
Risco da implementação: Baixo — adiciona parâmetros sem quebrar comportamento existente se defaults forem configurados.
Critério de aceite: Toda listagem suporta ?page=1&limit=50; resposta inclui total e totalPages; frontend não carrega mais de 100 registros por chamada sem paginação explícita.
O que não deve ser feito: Não implementar cursor-based pagination agora — offset/page é suficiente para o volume atual.
```

---

```
ID: P3-01
Título: Integrar socket.io-client no pos-admin para atualizações em tempo real
Problema: O backend emite eventos de pedidos, alertas e KDS via Socket.io. O frontend admin tem socket.io-client instalado mas nunca o usa — KDS e dashboard fazem polling.
Evidência: pos-admin/package.json L27: "socket.io-client": "^4.8.3"; AUDITORIA.md L28-31: "socket.io-client está no package.json mas nunca é importado".
Impacto se não corrigido: Dados desatualizados no KDS (visualização da cozinha); latência artificial de polling onde tempo real seria possível.
Mudança proposta:
  Criar hook useSocket.ts no pos-admin com conexão autenticada (token no handshake — depende de P0-04). Subscrever eventos order:created, order:updated, kds:item-updated por store room. Integrar no KDS panel e no dashboard de alertas.
Arquivos ou módulos afetados: pos-admin/src/hooks/useSocket.ts (novo), pos-admin/src/app/kds/, pos-admin/src/app/dashboard/
Dependências: P0-04 (autenticação de handshake deve existir antes de integrar clientes).
Esforço: M
Risco da implementação: Baixo — é adicição de funcionalidade, não remoção.
Critério de aceite: KDS atualiza automaticamente ao receber eventos de pedido sem polling; conexão desconectada reconecta automaticamente; socket desconectado em logout.
O que não deve ser feito: Não remover o polling como fallback antes de validar a estabilidade da conexão Socket.io em ambiente de produção.
```

---

```
ID: P3-02
Título: Validação de input com schema (Zod) no backend
Problema: Controllers não validam estrutura dos dados de entrada além dos validators do Mongoose. Dados malformados chegam à lógica de negócio e geram erros 500 genéricos.
Evidência: AUDITORIA.md L40-43 (GAP-003): "Formulários sem validação (apenas HTML required); Backend sem validação com Zod/Joi/Yup; Impacto: Dados inconsistentes, possibilidade de injeção".
Mudança proposta:
  Instalar `zod`. Criar schemas de validação para os 5 endpoints mais críticos (login, register, createOrder, processPayment, createSubscription). Criar middleware validateBody(schema) que rejeita com HTTP 422 e lista de erros estruturados antes de chegar ao controller.
Arquivos ou módulos afetados: pos-backend/routes/*.js, novo diretório pos-backend/schemas/
Dependências: P1-02 (testes devem cobrir validação de input).
Esforço: L
Risco da implementação: Baixo — rejeição antecipada com 422 não quebra clientes corretos.
Critério de aceite: Requisição com campo obrigatório ausente retorna 422 com campo e mensagem; SQL injection e path traversal em campos string são sanitizados antes do controller.
O que não deve ser feito: Não criar schemas Zod duplicando exatamente os validators do Mongoose — focar nos invariantes de negócio que o Mongoose não cobre.
```

---

## 8. Plano de 30, 60 e 90 Dias

| Período | Objetivo | Entregas | Critério de sucesso |
|---|---|---|---|
| **0–30 dias** | Fechar vulnerabilidades críticas e criar base operacional reproduzível | P0-01 (credenciais), P0-02 (rate limiting), P0-03 (PDV isolation), P0-04 (socket auth), P1-01 (seed/register), P1-03 (helmet), P1-04 (health check + logging), início de P1-02 (Dockerfile + 5 testes de integração) | Repositório sem secrets; /health funcional; login com rate limit; pipeline CI rodando; 5 testes de integração passando |
| **31–60 dias** | Estabilizar caminho principal e reduzir fragilidade estrutural | P1-02 completo (CI com testes), P1-05 (gateway BR), P2-01 (normalizar role), correção de enum cancelled/canceled, health check em produção | npm test no CI verde; gateway em BRL funcional em staging; role como ObjectId em todos os registros; todos os ambientes configurados via .env sem secrets hardcoded |
| **61–90 dias** | Preparar crescimento e fechar dívida técnica relevante | P2-02 (paginação), separação do dashboardController, validação de input (primeiros 5 endpoints), Zod parcial (P3-02 início), documentação de deploy atualizada | Listagens paginadas; controller de dashboard <200 linhas; novo endpoint com cobertura de teste >80%; deploy documentado e reproduzível por qualquer pessoa da equipe |

**Riscos mitigados ao final de 90 dias:**
- Comprometimento de credenciais: mitigado nos primeiros 7 dias
- Brute-force de login: mitigado nos primeiros 14 dias
- Cross-tenant no PDV: mitigado nos primeiros 14 dias
- Regressões silenciosas: mitigado ao final de 60 dias
- Pagamentos em moeda errada: mitigado ao final de 60 dias

**Sinal de sucesso ao final dos 90 dias:** Uma nova loja pode ser onboardada sem assistência do desenvolvedor, usando apenas a documentação de deploy; nenhum incidente de segurança relatado; pipeline CI verde; pelo menos 1 ciclo de pedido completo (criar → pagar → fechar mesa) coberto por teste automatizado.

---

## 9. O Que Não Fazer Agora

| Iniciativa | Razão para adiar |
|---|---|
| **Microserviços ou separação do backend em serviços** | O monólito Express com multi-tenancy por middleware é suficiente para o volume atual. Fragmentar geraria overhead de rede, operação e manutenção sem nenhum benefício comprovado. |
| **Kubernetes ou orquestração de containers** | Sistema é piloto com poucas lojas. Docker Compose ou um único servidor gerenciado é mais do que suficiente e muito mais simples de operar. |
| **Integração Stripe (que já está mapeada no schema)** | Os campos stripeSubscriptionId e stripeCustomerId existem mas não têm código de integração. Implementar Stripe agora adiciona complexidade de webhook, segurança de chave e lógica de cobrança — sem usuário pagante aguardando. |
| **Reescrita total ou migração para TypeScript no pos-frontend** | O frontend em JavaScript funciona. A dívida de tipagem é real mas não bloqueia o produto. Migrar agora consumiria semanas sem gerar valor para o usuário. |
| **iFood Scraper (diretório presente mas não integrado)** | Integração com dados de terceiros (scraping) tem implicações legais, de disponibilidade e de manutenção. Não deve ser integrada sem validação clara do caso de uso e análise de termos de serviço. |
| **Gráficos avançados no dashboard (Recharts)** | A auditoria do admin identificou que gráficos Recharts não foram implementados. Dado o estágio atual, dados tabulares com filtros são suficientes para o piloto — investir em visualização é polish, não funcionalidade core. |
| **Abstração de repositório formal (Repository Pattern) em todos os models** | A camada de service já absorve a lógica de negócio. Introduzir um Repository Pattern completo agora é refatoração estrutural sem bug a corrigir — complexidade sem retorno imediato. |
| **CQRS ou Event Sourcing** | O volume atual de dados e a simplicidade do domínio não justificam. Seria infraestrutura prematura que dificultaria manutenção sem benefício mensurável. |

---

## 10. Scorecard Final

| Dimensão | Nota (1–10) | Justificativa |
|---|---:|---|
| **Valor de produto** | 8 | O problema de gestão de estoque multi-loja em food parks é real e o sistema oferece ferramentas práticas (alertas, transferências, auditoria). O módulo de PDV com sessão de caixa é diferencial. Desconto por gateway incompatível com Brasil. |
| **Completude do caminho principal** | 6 | Ciclo pedido→KDS→pagamento→baixa de estoque existe no backend. Frontend usa polling onde deveria usar WebSocket. Paginação ausente. Fiscal brasileiro ausente. |
| **Arquitetura** | 7 | Layered architecture coerente, multi-tenancy bem modelado, transações em operações críticas. Penalização pela dualidade de role (Mixed) e pelo bypass de storeIsolation no PDV. |
| **Segurança** | 2 | Credenciais comprometidas no repositório são uma falha ativa de segurança — não uma vulnerabilidade teórica. Sem rate limiting, sem helmet, Socket.io sem autenticação. O sistema não deve ter clientes pagantes com esse scorecard. |
| **Confiabilidade** | 5 | Transações MongoDB onde necessário. Fire-and-forget no KDS pode causar inconsistências. Sem health check. Sem monitoramento. Sem alertas de operação. |
| **Dados** | 7 | Schemas bem definidos com índices compostos. Audit log funcional. Transações em operações críticas. Penalização pela inconsistência de enum (cancelled/canceled) e pela dualidade de role. |
| **Testes** | 2 | 1 arquivo de teste real. Scripts de teste de fases 1–7 apontam para arquivos inexistentes. Sem testes de integração para nenhum dos fluxos críticos. |
| **Operação** | 3 | Sem Docker, sem CI/CD, sem health check, sem structured logging, sem processo de deploy documentado e reproduzível. Deploy é operação manual. |
| **Manutenção** | 6 | Separação de camadas real facilita manutenção. Documentação de piloto detalhada. Controllers grandes (dashboardController 803L) dificultam leitura. Dualidade de role aumenta complexidade de qualquer mudança no sistema de autorização. |
| **Velocidade de evolução** | 5 | O modelo de domínio sólido e a separação de camadas permitem adicionar funcionalidades. Mas a ausência de testes e CI significa que cada entrega é um risco. Com os P0/P1 resolvidos, a velocidade pode subir para 7-8. |
