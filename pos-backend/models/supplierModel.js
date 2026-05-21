const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const supplierSchema = new mongoose.Schema({
    supplierId: {
        type: String,
        default: uuidv4,
        unique: true,
        index: true,
        immutable: true
    },
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
    tradeName: {
        type: String,
        trim: true
    },
    document: {
        type: String,
        uppercase: true,
        trim: true,
        comment: 'CNPJ ou CPF do fornecedor'
    },
    contact: {
        name: String,
        email: String,
        phone: String,
        cellPhone: String
    },
    address: {
        street: String,
        number: String,
        complement: String,
        neighborhood: String,
        city: String,
        state: String,
        zipCode: String,
        country: {
            type: String,
            default: 'Brasil'
        }
    },
    bankInfo: {
        bank: String,
        agency: String,
        account: String,
        accountType: {
            type: String,
            enum: ['checking', 'savings']
        }
    },
    paymentTerms: {
        defaultDays: {
            type: Number,
            default: 30,
            min: 0
        },
        discountDays: {
            type: Number,
            default: 0
        },
        discountPercent: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        }
    },
    categories: [{
        type: String,
        enum: ['proteina', 'laticinio', 'panificacao', 'hortifruti', 'bebidas', 'temperos', 'embalagens', 'limpeza', 'outros']
    }],
    rating: {
        type: Number,
        min: 1,
        max: 5,
        default: 3,
        comment: 'Avaliação do fornecedor (1-5)'
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    notes: {
        type: String,
        maxlength: 1000
    }
}, { timestamps: true });

// Índices
supplierSchema.index({ store: 1, name: 1 });
supplierSchema.index({ store: 1, isActive: 1 });
supplierSchema.index({ document: 1 }, { sparse: true });

// Virtual para nome completo
supplierSchema.virtual('fullName').get(function() {
    return this.tradeName || this.name;
});

// Método para obter ingredientes fornecidos
supplierSchema.methods.getSuppliedIngredients = async function() {
    const StockBalance = mongoose.model('StockBalance');
    return StockBalance.find({ store: this.store, supplier: this._id })
        .populate('ingredient', 'name category');
};

// Método para calcular valor total em compras
supplierSchema.methods.getTotalPurchases = async function() {
    const PurchaseOrder = mongoose.model('PurchaseOrder');
    const result = await PurchaseOrder.aggregate([
        { $match: { supplier: this._id, status: 'received' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    return result[0]?.total || 0;
};

module.exports = mongoose.model("Supplier", supplierSchema);
