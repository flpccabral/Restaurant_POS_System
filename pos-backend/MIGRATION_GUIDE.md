# 🔄 Guia de Migração - Single para Multi-Loja

## Visão Geral

Este guia descreve como migrar dados existentes para a nova arquitetura multi-tenant.

---

## ⚠️ Importante

**Antes de migrar:**
1. Faça backup completo do banco de dados
2. Teste em ambiente de desenvolvimento
3. Agende downtime se estiver em produção

---

## Passo 1: Criar Loja Principal

Todos os usuários e dados existentes devem ser vinculados a uma loja.

```javascript
// Script: scripts/migrate-create-store.js
const Store = require('../models/storeModel');

const createMainStore = async () => {
    const store = await Store.create({
        name: 'Loja Principal',
        cnpj: 'MIGRATED-001',
        email: 'contato@empresa.com.br',
        phone: '(XX) XXXXX-XXXX',
        subscriptionPlan: 'enterprise',
        settings: {
            taxRate: 5.25,
            currency: 'BRL',
            timezone: 'America/Sao_Paulo'
        }
    });
    return store._id;
};
```

---

## Passo 2: Migrar Usuários

Adicionar `storeId` e `isMasterAdmin` aos usuários existentes.

```javascript
// Script: scripts/migrate-users.js
const User = require('../models/userModel');

const migrateUsers = async (storeId) => {
    // Tornar primeiro usuário como Master Admin
    const users = await User.find();

    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        user.store = storeId;
        user.isMasterAdmin = (i === 0); // Primeiro usuário é admin
        user.role = user.role || 'Admin';
        await user.save();
    }

    console.log(`✅ Migrated ${users.length} users`);
};
```

---

## Passo 3: Migrar Pedidos (Orders)

```javascript
// Script: scripts/migrate-orders.js
const Order = require('../models/orderModel');

const migrateOrders = async (storeId) => {
    const result = await Order.updateMany(
        { storeId: { $exists: false } },
        { $set: { storeId } }
    );

    console.log(`✅ Updated ${result.modifiedCount} orders`);
};
```

---

## Passo 4: Migrar Mesas (Tables)

```javascript
// Script: scripts/migrate-tables.js
const Table = require('../models/tableModel');

const migrateTables = async (storeId) => {
    const result = await Table.updateMany(
        { storeId: { $exists: false } },
        { $set: { storeId } }
    );

    console.log(`✅ Updated ${result.modifiedCount} tables`);
};
```

---

## Passo 5: Migrar Pagamentos

```javascript
// Script: scripts/migrate-payments.js
const Payment = require('../models/paymentModel');

const migratePayments = async (storeId) => {
    const result = await Payment.updateMany(
        { storeId: { $exists: false } },
        { $set: { storeId } }
    );

    console.log(`✅ Updated ${result.modifiedCount} payments`);
};
```

---

## Script de Migração Completo

Crie o arquivo `scripts/migrate-all.js`:

```javascript
require('dotenv').config();
const mongoose = require('mongoose');
const Store = require('../models/storeModel');
const User = require('../models/userModel');
const Order = require('../models/orderModel');
const Table = require('../models/tableModel');
const Payment = require('../models/paymentModel');

const migrateAll = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB Connected');

        // 1. Criar loja
        console.log('\n📦 Creating main store...');
        const store = await Store.create({
            name: 'Loja Principal',
            cnpj: 'MIGRATED-' + Date.now(),
            email: 'contato@empresa.com.br',
            phone: '(11) 99999-9999',
            subscriptionPlan: 'enterprise',
            settings: {
                taxRate: 5.25,
                currency: 'BRL',
                timezone: 'America/Sao_Paulo'
            }
        });
        console.log('✅ Store created:', store._id);

        // 2. Migrar usuários
        console.log('\n👤 Migrating users...');
        const users = await User.find();
        for (let i = 0; i < users.length; i++) {
            users[i].store = store._id;
            users[i].isMasterAdmin = (i === 0);
            users[i].role = users[i].role || 'Admin';
            await users[i].save();
        }
        console.log(`✅ Migrated ${users.length} users`);

        // 3. Migrar orders
        console.log('\n📋 Migrating orders...');
        const orderResult = await Order.updateMany(
            { storeId: { $exists: false } },
            { $set: { storeId: store._id } }
        );
        console.log(`✅ Updated ${orderResult.modifiedCount} orders`);

        // 4. Migrar tables
        console.log('\n🪑 Migrating tables...');
        const tableResult = await Table.updateMany(
            { storeId: { $exists: false } },
            { $set: { storeId: store._id } }
        );
        console.log(`✅ Updated ${tableResult.modifiedCount} tables`);

        // 5. Migrar payments
        console.log('\n💳 Migrating payments...');
        const paymentResult = await Payment.updateMany(
            { storeId: { $exists: false } },
            { $set: { storeId: store._id } }
        );
        console.log(`✅ Updated ${paymentResult.modifiedCount} payments`);

        console.log('\n' + '='.repeat(50));
        console.log('🎉 MIGRATION COMPLETED');
        console.log('='.repeat(50));
        console.log(`\nStore ID: ${store._id}`);
        console.log(`First user (admin@pos.com) is now Master Admin`);
        console.log('\n✅ You can now start the server!\n');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
};

migrateAll();
```

---

## Executando a Migração

```bash
# 1. Backup (CRUCIAL!)
mongodump --uri="mongodb://localhost:27017/pos-db" --out=./backup

# 2. Teste em dev
npm run migrate

# 3. Verifique os dados
mongo
use pos-db
db.users.findOne()  # Deve ter storeId e isMasterAdmin
```

---

## Pós-Migração

### 1. Validar Dados
```javascript
// Verificar se todos usuários têm storeId
db.users.countDocuments({ storeId: { $exists: false } })
// Deve retornar 0

// Verificar se existe Master Admin
db.users.countDocuments({ isMasterAdmin: true })
// Deve retornar pelo menos 1
```

### 2. Testar Login
```bash
# Login com primeiro usuário (agora Master Admin)
curl -X POST http://localhost:8000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email": "SEU_EMAIL", "password": "SUA_SENHA"}'
```

### 3. Aprovar Dispositivos
O primeiro login de cada usuário registrará o dispositivo como pendente.
O Master Admin deve aprovar:

```bash
# Listar pendentes
curl http://localhost:8000/api/device/pending \
  -H "Cookie: accessToken=ADMIN_TOKEN"

# Aprovar
curl -X POST http://localhost:8000/api/device/:id/approve \
  -H "Cookie: accessToken=ADMIN_TOKEN"
```

---

## Rollback (Se Necessário)

```javascript
// Script: scripts/rollback-migration.js
const rollback = async () => {
    await User.updateMany({}, {
        $unset: {
            store: "",
            isMasterAdmin: "",
            lastLoginAt: "",
            lastDevice: ""
        }
    });

    await Order.updateMany({}, { $unset: { storeId: "" } });
    await Table.updateMany({}, { $unset: { storeId: "" } });
    await Payment.updateMany({}, { $unset: { storeId: "" } });

    await Store.deleteMany({ cnpj: /MIGRATED/ });

    console.log('✅ Rollback completed');
};
```

---

## Comandos Úteis

```bash
# Contar documentos por coleção
db.users.countDocuments()
db.orders.countDocuments()
db.tables.countDocuments()

# Verificar documentos sem storeId
db.orders.countDocuments({ storeId: { $exists: false } })

# Listar stores
db.stores.find({}, { name: 1, cnpj: 1 })
```

---

*Guia criado em: 2026-05-20*
