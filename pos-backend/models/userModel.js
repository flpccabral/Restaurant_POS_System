const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        default: uuidv4,
        unique: true,
        index: true,
        immutable: true
    },
    name: {
        type: String,
        required: true,
    },

    email: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return /\S+@\S+\.\S+/.test(v);
            },
            message: "Email must be in valid format!"
        }
    },

    phone: {
        type: Number,
        required: true,
        validate: {
            validator: function (v) {
                return /\d{10}/.test(v);
            },
            message: "Phone number must be a 10-digit number!"
        }
    },

    password: {
        type: String,
        required: true,
    },

    // Role pode ser String (legado) ou ObjectId (novo sistema dinâmico)
    role: {
        type: mongoose.Schema.Types.Mixed,
        required: true
        // Pode ser String ('Admin', 'Waiter') ou ObjectId ref 'Role'
    },

    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: true,
        index: true
    },

    isMasterAdmin: {
        type: Boolean,
        default: false
    },

    // Status da conta
    isActive: {
        type: Boolean,
        default: true
    },

    // Dispositivo atualmente em uso
    currentDevice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device'
    },

    lastLoginAt: Date,
    lastDevice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device'
    },

    // Metadados
    avatar: String,
    department: String,
    notes: String
}, { timestamps: true });

// Index composto para queries comuns
userSchema.index({ store: 1, email: 1 }, { unique: true });
userSchema.index({ store: 1, isActive: 1 });

// Hash de senha antes de salvar
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Método para verificar se usuário tem uma role específica (legado)
userSchema.methods.hasLegacyRole = function (roleName) {
    if (typeof this.role === 'string') {
        return this.role.toLowerCase() === roleName.toLowerCase();
    }
    return false;
};

// Método para obter nome da role
userSchema.methods.getRoleName = function () {
    if (typeof this.role === 'string') {
        return this.role;
    }
    return this.role?.name || 'Unknown';
};

module.exports = mongoose.model("User", userSchema);