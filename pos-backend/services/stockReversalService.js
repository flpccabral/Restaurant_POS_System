/**
 * Stock Reversal Service — Reversão operacional de baixa por venda (Fase 5.5)
 *
 * Fluxo:
 *   Cancelamento/Refund → localizar movements recipe_deduction → devolver saldo →
 *   criar movements recipe_deduction_reversal → atualizar Order → commit
 *
 * Princípios:
 * - Nunca apagar movimentos originais
 * - Reversão no mesmo estoque local da loja
 * - Transacional (atomic: tudo ou nada)
 * - Impedir dupla reversão
 * - Rastreabilidade completa
 */

const mongoose = require('mongoose');
const StockBalance = require('../models/stockBalanceModel');
const StockMovement = require('../models/stockMovementModel');
const StockLocation = require('../models/stockLocationModel');
const Order = require('../models/orderModel');

/**
 * Reverte a baixa de estoque de um pedido.
 *
 * @param {object} params
 * @param {string} params.orderId - ID do pedido
 * @param {string} params.reason - Motivo da reversão
 * @param {string} params.userId - ID do usuário responsável
 * @param {object} [params.session] - MongoDB session (transação externa)
 * @returns {Promise<object>} Resultado com movimentos reversos criados
 */
const reverseOrderStockDeduction = async ({ orderId, reason, userId, session }) => {
    const ownSession = !session;
    if (ownSession) {
        session = await mongoose.startSession();
        session.startTransaction();
    }

    try {
        // 1. Buscar pedido
        const order = await Order.findById(orderId).session(session);
        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }

        // 2. Validar que ainda não foi revertido
        if (order.stockReversalStatus === 'reversed') {
            throw new Error(`Order ${orderId} stock deduction has already been reversed. Reversal date: ${order.stockReversedAt}`);
        }

        // 3. Validar elegibilidade
        if (order.stockDeductionStatus === 'pending' || order.stockDeductionStatus === 'no_recipes') {
            throw new Error(`Cannot reverse order with stockDeductionStatus=${order.stockDeductionStatus}: no stock was deducted`);
        }

        // 4. Localizar movimentos recipe_deduction vinculados ao pedido
        const originalMovements = await StockMovement.find({
            reference: order._id.toString(),
            type: 'recipe_deduction'
        }).session(session);

        if (originalMovements.length === 0) {
            throw new Error(`No recipe_deduction movements found for order ${orderId}. Cannot reverse.`);
        }

        const reversalMovements = [];
        const reversalMovementIds = [];

        // 5. Para cada movimento original, criar movimento reverso e devolver saldo
        for (const origMov of originalMovements) {
            const stockBalance = await StockBalance.findById(origMov.location ?
                (await StockBalance.findOne({ location: origMov.location, ingredient: origMov.ingredient }).session(session))?._id
                : null
            ).session(session);

            // Buscar saldo por location + ingredient
            let balance = await StockBalance.findOne({
                location: origMov.location,
                ingredient: origMov.ingredient
            }).session(session);

            if (!balance) {
                // Se o saldo não existe mais (improvável), recriar
                balance = await StockBalance.create([{
                    store: order.store,
                    location: origMov.location,
                    ingredient: origMov.ingredient,
                    balance: 0,
                    reserved: 0,
                    available: 0,
                    unit: origMov.unit,
                    minimumStock: 0,
                    lastPurchasePrice: 0
                }], { session });
                balance = balance[0];
            }

            const balanceBefore = balance.balance;
            balance.balance += origMov.quantity;
            await balance.save({ session });

            // Criar movimento reverso
            const reversalMov = await StockMovement.create([{
                store: order.store,
                location: origMov.location,
                ingredient: origMov.ingredient,
                type: 'recipe_deduction_reversal',
                quantity: origMov.quantity,
                unit: origMov.unit,
                balanceBefore,
                balanceAfter: balance.balance,
                reason: `Reversão de baixa por cancelamento/estorno — ${reason}`,
                reference: order._id.toString(),
                recipe: origMov.recipe,
                product: origMov.product,
                reversalOf: origMov._id,
                user: userId,
                metadata: {
                    reversalType: 'order_stock_reversal',
                    originalMovementId: origMov._id.toString(),
                    originalBalanceBefore: origMov.balanceBefore,
                    originalBalanceAfter: origMov.balanceAfter,
                    orderId: order._id.toString(),
                    orderNumber: order.orderNumber,
                    reason,
                    stockReversal: 'automatic_reversal'
                }
            }], { session });

            reversalMovements.push(reversalMov[0]);
            reversalMovementIds.push(reversalMov[0]._id);
        }

        // 6. Atualizar pedido com status de reversão
        order.stockDeductionStatus = 'pending';
        order.stockReversalStatus = 'reversed';
        order.stockReversedAt = new Date();
        order.stockReversalReason = reason;
        order.stockReversalMovements = reversalMovementIds;

        // Atualizar itens revertidos
        for (const item of order.items) {
            if (item.stockDeductionStatus === 'deducted') {
                item.stockDeductionStatus = 'pending';
                item.stockReversalStatus = 'reversed';
                item.stockReversalMovements = reversalMovementIds;
            }
        }

        await order.save({ session });

        // Commit se session própria
        if (ownSession) {
            await session.commitTransaction();
        }

        // Retornar resultado populado
        return {
            success: true,
            orderId: order._id,
            orderNumber: order.orderNumber,
            reversalMovements: reversalMovements.map(m => m.toObject()),
            originalMovementCount: originalMovements.length,
            reversalReason: reason,
            reversedAt: order.stockReversedAt
        };

    } catch (error) {
        if (ownSession) {
            try {
                await session.abortTransaction();
            } catch (abortErr) {
                // Ignore abort errors
            }
        }
        throw error;
    } finally {
        if (ownSession) {
            session.endSession();
        }
    }
};

/**
 * Cancela um pedido operacionalmente (altera status + reverte estoque se aplicável).
 *
 * @param {object} params
 * @param {string} params.orderId - ID do pedido
 * @param {string} params.reason - Motivo do cancelamento
 * @param {string} params.userId - ID do usuário responsável
 * @returns {Promise<object>} Pedido atualizado
 */
const cancelOrder = async ({ orderId, reason, userId }) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const order = await Order.findById(orderId).session(session);
        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }

        if (order.orderStatus === 'cancelled') {
            throw new Error(`Order ${orderId} is already cancelled`);
        }

        // Se pedido tinha baixa de estoque, reverter
        let reversalResult = null;
        if (order.stockDeductionStatus === 'completed' || order.stockDeductionStatus === 'partial') {
            reversalResult = await reverseOrderStockDeduction({
                orderId,
                reason,
                userId,
                session
            });
        }

        // Atualizar status do pedido
        order.orderStatus = 'cancelled';
        await order.save({ session });

        await session.commitTransaction();

        return {
            success: true,
            order: order.toObject(),
            stockReversed: reversalResult !== null,
            reversalResult
        };

    } catch (error) {
        try {
            await session.abortTransaction();
        } catch (abortErr) {
            // Ignore
        }
        throw error;
    } finally {
        session.endSession();
    }
};

module.exports = {
    reverseOrderStockDeduction,
    cancelOrder
};
