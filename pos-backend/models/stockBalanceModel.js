const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const stockBalanceSchema = new mongoose.Schema({
    stockId: {
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
        comment: 'Contexto operacional. Opcional quando location e estoque central compartilhado.'
    },
    location: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StockLocation',
        required: true,
        index: true,
        comment: 'Localizacao fisica do estoque — fonte primaria do saldo'
    },
    ingredient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GlobalIngredient',
        required: true,
        index: true
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    reserved: {
        type: Number,
        default: 0,
        min: 0,
        comment: 'Quantidade reservada (nao disponivel)'
    },
    available: {
        type: Number,
        default: 0,
        comment: 'Quantidade disponivel (balance - reserved)'
    },
    minimumStock: {
        type: Number,
        default: 0,
        min: 0,
        comment: 'Estoque minimo para alerta de reposicao'
    },
    unit: {
        type: String,
        required: true,
        comment: 'Unidade de medida base'
    },
    lastPurchasePrice: {
        type: Number,
        default: 0,
        min: 0,
        comment: 'Preco da ultima compra'
    },
    lastPurchaseDate: {
        type: Date,
        comment: 'Data da ultima compra'
    },
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        comment: 'Fornecedor principal'
    }
}, { timestamps: true });

// Indice unico por location + ingrediente (fonte de verdade do saldo)
stockBalanceSchema.index({ location: 1, ingredient: 1 }, { unique: true });
stockBalanceSchema.index({ store: 1, location: 1 }, { sparse: true });
stockBalanceSchema.index({ store: 1, balance: 1 }, { sparse: true });
stockBalanceSchema.index({ store: 1, minimumStock: 1 }, { sparse: true });

// Virtual para verificar se esta abaixo do minimo
stockBalanceSchema.virtual('needsRestock').get(function() {
    return this.available <= this.minimumStock;
});

// Virtual para custo total em estoque
stockBalanceSchema.virtual('totalValue').get(function() {
    return this.balance * this.lastPurchasePrice;
});

// Atualizar available antes de salvar
stockBalanceSchema.pre('save', function(next) {
    this.available = this.balance - this.reserved;
    next();
});

// Metodo para adicionar saldo
stockBalanceSchema.methods.addBalance = async function(quantity, price = null) {
    this.balance += quantity;
    if (price !== null) {
        this.lastPurchasePrice = price;
        this.lastPurchaseDate = new Date();
    }
    await this.save();
    return this;
};

// Metodo para remover saldo (baixa)
stockBalanceSchema.methods.removeBalance = async function(quantity, reason = 'consumption') {
    if (this.balance < quantity) {
        throw new Error(`Insufficient stock. Available: ${this.balance}, Requested: ${quantity}`);
    }
    this.balance -= quantity;
    await this.save();
    return this;
};

// Metodo para reservar quantidade
stockBalanceSchema.methods.reserve = async function(quantity) {
    if (this.available < quantity) {
        throw new Error(`Insufficient available stock. Available: ${this.available}, Requested: ${quantity}`);
    }
    this.reserved += quantity;
    await this.save();
    return this;
};

// Metodo para liberar reserva
stockBalanceSchema.methods.releaseReservation = async function(quantity) {
    this.reserved = Math.max(0, this.reserved - quantity);
    await this.save();
    return this;
};

module.exports = mongoose.model("StockBalance", stockBalanceSchema);
