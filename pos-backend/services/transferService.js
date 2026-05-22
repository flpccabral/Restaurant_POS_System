/**
 * Transfer Service - Transferencia de Estoque Central → Loja
 *
 * Funcionalidades:
 * - Transferencia atomica com MongoDB transactions
 * - Suporte a estoque central compartilhado (store = null)
 * - Validacao de saldo na origem
 * - Criacao de movimentacoes duplas (transfer_out + transfer_in)
 * - Historico de transferencias
 */

const mongoose = require('mongoose');
const StockBalance = mongoose.model('StockBalance');
const StockMovement = mongoose.model('StockMovement');
const StockLocation = mongoose.model('StockLocation');

/**
 * Realiza transferencia de estoque entre localizacoes
 * Suporta origem de estoque central compartilhado (store = null).
 * @param {Object} params
 * @param {string} [params.storeId] - ID da loja de destino (tenant)
 * @param {string} params.originLocationId - ID da localizacao de origem
 * @param {string} params.destinationLocationId - ID da localizacao de destino
 * @param {string} params.ingredientId - ID do ingrediente
 * @param {number} params.quantity - Quantidade a transferir
 * @param {string} params.unit - Unidade de medida
 * @param {string} params.reason - Motivo da transferencia
 * @param {string} params.userId - ID do usuario responsavel
 * @returns {Promise<Object>} - Resultado da transferencia
 */
