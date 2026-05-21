const createHttpError = require("http-errors");
const Device = require("../models/deviceModel");
const User = require("../models/userModel");
const SessionLog = require("../models/sessionLogModel");
const ws = require("../services/websocketService");

/**
 * Listar todos os dispositivos (Admin apenas)
 * Filtros opcionais: storeId, userId, isApproved, status
 */
const getAllDevices = async (req, res, next) => {
    try {
        const { storeId, userId, isApproved, status, nickname } = req.query;
        const filter = {};

        if (storeId) {
            filter.store = storeId;
        }

        if (userId) {
            filter.user = userId;
        }

        if (isApproved !== undefined) {
            filter.isApproved = isApproved === 'true';
        }

        if (status === 'pending') {
            filter.isApproved = false;
        } else if (status === 'approved') {
            filter.isApproved = true;
        } else if (status === 'active') {
            // Ativos nos últimos 30 minutos
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            filter.lastActiveAt = { $gte: thirtyMinutesAgo };
        }

        if (nickname) {
            filter.nickname = { $regex: nickname, $options: 'i' };
        }

        // Se não for master admin, filtrar apenas pela store do usuário
        if (!req.user.isMasterAdmin) {
            filter.store = req.user.store;
        }

        const devices = await Device.find(filter)
            .populate('user', 'name email role')
            .populate('store', 'name')
            .populate('approvedBy', 'name')
            .sort({ lastActiveAt: -1 });

        res.status(200).json({
            success: true,
            count: devices.length,
            data: devices
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar dispositivos pendentes de aprovação
 */
const getPendingDevices = async (req, res, next) => {
    try {
        const filter = { isApproved: false };

        // Se não for master admin, filtrar apenas pela store do usuário
        if (!req.user.isMasterAdmin) {
            filter.store = req.user.store;
        }

        const devices = await Device.find(filter)
            .populate('user', 'name email')
            .populate('store', 'name')
            .sort({ firstSeenAt: -1 });

        res.status(200).json({
            success: true,
            count: devices.length,
            data: devices
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar meus dispositivos (usuário logado)
 */
const getMyDevices = async (req, res, next) => {
    try {
        const devices = await Device.find({ user: req.user._id })
            .populate('store', 'name')
            .sort({ lastActiveAt: -1 });

        res.status(200).json({
            success: true,
            count: devices.length,
            data: devices
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Aprovar um dispositivo
 */
const approveDevice = async (req, res, next) => {
    try {
        const { id } = req.params;

        const device = await Device.findById(id);

        if (!device) {
            const error = createHttpError(404, "Device not found!");
            return next(error);
        }

        // Verificar permissão
        if (!req.user.isMasterAdmin && device.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Not authorized to approve devices from this store!");
            return next(error);
        }

        // Verificar se tem nickname
        if (!device.nickname || device.nickname.trim() === '') {
            const error = createHttpError(400, "Device must have a nickname before approval!");
            return next(error);
        }

        device.isApproved = true;
        device.approvedBy = req.user._id;
        device.approvedAt = new Date();
        device.revokedAt = null;
        device.revokedBy = null;
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

        // Emit WebSocket event
        const io = req.app.get('io');
        ws.emitDeviceApproved(io, device);

        res.status(200).json({
            success: true,
            message: "Device approved successfully!",
            data: device
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Revogar acesso de um dispositivo
 */
const revokeDevice = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const device = await Device.findById(id);

        if (!device) {
            const error = createHttpError(404, "Device not found!");
            return next(error);
        }

        // Verificar permissão
        if (!req.user.isMasterAdmin && device.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Not authorized to revoke devices from this store!");
            return next(error);
        }

        device.isApproved = false;
        device.revokedAt = new Date();
        device.revokedBy = req.user._id;
        device.revokedReason = reason || "Access revoked by admin";
        device.isCurrent = false;
        await device.save();

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: req.user.store,
            device: device._id,
            action: 'device_revoked',
            metadata: { reason: device.revokedReason, deviceNickname: device.nickname }
        });

        res.status(200).json({
            success: true,
            message: "Device access revoked successfully!",
            data: { id: device._id }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter detalhes de um dispositivo específico
 */
const getDeviceById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const device = await Device.findById(id)
            .populate('user', 'name email role')
            .populate('store', 'name cnpj')
            .populate('approvedBy', 'name');

        if (!device) {
            const error = createHttpError(404, "Device not found!");
            return next(error);
        }

        // Verificar permissão
        if (!req.user.isMasterAdmin && device.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Not authorized to view this device!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            data: device
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Marcar dispositivo como atual (logout de outros dispositivos)
 */
const setCurrentDevice = async (req, res, next) => {
    try {
        const { id } = req.params;

        const device = await Device.findById(id);

        if (!device) {
            const error = createHttpError(404, "Device not found!");
            return next(error);
        }

        // Verificar se o dispositivo pertence ao usuário
        if (device.user.toString() !== req.user._id.toString() && !req.user.isMasterAdmin) {
            const error = createHttpError(403, "Not authorized!");
            return next(error);
        }

        // Marcar todos os outros dispositivos como não atuais
        await Device.updateMany(
            { user: req.user._id, _id: { $ne: id } },
            { isCurrent: false }
        );

        device.isCurrent = true;
        device.lastActiveAt = new Date();
        await device.save();

        // Atualizar usuário
        const user = await User.findById(req.user._id);
        user.currentDevice = device._id;
        user.lastDevice = device._id;
        await user.save();
        req.user = user;

        res.status(200).json({
            success: true,
            message: "Device set as current!",
            data: device
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar nickname de um dispositivo
 */
const updateDeviceNickname = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { nickname } = req.body;

        if (!nickname || nickname.trim().length < 3) {
            const error = createHttpError(400, "Nickname must have at least 3 characters!");
            return next(error);
        }

        if (nickname.length > 50) {
            const error = createHttpError(400, "Nickname must have at most 50 characters!");
            return next(error);
        }

        const device = await Device.findById(id);

        if (!device) {
            const error = createHttpError(404, "Device not found!");
            return next(error);
        }

        // Verificar se pertence ao usuário
        if (device.user.toString() !== req.user._id.toString() && !req.user.isMasterAdmin) {
            const error = createHttpError(403, "Not authorized to update this device!");
            return next(error);
        }

        device.nickname = nickname.trim();
        await device.save();

        res.status(200).json({
            success: true,
            message: "Device nickname updated successfully!",
            data: device
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Estatísticas de dispositivos
 */
const getDeviceStats = async (req, res, next) => {
    try {
        const filter = {};

        if (!req.user.isMasterAdmin) {
            filter.store = req.user.store;
        }

        const total = await Device.countDocuments(filter);
        const approved = await Device.countDocuments({ ...filter, isApproved: true });
        const pending = await Device.countDocuments({ ...filter, isApproved: false });
        const revoked = await Device.countDocuments({ ...filter, revokedAt: { $exists: true } });

        // Ativos nos últimos 30 minutos
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const active = await Device.countDocuments({
            ...filter,
            lastActiveAt: { $gte: thirtyMinutesAgo }
        });

        res.status(200).json({
            success: true,
            data: {
                total,
                approved,
                pending,
                revoked,
                active
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllDevices,
    getPendingDevices,
    getMyDevices,
    approveDevice,
    revokeDevice,
    getDeviceById,
    setCurrentDevice,
    updateDeviceNickname,
    getDeviceStats
};
