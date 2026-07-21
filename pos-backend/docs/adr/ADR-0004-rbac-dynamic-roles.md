# ADR-0004: RBAC com Roles Dinâmicas por ObjectId (com Compatibilidade Legacy String)

- Status: Accepted (migração pendente)
- Date: 2026-05-01 (reconstituído — ver models/roleModel.js, middlewares/checkPermission.js)
- Decision owners: Arquiteto backend
- Related components: `models/roleModel.js`, `models/userModel.js`, `middlewares/checkPermission.js`, `controllers/userController.js`

## Context

O sistema precisa de controle de acesso granular por módulo (orders, tables, products, inventory, payments, users, devices, reports, kds, production, subscription). Roles fixas hardcoded não permitem customização por loja. O sistema foi inicialmente desenvolvido com roles como strings simples ('Admin', 'Garçom'), o que precisou ser evoluído para um modelo dinâmico.

## Decision

Implementar RBAC com roles como documentos MongoDB (`roleModel.js`), onde cada role contém permissões estruturadas por módulo (create, read, update, delete) e `customPermissions` para permissões adicionais. O campo `role` no `userModel.js` aceita tanto `ObjectId` (novo) quanto `String` (legacy) via `Mixed` type para compatibilidade durante a migração.

O middleware `checkPermission(module, action)` suporta ambos os formatos:
- ObjectId: busca a Role no banco, verifica `hasPermission(module, action)`.
- String legacy: verifica permissões hardcoded para strings como 'Admin', 'Gerente'.

**NOTA: Esta é uma decisão transitória.** O campo Mixed e o suporte a string devem ser removidos após migração completa de todos os usuários para ObjectId. Ver pendência em `userModel.js`.

## Alternatives considered

1. **Roles fixas com enum** — descartado por impossibilidade de customização por loja sem redeploy.
2. **ABAC (Attribute-Based Access Control)** — descartado por complexidade excessiva para o estágio atual.
3. **Middleware de role simples (checkRole)** — existe como solução legada e ainda é usado em pdvRoutes.js. Não fornece granularidade por ação.

## Consequences

### Positive

- Roles configuráveis por loja sem redeploy.
- Granularidade por módulo e ação.
- Histórico de versão de permissões via `updatedAt`.

### Negative

- Campo `role: Mixed` cria risco de bugs e bypass de permissão pelo caminho legacy.
- 1 query adicional ao banco por request para carregar a Role.
- Módulos novos (kds, production, subscription) não têm slot estruturado no schema — dependem de `customPermissions`.

## Risks and mitigations

| Risco | Mitigação |
|---|---|
| Usuário com role string 'Admin' bypassa verificação de módulo | Remover o caminho legacy após migração; cobrir com testes |
| Módulo novo sem entrada no roleModel | Adicionar campo ao schema antes de aplicar `checkPermission` no novo módulo |
| Migração incompleta deixa usuários sem acesso | Executar script de migração com `--dry-run` antes do deploy real |

## Validation

- Usuário com role ObjectId sem permissão `orders.create` recebe 403 ao tentar criar pedido.
- Usuário com role ObjectId com permissão `orders.create` recebe 201 ao criar pedido.
- Usuário Master Admin tem acesso total independente de role.
- Após migração: campo `role` de todos os usuários é ObjectId válido.

## Supersedes

Roles simples via string ('Admin', 'Garçom') no `userModel.js`.

## Superseded by

Nenhum (a ser atualizado após remoção do suporte a string legacy).
