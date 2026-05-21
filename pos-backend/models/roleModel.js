const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

/**
 * Role Model - Sistema de Permissões Dinâmicas
 *
 * Permite criar roles customizadas com permissões específicas por módulo.
 * Cada loja pode ter seus próprios roles ou usar roles globais.
 */
const roleSchema = new mongoose.Schema({
    roleId: {
        type: String,
        default: uuidv4,
        unique: true,
        index: true,
        immutable: true
    },
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        index: true,
        // null = role global do sistema
        default: null
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: String,
    // Permissões estruturadas por módulo
    permissions: {
        // Módulo de Pedidos
        orders: {
            create: { type: Boolean, default: false },
            read: { type: Boolean, default: false },
            update: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
            cancel: { type: Boolean, default: false }
        },
        // Módulo de Mesas
        tables: {
            create: { type: Boolean, default: false },
            read: { type: Boolean, default: false },
            update: { type: Boolean, default: false },
            delete: { type: Boolean, default: false }
        },
        // Módulo de Produtos
        products: {
            create: { type: Boolean, default: false },
            read: { type: Boolean, default: false },
            update: { type: Boolean, default: false },
            delete: { type: Boolean, default: false }
        },
        // Módulo de Estoque
        inventory: {
            create: { type: Boolean, default: false },
            read: { type: Boolean, default: false },
            update: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
            adjust: { type: Boolean, default: false },
            transfer: { type: Boolean, default: false }
        },
        // Módulo de Pagamentos
        payments: {
            create: { type: Boolean, default: false },
            read: { type: Boolean, default: false },
            refund: { type: Boolean, default: false }
        },
        // Módulo de Usuários (apenas admin)
        users: {
            create: { type: Boolean, default: false },
            read: { type: Boolean, default: false },
            update: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
            manageRoles: { type: Boolean, default: false }
        },
        // Módulo de Dispositivos
        devices: {
            read: { type: Boolean, default: false },
            approve: { type: Boolean, default: false },
            revoke: { type: Boolean, default: false }
        },
        // Módulo de Relatórios
        reports: {
            read: { type: Boolean, default: false },
            export: { type: Boolean, default: false },
            financial: { type: Boolean, default: false }
        },
        // Configurações da Loja
        settings: {
            read: { type: Boolean, default: false },
            update: { type: Boolean, default: false }
        }
    },
    // Permissões customizadas (wildcard)
    customPermissions: [{
        module: String,
        actions: [String]  // ex: ['create', 'read', '*']
    }],
    isSystem: {
        type: Boolean,
        default: false  // Roles do sistema não podem ser deletadas
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Índices compostos para performance
roleSchema.index({ store: 1, name: 1 }, { unique: true });
roleSchema.index({ 'permissions.orders.read': 1 });
roleSchema.index({ 'permissions.products.read': 1 });

// Método para verificar permissão específica
roleSchema.methods.hasPermission = function(module, action) {
    // Verificar permissões padrão
    if (this.permissions[module] && this.permissions[module][action]) {
        return true;
    }

    // Verificar permissões customizadas
    const customPerm = this.customPermissions.find(p => p.module === module);
    if (customPerm) {
        return customPerm.actions.includes(action) || customPerm.actions.includes('*');
    }

    return false;
};

// Método para verificar múltiplas permissões
roleSchema.methods.hasAnyPermission = function(module, actions) {
    return actions.some(action => this.hasPermission(module, action));
};

// Método para verificar todas as permissões
roleSchema.methods.hasAllPermissions = function(module, actions) {
    return actions.every(action => this.hasPermission(module, action));
};

module.exports = mongoose.model("Role", roleSchema);
