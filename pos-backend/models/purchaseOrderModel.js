const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const purchaseOrderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        default: uuidv4,
        unique: true,
        index: true,
        immutable: true
    },
    orderNumber: {
        type: String,
        required: true,
        index: true,
        comment: 'Número do pedido para referência'
    },
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: true,
        index: true
    },
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['draft', 'pending', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled'],
        default: 'draft',
        index: true
    },
    items: [{
        ingredient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'GlobalIngredient',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 0
        },
        unit: {
            type: String,
            required: true
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0
        },
        totalPrice: {
            type: Number,
            required: true,
            min: 0
        },
        receivedQuantity: {
            type: Number,
            default: 0,
            min: 0
        },
        notes: String
    }],
    subtotal: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    discount: {
        type: Number,
        default: 0,
        min: 0
    },
    shipping: {
        type: Number,
        default: 0,
        min: 0
    },
    total: {
        type: Number,
        required: true,
        default: 0
    },
    expectedDate: {
        type: Date,
        index: true
    },
    receivedDate: Date,
    paymentTerms: {
        days: Number,
        description: String
    },
    shippingAddress: {
        street: String,
        number: String,
        complement: String,
        neighborhood: String,
        city: String,
        state: String,
        zipCode: String
    },
    notes: {
        type: String,
        maxlength: 1000
    },
    internalNotes: {
        type: String,
        maxlength: 500,
        comment: 'Notas internas (não enviadas ao fornecedor)'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: Date,
    sentAt: Date,
    confirmedAt: Date,
    receivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    cancelledAt: Date,
    cancelledReason: String,
    sourceAlert: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StockAlert',
        comment: 'Alerta de estoque que originou o pedido'
    }
}, { timestamps: true });

// Índices compostos
purchaseOrderSchema.index({ store: 1, status: 1, createdAt: -1 });
purchaseOrderSchema.index({ store: 1, supplier: 1, createdAt: -1 });
purchaseOrderSchema.index({ expectedDate: 1, status: 1 });

// Virtual para verificar se está atrasado
purchaseOrderSchema.virtual('isLate').get(function() {
    return this.expectedDate &&
           this.expectedDate < new Date() &&
           !['received', 'cancelled'].includes(this.status);
});

// Virtual para quantidade pendente
purchaseOrderSchema.virtual('pendingQuantity').get(function() {
    return this.items.reduce((acc, item) => {
        return acc + (item.quantity - item.receivedQuantity);
    }, 0);
});

// Hook para calcular totais antes de salvar
purchaseOrderSchema.pre('save', function(next) {
    // Calcular subtotal
    this.subtotal = this.items.reduce((acc, item) => {
        return acc + item.totalPrice;
    }, 0);

    // Calcular total
    this.total = this.subtotal - this.discount + this.shipping;

    next();
});

// Método para atualizar status baseado nas quantidades recebidas
purchaseOrderSchema.methods.updateStatusFromReceipt = function() {
    const totalQuantity = this.items.reduce((acc, item) => acc + item.quantity, 0);
    const receivedQuantity = this.items.reduce((acc, item) => acc + item.receivedQuantity, 0);

    if (receivedQuantity === 0) {
        this.status = 'sent';
    } else if (receivedQuantity >= totalQuantity) {
        this.status = 'received';
        this.receivedDate = new Date();
    } else {
        this.status = 'partially_received';
    }

    return this.save();
};

// Método para adicionar item
purchaseOrderSchema.methods.addItem = function(ingredientId, quantity, unit, unitPrice) {
    const existingItem = this.items.find(item =>
        item.ingredient.toString() === ingredientId.toString()
    );

    if (existingItem) {
        existingItem.quantity += quantity;
        existingItem.totalPrice = existingItem.quantity * unitPrice;
        existingItem.unitPrice = unitPrice;
    } else {
        this.items.push({
            ingredient: ingredientId,
            quantity,
            unit,
            unitPrice,
            totalPrice: quantity * unitPrice
        });
    }

    return this.save();
};

// Método para remover item
purchaseOrderSchema.methods.removeItem = function(itemId) {
    const index = this.items.findIndex(item => item._id.toString() === itemId.toString());
    if (index !== -1) {
        this.items.splice(index, 1);
    }
    return this.save();
};

