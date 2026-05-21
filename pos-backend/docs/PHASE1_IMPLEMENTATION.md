# Fase 1: Multi-tenancy, Roles & Device Approval

## Visão Geral

A Fase 1 estabeleceu a fundação do sistema SaaS multi-loja para gestão de Food Service (POS), implementando:

1. **Multi-tenancy** com isolamento por `storeId` (UUID v4)
2. **Sistema de Roles** com permissões dinâmicas
3. **Device Approval** com nicknames para controle de acesso
4. **Session Logging** para auditoria de dispositivos

---

## Arquitetura Multi-tenancy

### Padrão de Isolamento

Cada loja opera em seu próprio namespace de dados. O isolamento é aplicado em todas as camadas:

```javascript
// Controller pattern - aplicar store isolation
const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

// Model query - filtrar por loja
const data = await Model.find({ store: storeRef });
```

### Store ID

- **Formato**: UUID v4
- **Armazenamento**: Campo `store` em todos os modelos
- **Validação**: Middleware de autenticação extrai do token JWT

---

## Sistema de Roles

### Hierarquia de Roles

| Role | Escopo | Permissões |
|------|--------|------------|
| `master_admin` | Global | Acesso total a todas as lojas |
| `admin` | Loja | Gestão completa da loja |
| `manager` | Loja | Operações diárias, sem gestão de usuários |
| `cashier` | Loja | Operações de caixa/pedido |
| `kitchen` | Loja | Visualização de pedidos |

### Matriz de Permissões

```javascript
// middlewares/permissions.js
const permissions = {
    master_admin: ['*'],
    admin: ['users:*', 'products:*', 'orders:*', 'stock:*'],
    manager: ['orders:*', 'stock:*', 'products:view'],
    cashier: ['orders:create', 'orders:view'],
    kitchen: ['orders:view']
};
```

### Middleware de Permissão

```javascript
const requirePermissions = (...required) => {
    return (req, res, next) => {
        const userPermissions = getUserPermissions(req.user);

        if (required.some(p => !userPermissions.includes(p))) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};
```

---

## Device Approval System

### Fluxo de Registro

1. **Primeiro Acesso**: Dispositivo é registrado como `isApproved: false`
2. **Pending List**: Aparece na lista de dispositivos pendentes
3. **Aprovação**: Admin aprova e atribui nickname
4. **Acesso Concedido**: Dispositivo pode operar normalmente

### Modelo de Dados

```javascript
// models/deviceModel.js
const deviceSchema = {
    user: ObjectId,           // Dono do dispositivo
    store: ObjectId,          // Loja associada
    deviceFingerprint: String, // Identificador único
    nickname: String,         // Nome amigável (pós-aprovação)
    isApproved: Boolean,      // Status de aprovação
    isCurrent: Boolean,       // Dispositivo ativo atual
    lastActiveAt: Date,       // Última atividade
    approvedBy: ObjectId,     // Quem aprovou
    revokedAt: Date,          // Se revogado
    revokedReason: String     // Motivo da revogação
};
```

### Endpoints

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | `/api/devices` | Listar dispositivos | Admin |
| GET | `/api/devices/pending` | Pendentes de aprovação | Admin |
| GET | `/api/devices/my` | Meus dispositivos | User |
| POST | `/api/devices/:id/approve` | Aprovar dispositivo | Admin |
| POST | `/api/devices/:id/revoke` | Revogar acesso | Admin |
| PUT | `/api/devices/:id/current` | Marcar como atual | User |
| PUT | `/api/devices/:id/nickname` | Atualizar nickname | User/Admin |

---

## Session Logging

### Propósito

Auditoria completa de todas as ações de dispositivos para:
- Rastrear atividades suspeitas
- Debug de problemas
- Compliance e segurança

### Modelo

```javascript
// models/sessionLogModel.js
const sessionLogSchema = {
    user: ObjectId,        // Usuário da ação
    store: ObjectId,       // Loja onde ocorreu
    device: ObjectId,      // Dispositivo usado
    action: String,        // Tipo de ação
    metadata: Object,      // Dados adicionais
    timestamp: Date        // Quando ocorreu
};
```

### Ações Logadas

- `device_registered` - Novo dispositivo
- `device_approved` - Dispositivo aprovado
- `device_revoked` - Acesso revogado
- `device_set_current` - Dispositivo marcado como atual
- `login` / `logout` - Sessões de usuário

---

## Arquivos Criados/Modificados

### Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `models/deviceModel.js` | Schema de dispositivos |
| `models/sessionLogModel.js` | Schema de logs de sessão |
| `middlewares/permissions.js` | Sistema de permissões |
| `controllers/deviceController.js` | CRUD de dispositivos |
| `controllers/sessionLogController.js` | Consulta de logs |
| `routes/deviceRoutes.js` | Rotas de dispositivos |
| `routes/sessionLogRoutes.js` | Rotas de logs |

### Arquivos Modificados

| Arquivo | Modificação |
|---------|-------------|
| `models/userModel.js` | Adicionado `currentDevice`, `lastDevice` |
| `middlewares/authMiddleware.js` | Integração com device tracking |
| `app.js` | Registro de novas rotas |

---

## Implementação do Controller

### Aprovação de Dispositivo

```javascript
const approveDevice = async (req, res, next) => {
    try {
        const { id } = req.params;
        const device = await Device.findById(id);

        // Verificar existência
        if (!device) {
            throw createHttpError(404, "Device not found!");
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && device.store.toString() !== req.user.store.toString()) {
            throw createHttpError(403, "Not authorized to approve devices from this store!");
        }

        // Verificar nickname
        if (!device.nickname || device.nickname.trim() === '') {
            throw createHttpError(400, "Device must have a nickname before approval!");
        }

        // Aprovar
        device.isApproved = true;
        device.approvedBy = req.user._id;
        device.approvedAt = new Date();
        device.revokedAt = null;
        device.revokedReason = null;
        await device.save();

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: req.user.store,
            device: device._id,
            action: 'device_approved',
            metadata: { deviceNickname: device.nickname }
        });

        res.status(200).json({
            success: true,
            message: "Device approved successfully!",
            data: device
        });
    } catch (error) {
        next(error);
    }
};
```

---

## Padrões de Código

### Store Isolation em Controllers

```javascript
// Padrão consistente em todos os controllers
const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

// Em queries
const filter = { store: storeRef, ...otherFilters };

// Em criação
await Model.create({
    store: storeRef,
    ...otherData
});
```

### Validação de Permissão

```javascript
// Verificar se recurso pertence à loja do usuário
if (!req.user.isMasterAdmin && resource.store.toString() !== req.user.store.toString()) {
    throw createHttpError(403, "Access denied: Resource belongs to different store!");
}
```

### Resposta Padrão

```javascript
// Sucesso
res.status(200).json({
    success: true,
    message: "Operation completed successfully!",
    data: result
});

// Erro
next(createHttpError(400, "Specific error message!"));
```

---

## Scripts de Migração

### Criar Stores Iniciais

```bash
# Script: scripts/create-stores.js
node scripts/create-stores.js
```

Cria 3 lojas de exemplo:
- Matrix Food Service (CNPJ: 00.000.000/0001-00)
- Burguer Tech (CNPJ: 11.111.111/0001-11)
- Pizza Data (CNPJ: 22.222.222/0001-22)

### Criar Usuários de Teste

```bash
# Script: scripts/create-users.js
node scripts/create-users.js
```

Cria usuários para cada role em cada loja.

---

## Testes

### Testar Device Approval

```bash
# 1. Login como admin
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@matrix.com","password":"admin123"}'

# 2. Listar dispositivos pendentes
curl http://localhost:8000/api/devices/pending \
  -H "Authorization: Bearer <token>"

# 3. Aprovar dispositivo
curl -X POST http://localhost:8000/api/devices/<id>/approve \
  -H "Authorization: Bearer <token>"
```

### Testar Session Logs

```bash
# Listar logs das últimas 24 horas
curl "http://localhost:8000/api/session-logs?hours=24" \
  -H "Authorization: Bearer <token>"
```

---

## Troubleshooting

### Problema: Dispositivo não aparece na lista pendente

**Causa**: Filtro de loja incorreto

**Solução**: Verificar se `req.user.store` corresponde à loja do dispositivo

### Problema: Erro 403 ao aprovar

**Causa**: Usuário não tem permissão de admin na loja

**Solução**: Usar conta master_admin ou admin da loja correta

### Problema: Logs não são criados

**Causa**: SessionLog não está sendo chamado

**Solução**: Verificar imports e chamadas em cada controller

---

## Próximos Passos (Fase 2)

Após completar a Fase 1, a base está pronta para:

1. **Ingredientes Globais** - Catálogo unificado de ingredientes
2. **Fichas Técnicas** - Recipe engineering com custo
3. **Menu Builder** - Construção de cardápios com variações
4. **Stock Management** - Controle de estoque por loja

---

## Referências

- [MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md) - Guia de migração de dados
- [PHASE1_SUMMARY.md](../PHASE1_SUMMARY.md) - Resumo original da Fase 1
- [PHASE1_FINAL_SUMMARY.md](../PHASE1_FINAL_SUMMARY.md) - Summary final expandido
