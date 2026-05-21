const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

/**
 * Device Model - Controle de Dispositivos com Apelido
 *
 * Cada dispositivo requer um apelido (nickname) no primeiro acesso
 * para facilitar identificação pelo Admin.
 */
const deviceSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        default: uuidv4,
        unique: true,
        index: true,
        immutable: true
    },
    fingerprint: {
        type: String,
        required: true,
        index: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        index: true
    },
    // Apelido dado pelo usuário no primeiro acesso
    nickname: {
        type: String,
        required: [true, 'Device nickname is required'],
        trim: true,
        maxlength: 50
    },
    deviceInfo: {
        userAgent: String,
        browser: String,
        os: String,
        ip: String,
        device: {
            type: String,
            enum: ['mobile', 'tablet', 'desktop'],
            default: 'desktop'
        },
        screenResolution: String,
        timezone: String
    },
    // Status de aprovação
    isApproved: {
        type: Boolean,
        default: false
    },
    // Se dispositivo está ativo atualmente
    isCurrent: {
        type: Boolean,
        default: false
    },
    // Histórico de atividade
    lastActiveAt: Date,
    firstSeenAt: {
        type: Date,
        default: Date.now
    },
    // Quem aprovou e quando
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: Date,
    // Motivo da revogação (se aplicável)
    revokedAt: Date,
    revokedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    revokeReason: String
}, { timestamps: true });

// Índices compostos
deviceSchema.index({ user: 1, fingerprint: 1 }, { unique: true });
deviceSchema.index({ store: 1, isApproved: 1 });
deviceSchema.index({ user: 1, isCurrent: 1 });

// Método para verificar se dispositivo está ativo
deviceSchema.methods.isActive = function() {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    return this.isApproved && this.lastActiveAt > thirtyMinutesAgo;
};

// Método para formatar informações do dispositivo
deviceSchema.methods.getDeviceInfo = function() {
    return {
        deviceId: this.deviceId,
        nickname: this.nickname,
        browser: this.deviceInfo?.browser,
        os: this.deviceInfo?.os,
        device: this.deviceInfo?.device,
        ip: this.deviceInfo?.ip,
        isApproved: this.isApproved,
        isCurrent: this.isCurrent,
        lastActiveAt: this.lastActiveAt,
        firstSeenAt: this.firstSeenAt
    };
};

module.exports = mongoose.model("Device", deviceSchema);