// Método para enviar pedido
purchaseOrderSchema.methods.send = function() {
    if (this.status !== 'draft' && this.status !== 'pending') {
        throw new Error(`Cannot send order with status: ${this.status}`);
    }
    if (this.items.length === 0) {
        throw new Error('Cannot send order with no items');
    }

    this.status = 'sent';
    this.sentAt = new Date();
    return this.save();
};

// Método para confirmar pedido
purchaseOrderSchema.methods.confirm = function() {
    if (this.status !== 'sent') {
        throw new Error(`Cannot confirm order with status: ${this.status}`);
    }

    this.status = 'confirmed';
    this.confirmedAt = new Date();
    return this.save();
};

// Método para receber itens
purchaseOrderSchema.methods.receiveItems = async function(items, receivedBy) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        for (const item of items) {
            const orderItem = this.items.find(i => i._id.toString() === item.itemId.toString());
            if (!orderItem) {
                throw new Error(`Item not found: ${item.itemId}`);
            }

            orderItem.receivedQuantity = (orderItem.receivedQuantity || 0) + item.quantity;

            // Atualizar estoque
            const StockBalance = mongoose.model('StockBalance');
            const StockMovement = mongoose.model('StockMovement');

            let stockBalance = await StockBalance.findOne({
                store: this.store,
                ingredient: orderItem.ingredient
            }).session(session);

            if (!stockBalance) {
                const ingredient = await mongoose.model('GlobalIngredient').findById(orderItem.ingredient);
                stockBalance = await StockBalance.create([{
                    store: this.store,
                    ingredient: orderItem.ingredient,
                    balance: 0,
                    reserved: 0,
                    available: 0,
                    unit: ingredient?.baseUnit || orderItem.unit,
                    minimumStock: 0
                }], { session });
                stockBalance = stockBalance[0];
            }

            const balanceBefore = stockBalance.balance;
            stockBalance.balance += item.quantity;
            stockBalance.lastPurchasePrice = orderItem.unitPrice;
            stockBalance.lastPurchaseDate = new Date();
            await stockBalance.save({ session });

            // Criar movimento de estoque
            await StockMovement.create([{
                store: this.store,
                ingredient: orderItem.ingredient,
                type: 'in',
                quantity: item.quantity,
                unit: orderItem.unit,
                balanceBefore,
                balanceAfter: stockBalance.balance,
                reason: `Purchase Order #${this.orderNumber}`,
                user: receivedBy,
                metadata: {
                    purchaseOrderId: this._id,
                    unitPrice: orderItem.unitPrice
                }
            }], { session });
        }

        this.receivedBy = receivedBy;
        await this.updateStatusFromReceipt();

        await session.commitTransaction();
        return this;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

// Método para cancelar pedido
purchaseOrderSchema.methods.cancel = function(reason) {
    if (['received', 'cancelled'].includes(this.status)) {
        throw new Error(`Cannot cancel order with status: ${this.status}`);
    }

    this.status = 'cancelled';
    this.cancelledAt = new Date();
    this.cancelledReason = reason;
    return this.save();
};

// Método estático para criar a partir de alerta
purchaseOrderSchema.statics.createFromAlert = async function(alertId, userId) {
    const StockAlert = mongoose.model('StockAlert');
    const alert = await StockAlert.findById(alertId).populate('ingredient');

    if (!alert) {
        throw new Error('Alert not found');
    }

    const supplier = alert.ingredient?.supplier;
    if (!supplier) {
        throw new Error('Ingredient has no default supplier');
    }

    const orderNumber = `PO-${Date.now()}`;

    const order = await this.create({
        orderNumber,
        store: alert.store,
        supplier,
        status: 'draft',
        items: [{
            ingredient: alert.ingredient._id,
            quantity: alert.suggestedQuantity || alert.minimumStock * 3,
            unit: alert.ingredient.unit || 'un',
            unitPrice: 0,
            totalPrice: 0
        }],
        createdBy: userId,
        sourceAlert: alertId,
        notes: `Generated from stock alert: ${alert.type}`
    });

    return order;
};

// Método estático para obter pedidos por loja
purchaseOrderSchema.statics.getStoreOrders = async function(storeId, options = {}) {
    const filter = { store: storeId };

    if (options.status) {
        filter.status = options.status;
    }
    if (options.supplier) {
        filter.supplier = options.supplier;
    }

    return this.find(filter)
        .populate('supplier', 'name tradeName')
        .populate('items.ingredient', 'name category')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });
};

module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema);
