# ADR-0001: Multi-tenancy via Middleware de Isolamento de Loja

- Status: Accepted
- Date: 2026-05-01 (reconstituído da implementação — ver middlewares/storeIsolation.js)
- Decision owners: Arquiteto backend
- Related components: `middlewares/storeIsolation.js`, `middlewares/tokenVerification.js`, controllers em geral

## Context

O sistema é uma plataforma SaaS multi-tenant onde múltiplas lojas independentes compartilham a mesma instância de banco de dados MongoDB Atlas. É necessário garantir que nenhum usuário acesse dados de outra loja, mesmo em caso de omissão num controller individual.

## Decision

Implementar isolamento de store via middleware centralizado (`storeIsolation.js`) que:

1. Lê o `storeId` do token JWT do usuário (`req.user.store`).
2. Resolve o ObjectId correspondente no banco de dados.
3. Injeta `req.storeId` (string UUID) e `req.store` (ObjectId) na cadeia.
4. Provê helpers reutilizáveis: `getStoreFilter(req)` e `applyStoreToAggregation(pipeline, req)`.
5. Permite override por Master Admin quando `?storeId=` é passado como query param.

O middleware é inserido em cada rota após `isVerifiedUser`, antes de qualquer controller de negócio.

## Alternatives considered

1. **Banco separado por tenant** — descartado por custo operacional e complexidade de gerenciamento de conexões.
2. **Schema separado por tenant no mesmo MongoDB** — descartado por limitações do Mongoose com schemas dinâmicos.
3. **Filtro manual em cada controller** — descartado pois depende de disciplina individual e é propenso a falhas de omissão.

## Consequences

### Positive

- Isolamento centralizado — controllers que esqueçam de filtrar ainda têm `req.storeId` disponível.
- Helpers padronizados eliminam repetição de código.
- Master Admin pode inspecionar qualquer loja sem alterar código.

### Negative

- Nova rota que omita o middleware fica sem isolamento (evidenciado em `pdvRoutes.js`).
- Adiciona 1 query ao banco por request (busca do Store para resolver ObjectId).
- Nenhum mecanismo automático verifica omissão do middleware.

## Risks and mitigations

| Risco | Mitigação |
|---|---|
| Nova rota criada sem `storeIsolation` | Teste de integração cross-tenant obrigatório para todo novo grupo de rotas |
| Override de Master Admin mal validado | `storeIsolation.js` valida que o storeId é ObjectId válido antes de usar |
| Middleware removido por refatoração | Este ADR deve ser referenciado nos arquivos de rota relevantes |

## Validation

- `req.storeId` sempre definido nos controllers após a cadeia de middlewares.
- Teste: usuário de Loja A não lê pedidos da Loja B.
- Pendente: `pdvRoutes.js` precisa incluir `storeIsolation` (lacuna confirmada).

## Supersedes

Nenhum.

## Superseded by

Nenhum.
