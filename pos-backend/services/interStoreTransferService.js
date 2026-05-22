/**
 * Inter-Store Transfer Service — Transferência entre lojas (Fase 5.1D)
 *
 * Fluxo:
 *   Validar orig/dest (type=STORE, stores diferentes) → validar item (compatibility, waste) →
 *   validar saldo → transação → decrementar origem → incrementar destino →
 *   criar movements transfer_out/in com metadata.transferScope='inter_store' → commit
 *
 * Princípios:
 * - Não modificar transferService existente (central→store)
 * - Apenas locations type=STORE
 * - Mesma loja = bloqueado
 * - Compatibilidade operacional obrigatória
 * - Transacional (atomic)
 * - Rastreabilidade completa
 */

const mongoose = require('mongoose');
const StockBalance = mongoose.model('StockBalance');
const StockMovement = mongoose.model('StockMovement');
const StockLocation = mongoose.model('StockLocation');
const GlobalIngredient = mongoose.model('GlobalIngredient');
const Store = mongoose.model('Store');

/**
 * Cria transferência inter-store entre duas lojas.
 *
 * @param {object} params
 * @param {string} params.originStoreId - ID da loja de origem
 * @param {string} params.destinationStoreId - ID da loja de destino
 * @param {string} params.originLocationId - ID da location de origem (type=STORE)
 * @param {string} params.destinationLocationId - ID da location de destino (type=STORE)
 * @param {string} params.ingredientId - ID do ingrediente
 * @param {number} params.quantity - Quantidade
 * @param {string} params.unit - Unidade
 * @param {string} params.reason - Motivo
 * @param {string} params.userId - ID do usuário
 * @returns {Promise<object>} Resultado da transferência
 */
