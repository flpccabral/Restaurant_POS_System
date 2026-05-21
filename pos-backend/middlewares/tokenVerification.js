const createHttpError = require("http-errors");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const User = require("../models/userModel");
const Role = require("../models/roleModel");

/**
 * Middleware para verificar token JWT e carregar usuário
 *
 * O token deve conter: { _id, storeId, isMasterAdmin }
 *
 * Popula:
 * - req.user com dados do usuário + store
 * - req.userRole com a role dinâmica (se aplicável)
 * - req.storeId para uso nos controllers
 */
const isVerifiedUser = async (req, res, next) => {
    try {
        const { accessToken } = req.cookies;

        if (!accessToken) {
            const error = createHttpError(401, "Please provide token!");
            return next(error);
        }

        const decodeToken = jwt.verify(accessToken, config.accessTokenSecret);

        const user = await User.findById(decodeToken._id).populate('store');
        if (!user) {
            const error = createHttpError(401, "User not exist!");
            return next(error);
        }

        // Verificar se usuário está ativo
        if (!user.isActive) {
            const error = createHttpError(401, "User account is deactivated!");
            return next(error);
        }

        // Se role for ObjectId, carregar role dinâmica
        if (typeof user.role !== 'string' && user.role) {
            const userRole = await Role.findById(user.role);
            if (userRole && userRole.isActive) {
                req.userRole = userRole;
            } else if (userRole && !userRole.isActive) {
                const error = createHttpError(403, "User role is deactivated!");
                return next(error);
            }
        }

        // Injetar storeId para o middleware storeIsolation
        if (user.store) {
            user.storeId = user.store._id;
        }

        req.user = user;
        next();

    } catch (error) {
        const err = createHttpError(401, "Invalid Token!");
        next(err);
    }
};

module.exports = { isVerifiedUser };