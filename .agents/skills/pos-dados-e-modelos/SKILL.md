---
name: pos-dados-e-modelos
description: >-
  Use quando precisar entender a estrutura dos 28 Mongoose models, padrões de indexação,
  padrões de IDs imutáveis (UUID v4), relacionamentos entre entidades, migrações de dados
  e scripts de seed do Restaurant POS System.
---

# Dados e Modelos — Restaurant POS System

## Quando usar

- Criar ou alterar Schemas Mongoose em `pos-backend/models/`
- Adicionar ou otimizar índices no MongoDB
- Criar scripts de migração de banco de dados (`scripts/migrate-*.js`)
- Entender os relacionamentos entre coleções do sistema
- Executar rotinas de limpeza ou seed de banco de dados

## Quando não usar

- Alterar regras de validação de rotas da API (→ `pos-controle-de-mudancas`)
- Depurar erros de infraestrutura do MongoDB (→ `pos-build-e-ambiente`)

---

## Convenções de Mongoose Schemas

### 1. Padrão de Identificadores (UUID v4)

Todo modelo principal deve definir um identificador único de negócio do tipo String imutável usando UUID v4:

```javascript
storeId: {
    type: String,
    default: uuidv4,
    unique: true,
    index: true,
    immutable: true
}
```

### 2. Escopo Multi-Tenant (`store`)

Modelos associados a uma loja específica devem conter a referência ObjectId para `Store`:

```javascript
store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true
}
```

### 3. Timestamps

Todos os Schemas devem habilitar a opção `{ timestamps: true }` para rastreamento automático de `createdAt` e `updatedAt`.

---

## Inventário dos Principais Modelos (28 no total)

| Modelo | Finalidade Principal | Chave Principal / Índices Notáveis |
|---|---|---|
| `storeModel.js` | Dados da Loja/Tenant | `storeId` (UUID), `cnpj` |
| `userModel.js` | Usuários da Plataforma | `userId` (UUID), `email`, `role` (Mixed) |
| `roleModel.js` | Roles e Permissões Granulares | `roleId` (UUID), `name`, `store` |
| `orderModel.js` | Pedidos e Metadados | `orderId` (UUID), `store`, `status` |
| `productModel.js` | Produtos e Tipos de Impacto | `productId` (UUID), `store`, `category` |
| `stockMovementModel.js` | Registro de Movimentação de Estoque | `movementId` (UUID), `store`, `type` |
| `stockBalanceModel.js` | Saldo Atual por Insumo/Local | `store`, `ingredient`, `location` (composto único) |
| `cashSessionModel.js` | Sessão de Caixa do PDV | `sessionId` (UUID), `cashier`, `store` |
| `operationalAuditLogModel.js` | Logs de Auditoria Operacional | `logId` (UUID), `store`, `actionType` |

---

## Scripts de Dados Disponíveis (`pos-backend/scripts/`)

- `seed.js`: Popula o banco com dados iniciais para ambiente de dev (1 loja, roles, usuários, ingredientes).
- `pilot-seed.js`: Popula 5 lojas para execução de piloto controlado.
- `migration-cleanup.js`: Executa limpeza e higienização do banco.
- `migrate-all.js`: Executa scripts de migração sequenciais.
- `migration-store-isolation.js`: Migra documentos antigos para garantir a presença do campo `store`.

---

## Skills Relacionadas

- `pos-estoque-e-checkout` — como os modelos de estoque interagem em transações
- `pos-controle-de-mudancas` — regras para alteração de Schemas e migrações

## Proveniência e Manutenção

- Verificado em: 2026-07-20
- Fontes primárias:
  - `pos-backend/models/*.js`
  - `pos-backend/scripts/`
  - `PHASE1_FINAL_SUMMARY.md`
