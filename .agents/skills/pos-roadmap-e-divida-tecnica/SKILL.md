---
name: pos-roadmap-e-divida-tecnica
description: >-
  Use quando precisar priorizar tarefas de desenvolvimento, entender os itens P0, P1, P2 e P3
  do roadmap técnico, identificar débitos técnicos acumulados, consultar os planos de 30-60-90 dias
  ou verificar quais refatorações NÃO devem ser feitas no estágio atual do produto.
---

# Roadmap e Dívida Técnica — Restaurant POS System

## Quando usar

- Decidir qual tarefa implementar a seguir no projeto
- Consultar a priorização oficial de segurança e infraestrutura (P0 a P3)
- Verificar refatorações proibidas no momento (o que NÃO fazer agora)
- Entender a dívida técnica acumulada do sistema e seus riscos

## Quando não usar

- Implementação direta de código ou correções pontuais de bugs

---

## Matriz de Priorização (Roadmap P0-P3)

### Prioridade P0 — Bloqueadores Críticos de Segurança (0 a 14 dias)

- **P0-01:** Rotacionar credenciais do MongoDB Atlas e JWT_SECRET expostas no `.env`.
- **P0-02:** Adicionar rate limiting em `/api/user/login` e `/api/user/register`.
- **P0-03:** Aplicar o middleware `storeIsolation` nas rotas do PDV (`pdvRoutes.js`).
- **P0-04:** Adicionar autenticação de handshake no Socket.io.

### Prioridade P1 — Estabilidade e Infraestrutura Essencial (15 a 30 dias)

- **P1-01:** Restringir o endpoint `/api/subscription/seed` para uso exclusivo por Master Admin.
- **P1-02:** Expandir a suíte de testes de integração no CI (mínimo 5 fluxos principais).
- **P1-03:** Adicionar middleware `helmet` e cabeçalhos de segurança HTTP.
- **P1-04:** Implementar endpoint `/health` e logging estruturado com `pino`.
- **P1-05:** Substituir gateway Razorpay (INR) por gateway compatível com BRL.

### Prioridade P2 — Qualidade e Normalização (31 a 60 dias)

- **P2-01:** Normalizar o campo `role` de `userModel` de `Mixed` para `ObjectId` obrigatório.
- **P2-02:** Implementar paginação server-side em todas as listagens de controllers.

### Prioridade P3 — Evolução da Experiência e Validação (61 a 90 dias)

- **P3-01:** Integrar `socket.io-client` no `pos-admin` para atualização em tempo real.
- **P3-02:** Adicionar validação de payload de requisições com Zod nos controllers.

---

## O Que NÃO Fazer Agora (Evitar Desperdício de Esforço)

1. **Microserviços:** Manter o monólito Express. Não fragmentar o backend.
2. **Kubernetes:** Manter Docker Compose ou PM2. Sem orquestração complexa.
3. **Reescrita Total:** Não reescrever o código funcional do backend ou frontend.
4. **Stripe Integration:** Não implementar Stripe enquanto não houver demandas reais de cobrança ativa SaaS.
5. **iFood Scraper:** Não tentar integrar o módulo `ifood-scraper/` ao fluxo core do POS neste estágio.

---

## Skills Relacionadas

- `pos-controle-de-mudancas` — regras de alteração de código
- `pos-seguranca` — contexto dos itens de prioridade P0

## Proveniência e Manutenção

- Verificado em: 2026-07-20
- Fontes primárias:
  - `revisao-estrategica-cto-restaurant-pos.md`
  - `AUDITORIA.md`
