const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const sessionLogSchema = new mongoose.Schema({
    logId: {
        type: String,
        default: uuidv4,
        unique: true,
        index: true,
        immutable: true
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
        required: true,
        index: true
    },
    device: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        index: true
    },
    action: {
        type: String,
        required: true,
        index: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    },
    ipAddress: String
}, { timestamps: true });

sessionLogSchema.index({ store: 1, createdAt: -1 });
sessionLogSchema.index({ user: 1, createdAt: -1 });
module.exports = mongoose.model("SessionLog", sessionLogSchema);
