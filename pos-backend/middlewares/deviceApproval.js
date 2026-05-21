const createHttpError = require("http-errors");
const Device = require("../models/deviceModel");
const SessionLog = require("../models/sessionLogModel");
const { generateDeviceFingerprint, parseDeviceInfo } = require("../utils/deviceFingerprint");

/**
 * Middleware para aprovação de dispositivos com Nickname
 *
 * Fluxo:
 * 1. Gera fingerprint do dispositivo
 * 2. Busca dispositivo no banco
 * 3. Se não existir: retorna 403 com flag "NEEDS_NICKNAME"
 * 4. Se existir sem nickname: retorna 403 com flag "NEEDS_NICKNAME"
 * 5. Se existir com nickname mas não aprovado: retorna 403 pendente
 * 6. Se aprovado: atualiza lastActiveAt e permite
 *
 * Exceções: rotas públicas não passam por este middleware
 */
const deviceApproval = async (req, res, next) => {
    try {
        // Rotas públicas (não requerem device approval)
        const publicPaths = [
            '/api/user/login',
            '/api/user/register',
            '/api/user/logout',
            '/api/device/register',
            '/api/device/submit-nickname'
        ];

        if (publicPaths.some(path => req.path === path || req.path.startsWith(path + '/'))) {
            return next();
        }

        const user = req.user;
        if (!user) {
            const error = createHttpError(401, "User not authenticated!");
            return next(error);
        }

        // Gerar fingerprint do dispositivo atual
        const fingerprint = generateDeviceFingerprint(req);
        const deviceInfo = parseDeviceInfo(req);

        // Buscar dispositivo no banco
        let device = await Device.findOne({
            fingerprint,
            user: user._id
        }).populate('store');

        if (!device) {
            // Dispositivo novo - precisa registrar com nickname primeiro
            await logDeviceAccess(req, user, fingerprint, deviceInfo, 'blocked_new_device_needs_nickname');

            const error = createHttpError(
                403,
                "Novo dispositivo detectado. Por favor, registre este dispositivo com um apelido."
            );
            error.code = 'DEVICE_NEEDS_NICKNAME';
            error.fingerprint = fingerprint;
            error.deviceInfo = deviceInfo;
            error.action = 'REGISTER_DEVICE';
            return next(error);
        }

        // Verificar se dispositivo tem nickname
        if (!device.nickname || device.nickname.trim() === '') {
            await logDeviceAccess(req, user, fingerprint, deviceInfo, 'blocked_needs_nickname');

            const error = createHttpError(
                403,
                "Dispositivo requer um apelido. Por favor, informe um apelido para este dispositivo."
            );
            error.code = 'DEVICE_NEEDS_NICKNAME';
            error.deviceId = device.deviceId;
            error.action = 'SUBMIT_NICKNAME';
            return next(error);
        }

        // Verificar aprovação
        if (!device.isApproved) {
            await logDeviceAccess(req, user, fingerprint, deviceInfo, 'blocked_pending_approval');

            const error = createHttpError(
                403,
                "Dispositivo pendente de aprovação. Aguarde a aprovação do administrador da loja."
            );
            error.code = 'DEVICE_PENDING_APPROVAL';
            error.deviceId = device.deviceId;
            error.deviceNickname = device.nickname;
            error.action = 'WAIT_APPROVAL';
            return next(error);
        }

        // Verificar se não foi revogado
        if (device.revokedAt) {
            await logDeviceAccess(req, user, fingerprint, deviceInfo, 'blocked_revoked');

            const error = createHttpError(
                403,
                `Acesso revogado: ${device.revokedReason || 'Contate o administrador.'}`
            );
            error.code = 'DEVICE_REVOKED';
            error.deviceId = device.deviceId;
            return next(error);
        }

        // Dispositivo aprovado - atualizar lastActiveAt e isCurrent
        device.lastActiveAt = new Date();
        device.isCurrent = true;
        device.deviceInfo = { ...device.deviceInfo, ...deviceInfo };
        await device.save();

        req.device = device;

        // Log de acesso bem-sucedido
        await logDeviceAccess(req, user, fingerprint, deviceInfo, 'success', device._id);

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Middleware para registrar dispositivo com nickname
 * Deve ser usado no endpoint POST /api/device/register
 */
const registerDevice = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            const error = createHttpError(401, "User not authenticated!");
            return next(error);
        }

        const { nickname } = req.body;

        if (!nickname || nickname.trim().length < 3) {
            const error = createHttpError(400, "Nickname must have at least 3 characters!");
            return next(error);
        }

        if (nickname.length > 50) {
            const error = createHttpError(400, "Nickname must have at most 50 characters!");
            return next(error);
        }

        const fingerprint = generateDeviceFingerprint(req);
        const deviceInfo = parseDeviceInfo(req);

        // Verificar se dispositivo já existe
        let device = await Device.findOne({
            fingerprint,
            user: user._id
        });

        if (device) {
            // Atualizar nickname se dispositivo existe
            device.nickname = nickname.trim();
            device.deviceInfo = { ...device.deviceInfo, ...deviceInfo };
            device.lastActiveAt = new Date();

            // Se for Master Admin, auto-aprovar
            if (user.isMasterAdmin) {
                device.isApproved = true;
                device.approvedBy = user._id;
                device.approvedAt = new Date();
            }

            await device.save();
        } else {
            // Criar novo dispositivo
            device = await Device.create({
                user: user._id,
                store: user.store,
                fingerprint,
                nickname: nickname.trim(),
                deviceInfo,
                isApproved: user.isMasterAdmin || false,  // Auto-aprovar Master Admin
                isCurrent: true,
                lastActiveAt: new Date(),
                firstSeenAt: new Date(),
                ...(user.isMasterAdmin ? {
                    approvedBy: user._id,
                    approvedAt: new Date()
                } : {})
            });
        }

        req.device = device;

        // Log de registro
        await logDeviceAccess(req, user, fingerprint, deviceInfo, 'registered', device._id);

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Middleware para submeter nickname de dispositivo existente
 * POST /api/device/submit-nickname
 */
const submitNickname = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            const error = createHttpError(401, "User not authenticated!");
            return next(error);
        }

        const { deviceId, nickname } = req.body;

        if (!nickname || nickname.trim().length < 3) {
            const error = createHttpError(400, "Nickname must have at least 3 characters!");
            return next(error);
        }

        if (nickname.length > 50) {
            const error = createHttpError(400, "Nickname must have at most 50 characters!");
            return next(error);
        }

        // Se deviceId não fornecido, buscar por fingerprint
        let device;
        if (deviceId) {
            device = await Device.findOne({
                _id: deviceId,
                user: user._id
            });
        } else {
            const fingerprint = generateDeviceFingerprint(req);
            device = await Device.findOne({
                fingerprint,
                user: user._id
            });
        }

        if (!device) {
            const error = createHttpError(404, "Device not found!");
            return next(error);
        }

        // Atualizar nickname
        device.nickname = nickname.trim();
        device.lastActiveAt = new Date();
        await device.save();

        req.device = device;

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Registra tentativas de acesso no SessionLog
 */