const createInterStoreTransfer = async ({
    originStoreId,
    destinationStoreId,
    originLocationId,
    destinationLocationId,
    ingredientId,
    quantity,
    unit,
    reason,
    userId
}) => {
    if (!originStoreId || !destinationStoreId || !originLocationId || !destinationLocationId || !ingredientId) {
        throw new Error('Missing required fields: originStoreId, destinationStoreId, originLocationId, destinationLocationId, ingredientId');
    }
    if (!quantity || quantity <= 0) {
        throw new Error('Quantity must be a positive number');
    }

    if (originLocationId === destinationLocationId) {
        throw new Error('Origin and destination locations cannot be the same');
    }

    // Validar stores diferentes (inter-store, não intra-store)
    if (originStoreId.toString() === destinationStoreId.toString()) {
        throw new Error('Inter-store transfer requires different origin and destination stores. For same-store transfers, use the regular transfer endpoint.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Validar stores ativas
        const [originStore, destStore] = await Store.find({
            _id: { $in: [originStoreId, destinationStoreId] }
        }).session(session);

        if (!originStore || !destStore) {
            throw new Error('Origin or destination store not found');
        }
        if (!originStore.isActive) {
            throw new Error('Origin store is not active');
        }
        if (!destStore.isActive) {
            throw new Error('Destination store is not active');
        }

        // 2. Validar locations (type=STORE, ativas, pertencem às stores corretas)
        const [originLocation, destLocation] = await Promise.all([
            StockLocation.findById(originLocationId).session(session),
            StockLocation.findById(destinationLocationId).session(session)
        ]);

        if (!originLocation) {
            throw new Error('Origin location not found');
        }
        if (!destLocation) {
            throw new Error('Destination location not found');
        }
        if (originLocation.type !== 'STORE') {
            throw new Error(`Origin location must be type STORE, got ${originLocation.type}`);
        }
        if (destLocation.type !== 'STORE') {
            throw new Error(`Destination location must be type STORE, got ${destLocation.type}`);
        }
        if (originLocation.store.toString() !== originStoreId.toString()) {
            throw new Error('Origin location does not belong to the specified origin store');
        }
        if (destLocation.store.toString() !== destinationStoreId.toString()) {
            throw new Error('Destination location does not belong to the specified destination store');
        }
        if (!originLocation.isActive) {
            throw new Error('Origin location is not active');
        }
        if (!destLocation.isActive) {
            throw new Error('Destination location is not active');
        }

        // 3. Validar ingrediente
        const ingredient = await GlobalIngredient.findById(ingredientId).session(session);
        if (!ingredient) {
            throw new Error('Ingredient not found');
        }
        if (!ingredient.isActive) {
            throw new Error('Ingredient is not active');
        }

        // 4. Bloquear productionState = waste
        if (ingredient.productionState === 'waste') {
            throw new Error(`Cannot transfer items with productionState 'waste'. Ingredient: ${ingredient.name}`);
        }

        // 5. Validar compatibilidade operacional
        const destOperationType = destStore.operationType || 'geral';
        const compatibleOps = ingredient.compatibleOperations || ['geral'];

        if (!compatibleOps.includes('geral') && !compatibleOps.includes(destOperationType)) {
            throw new Error(
                `Ingredient '${ingredient.name}' is not compatible with destination store operation type '${destOperationType}'. ` +
                `Compatible operations: [${compatibleOps.join(', ')}]`
            );
        }

        // 6. Validar saldo na origem
        const originBalance = await StockBalance.findOne({
            location: originLocationId,
            ingredient: ingredientId
        }).session(session);

        if (!originBalance) {
            throw new Error('Stock balance not found at origin location');
        }
        if (originBalance.balance < quantity) {
            throw new Error(`Insufficient stock at origin. Available: ${originBalance.balance}, Requested: ${quantity}`);
        }

        // 7. Buscar ou criar saldo no destino
        let destBalance = await StockBalance.findOne({
            location: destinationLocationId,
            ingredient: ingredientId
        }).session(session);

        if (!destBalance) {
            const created = await StockBalance.create([{
                store: destinationStoreId,
                location: destinationLocationId,
                ingredient: ingredientId,
                balance: 0,
                reserved: 0,
                available: 0,
                unit: unit || originBalance.unit,
                minimumStock: 0,
                lastPurchasePrice: originBalance.lastPurchasePrice || 0
            }], { session });
            destBalance = created[0];
        }

        // 8. Executar transferência
        const effectiveUnit = unit || originBalance.unit;

        // Transfer out — decrementa origem
        const originBalanceBefore = originBalance.balance;
        originBalance.balance -= quantity;
        await originBalance.save({ session });

        const transferOutMovement = await StockMovement.create([{
            store: originStoreId,
            location: originLocationId,
            originLocation: originLocationId,
            destinationLocation: destinationLocationId,
            ingredient: ingredientId,
            type: 'transfer_out',
            quantity,
            unit: effectiveUnit,
            balanceBefore: originBalanceBefore,
            balanceAfter: originBalance.balance,
            reason,
            user: userId,
            metadata: {
                transferScope: 'inter_store',
                originStoreId: originStoreId.toString(),
                destinationStoreId: destinationStoreId.toString(),
                originStoreName: originStore.name,
                destinationStoreName: destStore.name,
                ingredientItemType: ingredient.itemType,
                ingredientProductionState: ingredient.productionState,
                ingredientIsByproduct: ingredient.isByproduct
            }
        }], { session });

        // Transfer in — incrementa destino
        const destBalanceBefore = destBalance.balance;
        destBalance.balance += quantity;
        await destBalance.save({ session });

        const transferInMovement = await StockMovement.create([{
            store: destinationStoreId,
            location: destinationLocationId,
            originLocation: originLocationId,
            destinationLocation: destinationLocationId,
            ingredient: ingredientId,
            type: 'transfer_in',
            quantity,
            unit: effectiveUnit,
            balanceBefore: destBalanceBefore,
            balanceAfter: destBalance.balance,
            reason,
            user: userId,
            metadata: {
                transferScope: 'inter_store',
                originStoreId: originStoreId.toString(),
                destinationStoreId: destinationStoreId.toString(),
                originStoreName: originStore.name,
                destinationStoreName: destStore.name,
                ingredientItemType: ingredient.itemType,
                ingredientProductionState: ingredient.productionState,
                ingredientIsByproduct: ingredient.isByproduct
            }
        }], { session });

        // 9. Commit
        await session.commitTransaction();

        return {
            success: true,
            origin: {
                storeId: originStoreId.toString(),
                storeName: originStore.name,
                locationId: originLocationId,
                locationName: originLocation.name,
                balanceBefore: originBalanceBefore,
                balanceAfter: originBalance.balance
            },
            destination: {
                storeId: destinationStoreId.toString(),
                storeName: destStore.name,
                locationId: destinationLocationId,
                locationName: destLocation.name,
                balanceBefore: destBalanceBefore,
                balanceAfter: destBalance.balance
            },
            ingredient: {
                id: ingredientId,
                name: ingredient.name,
                itemType: ingredient.itemType,
                productionState: ingredient.productionState,
                isByproduct: ingredient.isByproduct
            },
            compatibility: {
                destinationOperationType: destOperationType,
                ingredientCompatibleOperations: compatibleOps,
                isCompatible: true
            },
            quantity,
            unit: effectiveUnit,
            reason,
            movements: {
                transferOut: transferOutMovement[0]._id,
                transferIn: transferInMovement[0]._id
            },
            transferScope: 'inter_store'
        };

    } catch (error) {
        try {
            await session.abortTransaction();
        } catch (abortErr) {
            // Ignore abort errors
        }
        throw error;
    } finally {
        session.endSession();
    }
};

/**
 * Lista stores disponíveis para transferência inter-store.
 * Retorna stores ativas com operationType.
 */
const listAvailableStores = async () => {
    const stores = await Store.find({ isActive: true })
        .select('name operationType address')
        .sort({ name: 1 });

    return stores.map(s => ({
        id: s._id,
        name: s.name,
        operationType: s.operationType || 'geral',
        address: s.address
    }));
};

/**
 * Valida transferência inter-store sem executar.
 */
const validateInterStoreTransfer = async ({
    originStoreId,
    destinationStoreId,
    originLocationId,
    destinationLocationId,
    ingredientId,
    quantity
}) => {
    try {
        // Validar stores diferentes
        if (originStoreId.toString() === destinationStoreId.toString()) {
            return { valid: false, reason: 'Inter-store transfer requires different origin and destination stores' };
        }

        // Validar locations
        const [originLocation, destLocation] = await Promise.all([
            StockLocation.findById(originLocationId),
            StockLocation.findById(destinationLocationId)
        ]);

        if (!originLocation || originLocation.type !== 'STORE') {
            return { valid: false, reason: 'Origin location must be type STORE' };
        }
        if (!destLocation || destLocation.type !== 'STORE') {
            return { valid: false, reason: 'Destination location must be type STORE' };
        }

        // Validar ingrediente
        const ingredient = await GlobalIngredient.findById(ingredientId);
        if (!ingredient) {
            return { valid: false, reason: 'Ingredient not found' };
        }
        if (!ingredient.isActive) {
            return { valid: false, reason: 'Ingredient is not active' };
        }
        if (ingredient.productionState === 'waste') {
            return { valid: false, reason: 'Cannot transfer items with productionState waste' };
        }

        // Validar compatibilidade
        const destStore = await Store.findById(destinationStoreId);
        if (!destStore) {
            return { valid: false, reason: 'Destination store not found' };
        }

        const destOperationType = destStore.operationType || 'geral';
        const compatibleOps = ingredient.compatibleOperations || ['geral'];

        if (!compatibleOps.includes('geral') && !compatibleOps.includes(destOperationType)) {
            return {
                valid: false,
                reason: `Ingredient '${ingredient.name}' not compatible with operation type '${destOperationType}'`,
                destinationOperationType: destOperationType,
                ingredientCompatibleOperations: compatibleOps
            };
        }

        // Validar saldo
        const originBalance = await StockBalance.findOne({
            location: originLocationId,
            ingredient: ingredientId
        });

        if (!originBalance) {
            return { valid: false, reason: 'Stock balance not found at origin location' };
        }
        if (originBalance.balance < quantity) {
            return { valid: false, reason: `Insufficient stock. Available: ${originBalance.balance}, Requested: ${quantity}` };
        }

        return {
            valid: true,
            origin: { location: originLocation.name, store: originLocation.store },
            destination: { location: destLocation.name, store: destLocation.store },
            ingredient: ingredient.name,
            available: originBalance.balance,
            requested: quantity,
            unit: originBalance.unit,
            compatibility: { destinationOperationType: destOperationType, ingredientCompatibleOperations: compatibleOps }
        };
    } catch (error) {
        return { valid: false, reason: error.message };
    }
};

module.exports = {
    createInterStoreTransfer,
    listAvailableStores,
    validateInterStoreTransfer
};
