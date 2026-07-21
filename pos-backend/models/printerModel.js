const mongoose = require("mongoose");

const printerSchema = new mongoose.Schema({
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['receipt', 'kitchen'],
        required: true,
        index: true,
        comment: 'Tipo da impressora: receipt (cupom nao-fiscal) ou kitchen (comanda de cozinha)'
    },
    protocol: {
        type: String,
        enum: ['tcp', 'usb'],
        default: 'tcp'
    },
    ipAddress: {
        type: String,
        trim: true,
        comment: 'IP da impressora (para protocolo TCP/IP)'
    },
    port: {
        type: Number,
        default: 9100,
        comment: 'Porta TCP da impressora (padrao ESC/POS: 9100)'
    },
    paperWidth: {
        type: Number,
        enum: [58, 80],
        default: 80,
        comment: 'Largura do papel em mm (58mm ou 80mm)'
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    lastTestAt: {
        type: Date,
        comment: 'Timestamp do ultimo teste bem-sucedido'
    },
    location: {
        type: String,
        trim: true,
        comment: 'Localizacao fisica da impressora (ex: "Cozinha", "Balcao")'
    }
}, { timestamps: true });

// Index composto para busca eficiente por loja e status
printerSchema.index({ store: 1, isActive: 1 });
printerSchema.index({ store: 1, type: 1, isActive: 1 });

// Metodo estatico: buscar impressora ativa por tipo para uma loja
printerSchema.statics.getActivePrinter = async function(storeId, type) {
    return this.findOne({
        store: storeId,
        type: type,
        isActive: true
    }).sort({ createdAt: -1 });
};

// Metodo estatico: listar impressoras ativas de uma loja
printerSchema.statics.getActivePrinters = async function(storeId) {
    return this.find({
        store: storeId,
        isActive: true
    }).sort({ type: 1, name: 1 });
};

module.exports = mongoose.model("Printer", printerSchema);