const createTransfer = async ({
    storeId,
    originLocationId,
    destinationLocationId,
    ingredientId,
    quantity,
    unit,
    reason,
    userId
}) => {
    if (!originLocationId || !destinationLocationId || !ingredientId) {
        throw new Error('Missing required fields');
    }
    if (!quantity || quantity <= 0) {
        throw new Error('Quantity must be a positive number');
    }

    if (originLocationId === destinationLocationId) {
        throw new Error('Origin and destination cannot be the same');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Validar localizacoes
        const [originLocation, destLocation] = await Promise.all([
            StockLocation.findById(originLocationId),
            StockLocation.findById(destinationLocationId)
        ]);

        if (!originLocation) {
            throw new Error('Origin location not found');
        }
        if (!destLocation) {
            throw new Error('Destination location not found');
        }

        // Central compartilhado (store = null) pode transferir para qualquer loja
        const originIsSharedCentral = originLocation.type === 'CENTRAL_WAREHOUSE' && !originLocation.store;

        if (!originIsSharedCentral) {
            // Central dedicado ou store: validar tenant
            if (storeId && originLocation.store && originLocation.store.toString() !== storeId.toString()) {
                throw new Error('Origin location does not belong to this store');
            }
        }

        // Destino deve ter store (tipo STORE exige store)
        if (!destLocation.store) {
            throw new Error('Destination location must have a store reference');
        }
        if (storeId && destLocation.store.toString() !== storeId.toString()) {
            throw new Error('Destination location does not belong to this store');
        }

        // transfer_out herda a store do destino para rastreabilidade
        const transferStoreId = originLocation.store?.toString() || destLocation.store.toString();

        // 2. Buscar saldo na origem (sem filtro de store — central compartilhado nao tem)
        const originBalance = await StockBalance.findOne({
            location: originLocationId,
            ingredient: ingredientId
        }).session(session);

        if (!originBalance) {
            throw new Error('Stock balance not found at origin location');
        }

        // 3. Validar saldo suficiente
        if (originBalance.balance < quantity) {
            throw new Error(`Insufficient stock at origin. Available: ${originBalance.balance}, Requested: ${quantity}`);
        }

        // 4. Buscar ou criar saldo no destino
        let destBalance = await StockBalance.findOne({
            location: destinationLocationId,
            ingredient: ingredientId
        }).session(session);

        if (!destBalance) {
            destBalance = await StockBalance.create([{
                store: destLocation.store,
                location: destinationLocationId,
                ingredient: ingredientId,
                balance: 0,
                reserved: 0,
                available: 0,
                unit: unit || originBalance.unit,
                minimumStock: 0,
                lastPurchasePrice: originBalance.lastPurchasePrice || 0
            }], { session });
            destBalance = destBalance[0];
        }

        // 5. Criar movimentacao de saida (transfer_out)
        const originBalanceBefore = originBalance.balance;
        originBalance.balance -= quantity;
        await originBalance.save({ session });

        const transferOutMovement = await StockMovement.create([{
            store: transferStoreId,
            location: originLocationId,
            originLocation: originLocationId,
            destinationLocation: destinationLocationId,
            ingredient: ingredientId,
            type: 'transfer_out',
            quantity,
            unit: unit || originBalance.unit,
            balanceBefore: originBalanceBefore,
            balanceAfter: originBalance.balance,
            reason,
            user: userId
        }], { session });

        // 6. Criar movimentacao de entrada (transfer_in)
        const destBalanceBefore = destBalance.balance;
        destBalance.balance += quantity;
        await destBalance.save({ session });

        const transferInMovement = await StockMovement.create([{
            store: destLocation.store.toString(),
            location: destinationLocationId,
            originLocation: originLocationId,
            destinationLocation: destinationLocationId,
            ingredient: ingredientId,
            type: 'transfer_in',
            quantity,
            unit: unit || destBalance.unit,
            balanceBefore: destBalanceBefore,
            balanceAfter: destBalance.balance,
            reason,
            user: userId
        }], { session });

        // 7. Commit da transacao
        await session.commitTransaction();
        session.endSession();

        return {
            success: true,
            transferId: transferOutMovement[0]._id,
            origin: {
                locationId: originLocationId,
                locationName: originLocation.name,
                locationType: originLocation.type,
                isSharedCentral: originIsSharedCentral,
                balanceBefore: originBalanceBefore,
                balanceAfter: originBalance.balance
            },
            destination: {
                locationId: destinationLocationId,
                locationName: destLocation.name,
                storeId: destLocation.store.toString(),
                balanceBefore: destBalanceBefore,
                balanceAfter: destBalance.balance
            },
            ingredient: ingredientId,
            quantity,
            unit: unit || originBalance.unit,
            reason,
            movements: {
                transferOut: transferOutMovement[0]._id,
                transferIn: transferInMovement[0]._id
            }
        };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

/**
 * Obtem historico de transferencias
 * Inclui transferencias de central compartilhado (store = null) quando a loja e destino.
 */
const getTransferHistory = async (storeId, options = {}) => {
    const { locationId, ingredientId, startDate, endDate, limit = 50 } = options;

    // Incluir movements da store E movements de central compartilhado que tem esta store como destino
    const filter = {
        $or: [
            { store: storeId },
            { store: null, destinationLocation: { $ne: null } }
        ],
        type: { $in: ['transfer_out', 'transfer_in'] }
    };

    if (locationId) {
        filter.$or = [
            { originLocation: mongoose.Types.ObjectId(locationId) },
            { destinationLocation: mongoose.Types.ObjectId(locationId) }
        ];
    }
    if (ingredientId) {
        filter.ingredient = ingredientId;
    }
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const movements = await StockMovement.find(filter)
        .populate('ingredient', 'name category unit')
        .populate('originLocation', 'name type store')
        .populate('destinationLocation', 'name type store')
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit);

    // Agrupar por par de transferencias
    const transfers = [];
    const transferOutMap = new Map();

    for (const movement of movements) {
        if (movement.type === 'transfer_out') {
            transferOutMap.set(movement._id.toString(), {
                transferOut: movement,
                transferIn: null,
                origin: movement.originLocation,
                destination: movement.destinationLocation
            });
        } else if (movement.type === 'transfer_in') {
            const originKey = movement.originLocation?._id?.toString();
            const destKey = movement.destinationLocation?._id?.toString();
            const ingredientKey = movement.ingredient?._id?.toString();

            for (const [key, transfer] of transferOutMap) {
                const outOrigin = transfer.transferOut.originLocation?._id?.toString();
                const outDest = transfer.transferOut.destinationLocation?._id?.toString();
                const outIngredient = transfer.transferOut.ingredient?._id?.toString();

                if (outOrigin === originKey && outDest === destKey && outIngredient === ingredientKey) {
                    const timeDiff = Math.abs(
                        new Date(movement.createdAt) - new Date(transfer.transferOut.createdAt)
                    );
                    if (timeDiff < 60000) {
                        transfer.transferIn = movement;
                        break;
                    }
                }
            }
        }
    }

    for (const [key, transfer] of transferOutMap) {
        transfers.push(transfer);
    }

    return transfers.sort((a, b) =>
        new Date(b.transferOut.createdAt) - new Date(a.transferOut.createdAt)
    );
};

/**
 * Valida se uma transferencia e possivel (sem executar)
 */
const validateTransfer = async (storeId, originLocationId, ingredientId, quantity) => {
    // Buscar por location apenas (central compartilhado nao tem store)
    const originBalance = await StockBalance.findOne({
        location: originLocationId,
        ingredient: ingredientId
    }).populate('ingredient', 'name unit')
      .populate('location', 'name type store');

    if (!originBalance) {
        return {
            valid: false,
            reason: 'Stock balance not found at origin location',
            available: 0,
            requested: quantity
        };
    }

    const hasStock = originBalance.balance >= quantity;

    return {
        valid: hasStock,
        reason: hasStock ? null : `Insufficient stock. Available: ${originBalance.balance}, Requested: ${quantity}`,
        available: originBalance.balance,
        requested: quantity,
        unit: originBalance.unit,
        ingredient: originBalance.ingredient?.name,
        originLocation: originBalance.location?.name,
        originType: originBalance.location?.type,
        isSharedCentral: originBalance.location?.type === 'CENTRAL_WAREHOUSE' && !originBalance.location?.store
    };
};

module.exports = {
    createTransfer,
    getTransferHistory,
    validateTransfer
};
