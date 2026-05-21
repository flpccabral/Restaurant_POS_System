const createHttpError = require("http-errors");
const Role = require("../models/roleModel");
const User = require("../models/userModel");

/**
 * Criar nova role
 * Apenas Master Admin ou usuários com permissão manageRoles podem criar
 */
const createRole = async (req, res, next) => {
    try {
        const {
            name,
            description,
            permissions,
            customPermissions,
            isSystem
        } = req.body;

        if (!name) {
            const error = createHttpError(400, "Role name is required!");
            return next(error);
        }

        // Verificar se role já existe na loja (ou global)
        const existingRole = await Role.findOne({
            store: req.storeId || null,
            name: new RegExp(`^${name}$`, 'i')  // Case insensitive exact match
        });

        if (existingRole) {
            const error = createHttpError(400, "Role with this name already exists!");
            return next(error);
        }

        // Se não for master admin, garantir que role seja da loja do usuário
        const store = req.user.isMasterAdmin ? (req.storeId || null) : req.user.store;

        const role = await Role.create({
            store,
            name,
            description,
            permissions: permissions || {},
            customPermissions: customPermissions || [],
            isSystem: isSystem || false
        });

        res.status(201).json({
            success: true,
            message: "Role created successfully!",
            data: role
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar roles
 */
const getRoles = async (req, res, next) => {
    try {
        const { isActive, includeGlobal } = req.query;
        const filter = {};

        // Se não for master admin, mostrar apenas roles da loja do usuário
        if (!req.user.isMasterAdmin) {
            filter.$or = [
                { store: req.user.store },
                { store: null }  // Incluir roles globais
            ];
        } else if (req.storeId) {
            // Master Admin filtrando por loja específica
            const storeFilter = req.storeId === 'global'
                ? { store: null }
                : { $or: [{ store: req.storeId }, { store: null }] };
            Object.assign(filter, storeFilter);
        }

        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        const roles = await Role.find(filter)
            .sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: roles.length,
            data: roles
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter role por ID
 */
const getRoleById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const role = await Role.findById(id);

        if (!role) {
            const error = createHttpError(404, "Role not found!");
            return next(error);
        }

        // Verificar permissão (não pode ver role de outra loja)
        if (!req.user.isMasterAdmin && role.store && role.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Not authorized to view this role!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            data: role
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar role
 */
const updateRole = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const role = await Role.findById(id);

        if (!role) {
            const error = createHttpError(404, "Role not found!");
            return next(error);
        }

        // Verificar permissão
        if (!req.user.isMasterAdmin && role.store && role.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Not authorized to update this role!");
            return next(error);
        }

        // Não permitir atualizar roles do sistema
        if (role.isSystem) {
            const error = createHttpError(403, "System roles cannot be modified!");
            return next(error);
        }

        // Remover campos imutáveis
        delete updateData.store;
        delete updateData.isSystem;

        const updatedRole = await Role.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "Role updated successfully!",
            data: updatedRole
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Ativar/Desativar role
 */
const toggleRoleStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        const role = await Role.findById(id);

        if (!role) {
            const error = createHttpError(404, "Role not found!");
            return next(error);
        }

        // Verificar permissão
        if (!req.user.isMasterAdmin && role.store && role.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Not authorized to update this role!");
            return next(error);
        }

        // Não permitir desativar roles do sistema
        if (role.isSystem) {
            const error = createHttpError(403, "System roles cannot be deactivated!");
            return next(error);
        }

        role.isActive = isActive;
        await role.save();

        res.status(200).json({
            success: true,
            message: `Role ${isActive ? 'activated' : 'deactivated'} successfully!`,
            data: role
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Deletar role
 */
const deleteRole = async (req, res, next) => {
    try {
        const { id } = req.params;

        const role = await Role.findById(id);

        if (!role) {
            const error = createHttpError(404, "Role not found!");
            return next(error);
        }

        // Verificar permissão
        if (!req.user.isMasterAdmin && role.store && role.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Not authorized to delete this role!");
            return next(error);
        }

        // Não permitir deletar roles do sistema
        if (role.isSystem) {
            const error = createHttpError(403, "System roles cannot be deleted!");
            return next(error);
        }

        // Verificar se há usuários com esta role
        const usersCount = await User.countDocuments({ role: id });
        if (usersCount > 0) {
            const error = createHttpError(
                400,
                `Cannot delete role: ${usersCount} user(s) still have this role.`
            );
            return next(error);
        }

        await Role.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: "Role deleted successfully!"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Duplicar role existente
 */
const duplicateRole = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { newName } = req.body;

        const sourceRole = await Role.findById(id);

        if (!sourceRole) {
            const error = createHttpError(404, "Source role not found!");
            return next(error);
        }

        // Verificar permissão
        if (!req.user.isMasterAdmin && sourceRole.store && sourceRole.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Not authorized to duplicate this role!");
            return next(error);
        }

        const roleName = newName || `${sourceRole.name} (Copy)`;

        // Verificar se novo nome já existe
        const existingRole = await Role.findOne({
            store: sourceRole.store,
            name: new RegExp(`^${roleName}$`, 'i')
        });

        if (existingRole) {
            const error = createHttpError(400, "Role with this name already exists!");
            return next(error);
        }

        const newRole = await Role.create({
            store: sourceRole.store,
            name: roleName,
            description: `Copy of ${sourceRole.name}`,
            permissions: sourceRole.permissions,
            customPermissions: sourceRole.customPermissions,
            isSystem: false
        });

        res.status(201).json({
            success: true,
            message: "Role duplicated successfully!",
            data: newRole
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Criar roles padrão do sistema (chamado uma vez no seed)
 */
const createSystemRoles = async (storeId = null) => {
    const systemRoles = [
        {
            name: 'Admin',
            description: 'Administrador com acesso total',
            permissions: {
                orders: { create: true, read: true, update: true, delete: true, cancel: true },
                tables: { create: true, read: true, update: true, delete: true },
                products: { create: true, read: true, update: true, delete: true },
                inventory: { create: true, read: true, update: true, delete: true, adjust: true, transfer: true },
                payments: { create: true, read: true, refund: true },
                users: { create: true, read: true, update: true, delete: true, manageRoles: true },
                devices: { read: true, approve: true, revoke: true },
                reports: { read: true, export: true, financial: true },
                settings: { read: true, update: true }
            },
            isSystem: true
        },
        {
            name: 'Gerente',
            description: 'Gerente da loja',
            permissions: {
                orders: { create: true, read: true, update: true, delete: false, cancel: true },
                tables: { create: true, read: true, update: true, delete: false },
                products: { create: true, read: true, update: true, delete: false },
                inventory: { create: true, read: true, update: true, delete: false, adjust: true, transfer: true },
                payments: { create: true, read: true, refund: true },
                users: { create: false, read: true, update: true, delete: false, manageRoles: false },
                devices: { read: true, approve: false, revoke: false },
                reports: { read: true, export: true, financial: true },
                settings: { read: true, update: true }
            },
            isSystem: true
        },
        {
            name: 'Caixa',
            description: 'Operador de caixa',
            permissions: {
                orders: { create: true, read: true, update: true, delete: false, cancel: false },
                tables: { create: false, read: true, update: true, delete: false },
                products: { create: false, read: true, update: false, delete: false },
                inventory: { create: false, read: true, update: false, delete: false, adjust: false, transfer: false },
                payments: { create: true, read: true, refund: false },
                users: { create: false, read: false, update: false, delete: false, manageRoles: false },
                devices: { read: false, approve: false, revoke: false },
                reports: { read: false, export: false, financial: false },
                settings: { read: false, update: false }
            },
            isSystem: true
        },
        {
            name: 'Garçom',
            description: 'Garçom / Atendente de salão',
            permissions: {
                orders: { create: true, read: true, update: true, delete: false, cancel: false },
                tables: { create: false, read: true, update: true, delete: false },
                products: { create: false, read: true, update: false, delete: false },
                inventory: { create: false, read: true, update: false, delete: false, adjust: false, transfer: false },
                payments: { create: false, read: false, refund: false },
                users: { create: false, read: false, update: false, delete: false, manageRoles: false },
                devices: { read: false, approve: false, revoke: false },
                reports: { read: false, export: false, financial: false },
                settings: { read: false, update: false }
            },
            isSystem: true
        }
    ];

    for (const roleData of systemRoles) {
        const existing = await Role.findOne({ store: storeId, name: roleData.name });
        if (!existing) {
            await Role.create({
                store: storeId,
                ...roleData
            });
        }
    }
};

module.exports = {
    createRole,
    getRoles,
    getRoleById,
    updateRole,
    toggleRoleStatus,
    deleteRole,
    duplicateRole,
    createSystemRoles
};
