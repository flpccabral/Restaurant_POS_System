---
name: pos-seguranca
description: >-
  Use quando precisar audithar, implementar ou corrigir aspectos de segurança do sistema:
  autenticação JWT, cookies HTTP-only, autorização baseada em Roles (RBAC),
  middleware de isolamento multi-tenant (storeIsolation), validação de webhooks (HMAC)
  e proteção contra vazamento de credenciais ou vulnerabilidades cross-tenant.
---

# Segurança — Restaurant POS System

## Quando usar

- Implementar novos endpoints autenticados ou que necessitem de autorização granular
- Auditar segurança do isolamento de dados entre lojas (multi-tenant)
- Configurar gerenciamento de credenciais e segredos de ambiente
- Corrigir ou verificar vulnerabilidades ativas relatadas em `SECURITY.md`
- Tratar validação de integridade em webhooks (ex: Razorpay HMAC-SHA256)

## Quando não usar

- Correções puramente estéticas ou funcionais sem impacto de acesso/dados
- Configuração inicial do ambiente local apenas para execução (→ `pos-build-e-ambiente`)

---

## Modelo de Ameaças e Arquitetura de Segurança

### 1. Autenticação (JWT em Cookie HTTP-only)

- **Mecanismo:** Os tokens JWT são emitidos no login e gravados no cookie `accessToken`.
- **Propriedades:** `httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'lax'` ou `'none'`.
- **Suporte a Header:** `tokenVerification.js` também aceita `Authorization: Bearer <token>` para compatibilidade com dispositivos mobile/PDV.

### 2. Multi-Tenancy (Isolamento de Loja)

- **Middleware:** `storeIsolation.js`.
- **Regra:** O `storeId` é injetado via token (`req.user.store`). O middleware valida o acesso e injeta `req.storeId` (UUID) e `req.store` (ObjectId).
- **Invariante:** Nunca confiar em `storeId` enviado no corpo da requisição por clientes não-master-admin.

### 3. Autorização Granular (RBAC Dinâmico)

- **Middleware:** `checkPermission(module, action)`.
- **Funcionamento:** Consulta as permissões associadas à `Role` do usuário (definida em `roleModel.js`).
- **Suporte Legado:** Caso `role` seja uma String (ex: `'Admin'`), o middleware valida permissões através de listas estáticas padrão.

### 4. Validação de Webhooks

- **Pagamentos (Razorpay):** `paymentController.js` valida o cabeçalho `x-razorpay-signature` usando HMAC-SHA256 e a chave secret `RAZORPAY_WEBHOOK_SECRET`.

---

## Vulnerabilidades Conhecidas e Ações Recomendadas (P0 / P1)

1. **Credenciais Expostas (P0-01):** Nunca commitar `.env` contendo `MONGODB_URI` ou `JWT_SECRET` reais. Rotacionar segredos em caso de exposição.
2. **Falta de Rate Limiting (P0-02):** Implementar limite de requisições em `/api/user/login` e `/api/user/register` para prevenir brute-force.
3. **Bypass de Isolamento em PDV (P0-03):** Rotas em `pdvRoutes.js` necessitam da injeção do middleware `storeIsolation`.
4. **WebSocket sem Handshake Autenticado (P0-04):** Adicionar verificação JWT na conexão do Socket.io.

---

## Checklist de Segurança para Código Novo

- [ ] A rota pública exige autenticação? Se sim, `isVerifiedUser` está presente?
- [ ] A rota manipula dados de loja? Se sim, `storeIsolation` está aplicado?
- [ ] A rota é restrita por perfil? Se sim, `checkPermission` ou `isMasterAdmin` está configurado?
- [ ] Dados sensíveis (senhas, segredos) estão fora dos logs (`console.log`)?

## Skills Relacionadas

- `pos-contrato-de-arquitetura` — decisões arquiteturais sobre multi-tenancy e autorização
- `pos-controle-de-mudancas` — regras para inserção de middlewares em novas rotas

## Proveniência e Manutenção

- Verificado em: 2026-07-20
- Fontes primárias:
  - `pos-backend/middlewares/tokenVerification.js`
  - `pos-backend/middlewares/storeIsolation.js`
  - `pos-backend/middlewares/checkPermission.js`
  - `SECURITY.md`