const logDeviceAccess = async (req, user, fingerprint, deviceInfo, status, deviceId = null) => {
    try {
        await SessionLog.create({
            user: user._id,
            store: user.store,
            device: deviceId,
            action: 'device_access_attempt',
            metadata: {
                status,
                fingerprint,
                deviceInfo,
                path: req.path,
                method: req.method,
                userAgent: deviceInfo.userAgent
            },
            ipAddress: deviceInfo.ip
        });
    } catch (error) {
        console.error('Failed to log device access:', error.message);
    }
};

/**
 * Middleware opcional para atualizar último dispositivo no login
 */
const updateLastDeviceOnLogin = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user || !req.device) {
            return next();
        }

        user.lastDevice = req.device._id;
        user.lastLoginAt = new Date();
        await user.save();

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Registrar dispositivo automaticamente no login
 * Chamado após login bem-sucedido
 */
const registerDeviceOnLogin = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            return next();
        }

        const fingerprint = generateDeviceFingerprint(req);
        const deviceInfo = parseDeviceInfo(req);

        // Buscar dispositivo existente
        let device = await Device.findOne({
            fingerprint,
            user: user._id
        });

        if (device) {
            // Atualizar dispositivo existente
            device.lastActiveAt = new Date();
            device.isCurrent = true;
            device.deviceInfo = { ...device.deviceInfo, ...deviceInfo };
            await device.save();
        } else {
            // Criar novo dispositivo (sem nickname ainda)
            device = await Device.create({
                user: user._id,
                store: user.store,
                fingerprint,
                nickname: 'Auto-' + deviceInfo.browser || 'Unknown',
                deviceInfo,
                isApproved: user.isMasterAdmin || false,
                isCurrent: true,
                lastActiveAt: new Date(),
                firstSeenAt: new Date(),
                ...(user.isMasterAdmin ? {
                    approvedBy: user._id,
                    approvedAt: new Date()
                } : {})
            });
        }

        req.device = device;
        next();
    } catch (error) {
        // Não falhar o login se registro do dispositivo falhar
        console.error('Failed to register device on login:', error.message);
        next();
    }
};

module.exports = {
    deviceApproval,
    registerDevice,
    submitNickname,
    updateLastDeviceOnLogin,
    registerDeviceOnLogin,
    logDeviceAccess
};
