const mongoose = require("mongoose");

/**
 * Modelo de Divisao de Conta (Split Bill)
 *
 * Registra como a conta de uma mesa foi dividida entre pessoas
 * e como cada pessoa pagou sua parte.
 *
 * Prompt D — Divisao de Conta (adaptacao para mercado brasileiro)
 */

const paymentItemSchema = new mongoose.Schema({
    orderItem: {
        type: mongoose.Schema.Types.ObjectId,
        comment: 'ID do item do pedido associado a este pagamento (para split por item)'
    },
    productName: { type: String },
    quantity: { type: Number, default: 1 },
    amount: { type: Number, required: true, min: 0, comment: 'Valor em reais atribuido a esta pessoa para este item' }
}, { _id: false });

const paymentSchema = new mongoose.Schema({
    personName: {
        type: String,
        required: true,
        trim: true,
        comment: 'Nome da pessoa responsavel por este pagamento'
    },
    value: {
        type: Number,
        required: true,
        min: 0.01,
        comment: 'Valor total que esta pessoa vai pagar (soma dos seus itens)'
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['Dinheiro', 'Pix', 'Debito', 'Credito', 'Voucher'],
        comment: 'Forma de pagamento desta pessoa'
    },
    items: [paymentItemSchema],
    paidAt: {
        type: Date,
        comment: 'Timestamp do pagamento efetivo'
    },
    status: {
        type: String,
        enum: ['pending', 'paid', 'cancelled'],
        default: 'pending'
    }
}, { _id: true });

const paymentSplitSchema = new mongoose.Schema({
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: true,
        index: true
    },
    table: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Table',
        required: true,
        index: true,
        comment: 'Mesa onde a divisao foi realizada'
    },
    orders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        comment: 'Pedidos da mesa que foram divididos'
    }],
    splitType: {
        type: String,
        enum: ['equal', 'by_item', 'custom'],
        required: true,
        comment: 'Tipo de divisao: equal (igual), by_item (por item), custom'
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0,
        comment: 'Valor total da conta (soma de todos os pedidos)'
    },
    guestsCount: {
        type: Number,
        required: true,
        min: 1,
        comment: 'Numero de pessoas na divisao'
    },
    payments: [paymentSchema],
    status: {
        type: String,
        enum: ['draft', 'confirmed', 'fully_paid', 'partially_paid', 'cancelled'],
        default: 'draft',
        index: true
    },
    notes: {
        type: String,
        maxlength: 500,
        default: '',
        comment: 'Observacoes sobre a divisao'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        comment: 'Quem criou a divisao'
    }
}, { timestamps: true });

// Indexes para busca eficiente
paymentSplitSchema.index({ store: 1, table: 1, status: 1 });
paymentSplitSchema.index({ store: 1, createdAt: -1 });

// Virtual: soma dos pagamentos pagos
paymentSplitSchema.virtual('paidAmount').get(function() {
    return this.payments
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + (p.value || 0), 0);
});

// Virtual: diferenca entre total e pago
paymentSplitSchema.virtual('remainingAmount').get(function() {
    return this.totalAmount - this.paidAmount;
});

// Metodo estatico: calcular divisao igual entre N pessoas
paymentSplitSchema.statics.calculateEqualSplit = function(totalAmount, guestsCount, items = []) {
    if (guestsCount <= 0) throw new Error('Numero de pessoas deve ser maior que zero');

    const perPerson = Math.round((totalAmount / guestsCount) * 100) / 100; // 2 casas decimais
    const payments = [];

    for (let i = 0; i < guestsCount; i++) {
        // Diferenca de arredondamento vai para a ultima pessoa
        const isLast = i === guestsCount - 1;
        const paidSoFar = perPerson * i;
        const amount = isLast
            ? Math.round((totalAmount - paidSoFar) * 100) / 100
            : perPerson;

        payments.push({
            personName: `Pessoa ${i + 1}`,
            value: amount,
            paymentMethod: 'Dinheiro', // Default, pode ser alterado
            items: [], // Divisao igual nao atribui itens especificos
            status: 'pending'
        });
    }

    return payments;
};

// Metodo estatico: calcular divisao por itens
paymentSplitSchema.statics.calculateItemSplit = function(items, assignments) {
    // assignments: { itemId: personName, ... }
    // Primeiro, extrair nomes únicos das pessoas
    const personNames = [...new Set(Object.values(assignments))];
    const personPayments = {};

    // Inicializar pagamentos por pessoa
    personNames.forEach(personName => {
        personPayments[personName] = {
            personName,
            value: 0,
            paymentMethod: 'Dinheiro',
            items: [],
            status: 'pending'
        };
    });

    // Atribuir itens as pessoas
    items.forEach(item => {
        // Aceitar tanto itemId (nome esperado) quanto _id (fallback para documentos Mongoose)
        const itemId = item.itemId || item._id;
        const assignedPerson = assignments[itemId];
        if (!assignedPerson) return; // Item nao atribuido

        if (!personPayments[assignedPerson]) {
            personPayments[assignedPerson] = {
                personName: assignedPerson,
                value: 0,
                paymentMethod: 'Dinheiro',
                items: [],
                status: 'pending'
            };
        }

        const itemAmount = (item.price || 0) * (item.quantity || 1);
        personPayments[assignedPerson].value += itemAmount;
        personPayments[assignedPerson].items.push({
            orderItem: item._id || item.itemId,
            productName: item.name || item.productName,
            quantity: item.quantity || 1,
            amount: itemAmount
        });
    });

    // Arredondar valores para 2 casas decimais
    return Object.values(personPayments).map(p => ({
        ...p,
        value: Math.round(p.value * 100) / 100
    }));
};

module.exports = mongoose.model("PaymentSplit", paymentSplitSchema);
