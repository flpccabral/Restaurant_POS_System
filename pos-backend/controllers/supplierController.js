const createHttpError = require("http-errors");
const Supplier = require("../models/supplierModel");
const SessionLog = require("../models/sessionLogModel");

/**
 * Listar fornecedores
 */
const getSuppliers = async (req, res, next) => {
    try {
        const { isActive, category, search } = req.query;
        const filter = {};

        // Aplicar store isolation
        if (!req.user.isMasterAdmin) {
            filter.store = req.user.store;
        } else if (req.storeId) {
            filter.store = req.storeId;
        }

        // Filtros opcionais
        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        if (category) {
            filter.categories = category;
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { tradeName: { $regex: search, $options: 'i' } },
                { 'contact.name': { $regex: search, $options: 'i' } }
            ];
        }

        const suppliers = await Supplier.find(filter)
            .sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: suppliers.length,
            data: suppliers
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter fornecedor por ID
 */
const getSupplierById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const supplier = await Supplier.findById(id);

        if (!supplier) {
            const error = createHttpError(404, "Supplier not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && supplier.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Supplier belongs to different store!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            data: supplier
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Criar fornecedor
 */
const createSupplier = async (req, res, next) => {
    try {
        const {
            name, tradeName, document, contact, address, bankInfo,
            paymentTerms, categories, rating, notes
        } = req.body;

        // Validação de campos obrigatórios
        if (!name) {
            const error = createHttpError(400, "Name is required!");
            return next(error);
        }

        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Verificar documento duplicado
        if (document) {
            const existing = await Supplier.findOne({
                store: storeRef,
                document
            });

            if (existing) {
                const error = createHttpError(400, "Supplier with this document already exists!");
                return next(error);
            }
        }

        const supplier = await Supplier.create({
            store: storeRef,
            name,
            tradeName,
            document,
            contact,
            address,
            bankInfo,
            paymentTerms,
            categories,
            rating,
            notes
        });

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'supplier_created',
            metadata: { supplierName: supplier.name }
        });

        res.status(201).json({
            success: true,
            message: "Supplier created successfully!",
            data: supplier
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar fornecedor
 */
const updateSupplier = async (req, res, next) => {
    try {
        const { id } = req.params;

        const supplier = await Supplier.findById(id);

        if (!supplier) {
            const error = createHttpError(404, "Supplier not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && supplier.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Supplier belongs to different store!");
            return next(error);
        }

        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Verificar documento duplicado (se alterado)
        if (req.body.document && req.body.document !== supplier.document) {
            const existing = await Supplier.findOne({
                store: storeRef,
                document: req.body.document,
                _id: { $ne: id }
            });

            if (existing) {
                const error = createHttpError(400, "Supplier with this document already exists!");
                return next(error);
            }
        }

        // Atualizar campos
        const updateableFields = [
            'name', 'tradeName', 'document', 'contact', 'address',
            'bankInfo', 'paymentTerms', 'categories', 'rating',
            'isActive', 'notes'
        ];

        for (const field of updateableFields) {
            if (req.body[field] !== undefined) {
                supplier[field] = req.body[field];
            }
        }

        await supplier.save();

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'supplier_updated',
            metadata: { supplierName: supplier.name }
        });

        res.status(200).json({
            success: true,
            message: "Supplier updated successfully!",
            data: supplier
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Ativar/Desativar fornecedor
 */
const toggleSupplierStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        const supplier = await Supplier.findById(id);

        if (!supplier) {
            const error = createHttpError(404, "Supplier not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && supplier.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Supplier belongs to different store!");
            return next(error);
        }

        supplier.isActive = isActive;
        await supplier.save();

        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'supplier_status_changed',
            metadata: {
                supplierName: supplier.name,
                isActive: supplier.isActive
            }
        });

        res.status(200).json({
            success: true,
            message: `Supplier ${isActive ? 'activated' : 'deactivated'} successfully!`,
            data: supplier
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Deletar fornecedor
 */
const deleteSupplier = async (req, res, next) => {
    try {
        const { id } = req.params;

        const supplier = await Supplier.findById(id);

        if (!supplier) {
            const error = createHttpError(404, "Supplier not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && supplier.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Supplier belongs to different store!");
            return next(error);
        }

        // Verificar se tem pedidos de compra
        const PurchaseOrder = mongoose.model('PurchaseOrder');
        const orderCount = await PurchaseOrder.countDocuments({ supplier: id });

        if (orderCount > 0) {
            const error = createHttpError(400, "Cannot delete supplier with existing purchase orders!");
            return next(error);
        }

        await Supplier.findByIdAndDelete(id);

        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'supplier_deleted',
            metadata: { supplierName: supplier.name }
        });

        res.status(200).json({
            success: true,
            message: "Supplier deleted successfully!"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter estatísticas de fornecedor
 */
const getSupplierStats = async (req, res, next) => {
    try {
        const { id } = req.params;

        const supplier = await Supplier.findById(id);

        if (!supplier) {
            const error = createHttpError(404, "Supplier not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && supplier.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Supplier belongs to different store!");
            return next(error);
        }

        const PurchaseOrder = mongoose.model('PurchaseOrder');

        // Contar pedidos
        const totalOrders = await PurchaseOrder.countDocuments({ supplier: id });
        const pendingOrders = await PurchaseOrder.countDocuments({
            supplier: id,
            status: { $in: ['pending', 'sent', 'confirmed'] }
        });

        // Calcular valor total
        const orders = await PurchaseOrder.find({
            supplier: id,
            status: 'received'
        }).select('total');

        const totalPurchases = orders.reduce((acc, order) => acc + order.total, 0);

        res.status(200).json({
            success: true,
            data: {
                totalOrders,
                pendingOrders,
                totalPurchases,
                averageOrderValue: totalOrders > 0 ? totalPurchases / totalOrders : 0
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    toggleSupplierStatus,
    deleteSupplier,
    getSupplierStats
};
