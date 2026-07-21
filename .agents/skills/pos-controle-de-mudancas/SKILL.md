---
name: pos-controle-de-mudancas
description: >-
  Use quando for fazer qualquer modificação de código no Restaurant POS System:
  nova rota, novo model, novo middleware, alteração de schema, nova permissão,
  mudança de enum, nova migração de dados, refatoração de controller ou service.
  Esta skill define as regras inegociáveis de mudança e a ordem correta de
  operações para não quebrar multi-tenancy, isolamento de loja ou integridade de estoque.
  Carregue antes de qualquer outra skill quando o trabalho envolve escrever código.
---

# Controle de Mudanças — Restaurant POS System

## Quando usar

- Adicionar qualquer endpoint novo (REST ou WebSocket)
- Criar ou modificar um Mongoose model
- Adicionar ou alterar um middleware na cadeia de requisições
- Modificar enums em qualquer model
- Criar script de migração de dados
- Alterar lógica de permissão ou autorização
- Refatorar controllers ou services que tocam estoque

## Quando não usar

- Apenas lendo código para entender comportamento existente
- Executando testes sem alterar código

---

## Regras inegociáveis

### R1 — Toda nova rota que acessa dados de loja DEVE incluir `storeIsolation`

```
// Ordem obrigatória na cadeia de middlewares:
router.get('/rota', isVerifiedUser, storeIsolation, checkPermission('modulo', 'acao'), controller);
```

**Por quê:** `storeIsolation.js` injeta `req.storeId` e `req.store`. Sem ele, controllers ficam sem isolamento de loja — qualquer usuário pode acessar dados de outra loja. Evidência da falha: `pdvRoutes.js` não inclui `storeIsolation` (lacuna de segurança conhecida — P0-03).

**Verificar omissão:**
```bash
grep -L "storeIsolation" pos-backend/routes/*.js
# Deve listar apenas rotas que legitimamente não acessam dados de loja (ex: paymentRoute.js)
```

### R2 — Toda operação que deduze ou reverte estoque DEVE usar MongoDB session

```javascript
const session = await mongoose.startSession();
session.startTransaction();
try {
  // ... operações de estoque
  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
  throw err;
} finally {
  session.endSession();
}
```

**Por quê:** MongoDB sem session não garante atomicidade. Saldo de estoque inconsistente gera CMV errado e dados financeiros incorretos. Ver ADR-0002.

**Requisito de ambiente:** MongoDB em modo Replica Set. MongoDB Atlas M0+ já inclui RS. `mongod` local precisa de `--replSet rs0`.

### R3 — Auditoria de ações operacionais deve usar fire-and-forget

```javascript
// CORRETO — falha de auditoria não bloqueia a operação
await auditService.logAudit({...}).catch(() => {});

// ERRADO — pode bloquear operação crítica
await auditService.logAudit({...}); // sem catch
```

**Por quê:** `auditService.js` já captura internamente, mas o padrão deve ser mantido em novos usos. Ver ADR-0005.

### R4 — Novos campos enum devem ser verificados contra todos os modelos que os referenciam

Antes de adicionar um valor de enum, verificar:
```bash
grep -rn "o-enum-existente" pos-backend/models/ --include="*.js"
# Confirmar consistência entre todos os modelos que usam o mesmo conceito
```

**Contexto:** `subscriptionModel.status` tem tanto `'cancelled'` quanto `'canceled'` (bug de inconsistência conhecido). Não repetir este padrão.

### R5 — Campo `role` em userModel é `Mixed` — tratar com cuidado

O campo `role` em `userModel.js` aceita ObjectId (novo) e String (legacy). Todo código novo deve:
1. Sempre usar ObjectId — nunca criar usuário com role string
2. Verificar `typeof req.user.role === 'string'` antes de assumir que é ObjectId
3. Não remover o suporte a string até que a migração P2-01 seja concluída

**Verificar usuários com role string:**
```bash
# No mongosh
db.users.countDocuments({ role: { $type: 'string' } })
```

---

## Checklist antes de qualquer commit

- [ ] A nova rota inclui `storeIsolation` se acessa dados de loja?
- [ ] A operação de estoque usa MongoDB session?
- [ ] O enum novo é consistente com todos os modelos que referenciam o mesmo conceito?
- [ ] Existe pelo menos 1 teste cobrindo: sucesso, 401 (não autenticado), 403 (sem permissão)?
- [ ] `bash pos-backend/scripts/verify.sh` passa sem falhas bloqueantes?
- [ ] `npm test` passa sem regressão?
- [ ] Credenciais reais estão ausentes do código?

---

## Procedimento para novo endpoint

1. Criar ou adicionar função no controller existente (`controllers/<dominio>Controller.js`)
2. Registrar na rota (`routes/<dominio>Route.js`) com a cadeia correta
3. Se a rota acessa dados de loja: incluir `storeIsolation` após `isVerifiedUser`
4. Se requer permissão granular: incluir `checkPermission('modulo', 'acao')`
5. Se a rota acessa dados globais (admin apenas): verificar `req.user.isMasterAdmin`
6. Registrar em `app.js` se for um grupo novo de rotas
7. Criar teste em `tests/<dominio>.test.js`
8. Executar `npm test`

## Procedimento para novo campo em model existente

1. Adicionar o campo no schema com `default` e `required` adequados
2. Se o campo é obrigatório e o model tem dados existentes: criar script de migração
3. Script de migração em `scripts/migrate-<descricao>.js` com suporte a `--dry-run`
4. Testar com `--dry-run` antes de executar em produção
5. Executar migração: `npm run db:migrate`
6. Documentar no `CHANGELOG.md`

## Procedimento para novo model

1. Criar `models/<Nome>Model.js`
2. Incluir `{ v4: uuidv4 }` de `uuid` para IDs legíveis
3. Incluir campo `store` com `index: true` se o model é escopado por loja
4. Incluir `{ timestamps: true }` no schema
5. Criar índices compostos para as queries mais comuns
6. Criar seed data em `scripts/seed.js` se necessário

---

## Critérios de aceitação

- `npm test` passa com cobertura das novas funcionalidades
- `bash pos-backend/scripts/verify.sh` retorna saída verde
- Nenhuma referência a segredos no código commitado
- Toda nova rota com dados de loja inclui `storeIsolation`
- Toda operação de estoque usa MongoDB session

## Skills relacionadas

- `pos-contrato-de-arquitetura` — decisões de design por trás dessas regras
- `pos-seguranca` — regras de autenticação e autorização
- `pos-estoque-e-checkout` — como implementar operações de estoque
- `pos-validacao-e-qa` — como executar testes e validar mudanças

## Proveniência e manutenção

- Verificado em: 2026-07-20
- Fontes primárias:
  - `pos-backend/middlewares/storeIsolation.js`
  - `pos-backend/routes/pdvRoutes.js` (evidência de falha de omissão)
  - `pos-backend/services/orderCheckoutService.js` (modelo de transação)
  - `pos-backend/docs/adr/ADR-0001-multitenancy-middleware-store-isolation.md`
  - `pos-backend/docs/adr/ADR-0002-mongodb-transactions-stock-deduction.md`
- Comandos de reverificação:
  - `grep -L "storeIsolation" pos-backend/routes/*.js`
  - `grep -rn "startSession\|startTransaction" pos-backend/services/ --include="*.js"`
- Condições que exigem revisão:
  - Mudança na assinatura de `storeIsolation.js`
  - Adição de novo grupo de rotas em `app.js`
  - Conclusão da migração P2-01 (normalização de role)
