const mongoose = require("mongoose");

const stockLocationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['CENTRAL_WAREHOUSE', 'STORE', 'KITCHEN', 'LOSS', 'SUPPLIER', 'CUSTOMER'],
        required: true,
        index: true
    },
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        comment: 'Obrigatorio para STORE. Opcional para CENTRAL_WAREHOUSE (compartilhado).'
    },
    description: {
        type: String,
        maxlength: 500
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    }
}, { timestamps: true });

// Tipos que exigem store vinculado
const TYPES_REQUIRING_STORE = ['STORE', 'KITCHEN', 'LOSS', 'SUPPLIER', 'CUSTOMER'];

// Validacao: store obrigatorio para tipos que representam operacao comercial
stockLocationSchema.pre('validate', function(next) {
    if (TYPES_REQUIRING_STORE.includes(this.type) && !this.store) {
        return next(new Error(`StockLocation of type ${this.type} requires a store reference`));
    }
    next();
});

// Indices — store pode ser null, entao nao usar unique composto simples com store
stockLocationSchema.index({ type: 1, store: 1, name: 1 }, { unique: true });
stockLocationSchema.index({ type: 1, isActive: 1 });
stockLocationSchema.index({ store: 1 }, { sparse: true });

// Metodo estatico para obter ou criar localizacao padrao da loja
stockLocationSchema.statics.getOrCreateStoreLocation = async function(storeId, storeName) {
    let location = await this.findOne({
        store: storeId,
        type: 'STORE'
    });

    if (!location) {
        location = await this.create({
            name: `Estoque - ${storeName || 'Loja'}`,
            type: 'STORE',
            store: storeId,
            description: 'Localizacao padrao da loja'
        });
    }

    return location;
};

// Metodo estatico para obter estoque central compartilhado ou dedicado de uma store
stockLocationSchema.statics.getOrCreateCentralWarehouse = async function(storeId) {
    // Primeiro: tentar central compartilhado (store = null)
    let warehouse = await this.findOne({
        type: 'CENTRAL_WAREHOUSE',
        store: null
    });

    // Se nao existe compartilhado e foi pedido por store, tentar dedicado
    if (!warehouse && storeId) {
        warehouse = await this.findOne({
            type: 'CENTRAL_WAREHOUSE',
            store: storeId
        });
    }

    // Se ainda nao existe e tem storeId, criar dedicado
    if (!warehouse && storeId) {
        warehouse = await this.create({
            name: 'Estoque Central',
            type: 'CENTRAL_WAREHOUSE',
            store: storeId,
            description: 'Estoque central / almoxarifado'
        });
    }

    return warehouse;
};

// Metodo estatico para obter/criar central compartilhado (sem store)
stockLocationSchema.statics.getOrCreateSharedCentralWarehouse = async function() {
    let warehouse = await this.findOne({
        type: 'CENTRAL_WAREHOUSE',
        store: null
    });

    if (!warehouse) {
        warehouse = await this.create({
            name: 'Estoque Central Compartilhado',
            type: 'CENTRAL_WAREHOUSE',
            store: null,
            description: 'Almoxarifado central do grupo — compartilhado entre todas as lojas'
        });
    }

    return warehouse;
};

module.exports = mongoose.model("StockLocation", stockLocationSchema);
