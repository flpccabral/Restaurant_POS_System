const createHttpError = require("http-errors");
const Role = require("../models/roleModel");

/**
 * Middleware para verificação de permissões dinâmicas
 *
 * Uso:
 *  checkPermission('orders', 'create')
 *  checkPermission('products', ['read', 'update'])  // Múltiplas ações
 *  checkPermission('inventory', 'adjust', { requireAll: true })
 *
 * @param {String} module - Módulo (orders, products, inventory, etc.)
 * @param {String|Array} actions - Ação ou array de ações
 * @param {Object} options - Opções adicionais
 * @returns {Function} Middleware function
 */
const checkPermission = (module, actions, options = {}) => {
    const { requireAll = false, redirectTo = null } = options;

    return async (req, res, next) => {
        try {
            const user = req.user;

            if (!user) {
                const error = createHttpError(401, "User not authenticated!");
                return next(error);
            }

            // Master Admin tem acesso total
            if (user.isMasterAdmin) {
                return next();
            }

            // Normalizar actions para array
            const actionsArray = Array.isArray(actions) ? actions : [actions];

            // Carregar role do usuário com permissões
            const userRole = await Role.findById(user.role).populate('store');

            if (!userRole || !userRole.isActive) {
                const error = createHttpError(403, "User role is not active or not found!");
                return next(error);
            }

            // Verificar se a role pertence à mesma loja (ou é global)
            if (userRole.store && userRole.store.toString() !== user.store.toString()) {
                const error = createHttpError(403, "Role does not belong to user's store!");
                return next(error);
            }

            // Verificar permissões
            let hasPermission = false;

            if (requireAll) {
                // Precisa de TODAS as permissões
                hasPermission = userRole.hasAllPermissions(module, actionsArray);
            } else {
                // Precisa de QUALQUER uma das permissões
                hasPermission = userRole.hasAnyPermission(module, actionsArray);
            }

            if (!hasPermission) {
                const actionStr = Array.isArray(actions) ? actions.join(', ') : actions;
                const error = createHttpError(
                    403,
                    `Permission denied: ${module}:${actionStr}`
                );
                error.code = 'PERMISSION_DENIED';
                error.module = module;
                error.requiredActions = actionsArray;
                return next(error);
            }

            // Adicionar permissões ao request para uso posterior
            req.userPermissions = req.userPermissions || {};
            req.userPermissions[module] = actionsArray;

            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Middleware para verificar permissão baseada em recursos
 * Útil quando precisa verificar acesso a um recurso específico
 *
 * @param {String} module - Módulo
 * @param {String} action - Ação
 * @param {String} resourceParam - Nome do parâmetro de recurso (ex: 'id', 'orderId')
 * @param {Function} resourceLoader - Função para carregar o recurso
 * @returns {Function} Middleware function
 */
const checkResourcePermission = (module, action, resourceParam = 'id', resourceLoader = null) => {
    return async (req, res, next) => {
        try {
            const user = req.user;

            if (!user) {
                const error = createHttpError(401, "User not authenticated!");
                return next(error);
            }

            // Master Admin tem acesso total
            if (user.isMasterAdmin) {
                return next();
            }

            // Carregar recurso se loader fornecido
            if (resourceLoader) {
                const resource = await resourceLoader(req.params[resourceParam], user.store);

                if (!resource) {
                    const error = createHttpError(404, "Resource not found!");
                    return next(error);
                }

                // Verificar se recurso pertence à mesma loja
                if (resource.store && resource.store.toString() !== user.store.toString()) {
                    const error = createHttpError(403, "Access denied: Resource belongs to different store!");
                    return next(error);
                }

                req.resource = resource;
            }

            // Verificar permissão básica
            return checkPermission(module, action)(req, res, next);
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Middleware para verificar múltiplas permissões de uma vez
 *
 * @param {Array} permissionChecks - Array de { module, actions, requireAll }
 * @returns {Function} Middleware function
 */
const checkMultiplePermissions = (permissionChecks) => {
    return async (req, res, next) => {
        try {
            const user = req.user;

            if (!user) {
                const error = createHttpError(401, "User not authenticated!");
                return next(error);
            }

            // Master Admin tem acesso total
            if (user.isMasterAdmin) {
                return next();
            }

            // Verificar cada conjunto de permissões
            for (const check of permissionChecks) {
                const hasPermission = await checkPermission(check.module, check.actions, {
                    requireAll: check.requireAll
                });

                // Se não tem permissão, continua para próxima verificação
                // (middleware checkPermission já lida com erro)
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Middleware para verificar se usuário tem role específica
 *
 * @param {String|Array} roles - Nome do role ou array de nomes
 * @returns {Function} Middleware function
 */
const checkRole = (roles) => {
    return async (req, res, next) => {
        try {
            const user = req.user;

            if (!user) {
                const error = createHttpError(401, "User not authenticated!");
                return next(error);
            }

            // Master Admin passa sempre
            if (user.isMasterAdmin) {
                return next();
            }

            // Normalizar roles para array
            const rolesArray = Array.isArray(roles) ? roles : [roles];

            // Se user.role for string (legacy/simple mode), verificar diretamente
            if (typeof user.role === 'string') {
                if (!rolesArray.includes(user.role)) {
                    const error = createHttpError(
                        403,
                        `Access denied: Role ${user.role} not authorized`
                    );
                    return next(error);
                }
                return next();
            }

            // Carregar role dinâmica do usuário (ObjectId)
            const userRole = await Role.findById(user.role);

            if (!userRole) {
                const error = createHttpError(403, "User role not found!");
                return next(error);
            }

            // Verificar se role está na lista permitida
            if (!rolesArray.includes(userRole.name)) {
                const error = createHttpError(
                    403,
                    `Access denied: Role ${userRole.name} not authorized`
                );
                return next(error);
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

module.exports = {
    checkPermission,
    checkResourcePermission,
    checkMultiplePermissions,
    checkRole
};
