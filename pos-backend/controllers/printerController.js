const mongoose = require("mongoose");
const createHttpError = require("http-errors");
const Printer = require("../models/printerModel");
const Order = require("../models/orderModel");
const thermalPrinterService = require("../services/thermalPrinterService");

/**
 * Criar nova impressora
 */
const createPrinter = async (req, res, next) => {
    try {
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
        const { name, type, protocol, ipAddress, port, paperWidth, location } = req.body;

        // Validacoes basicas
        if (!name || !type) {
            throw createHttpError(400, "Nome e tipo da impressora sao obrigatorios!");
        }

        // Para TCP, IP e obrigatorio
        if (protocol === 'tcp' && !ipAddress) {
            throw createHttpError(400, "Endereco IP e obrigatorio para impressoras TCP/IP!");
        }

        const printer = new Printer({
            store: storeRef,
            name,
            type,
            protocol: protocol || 'tcp',
            ipAddress,
            port: port || 9100,
            paperWidth: paperWidth || 80,
            location,
            isActive: true
        });

        await printer.save();

        res.status(201).json({
            success: true,
            message: "Impressora cadastrada com sucesso!",
            data: printer
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar impressoras da loja
 */
const getPrinters = async (req, res, next) => {
    try {
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
        const { type, activeOnly } = req.query;

        const filter = { store: storeRef };
        if (type) filter.type = type;
        if (activeOnly === 'true') filter.isActive = true;

        const printers = await Printer.find(filter).sort({ type: 1, name: 1 });

        res.status(200).json({
            success: true,
            count: printers.length,
            data: printers
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar impressora
 */
const updatePrinter = async (req, res, next) => {
    try {
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
        const { id } = req.params;
        const { name, type, protocol, ipAddress, port, paperWidth, isActive, location } = req.body;

        const printer = await Printer.findOne({ _id: id, store: storeRef });
        if (!printer) {
            throw createHttpError(404, "Impressora nao encontrada!");
        }

        if (name !== undefined) printer.name = name;
        if (type !== undefined) printer.type = type;
        if (protocol !== undefined) printer.protocol = protocol;
        if (ipAddress !== undefined) printer.ipAddress = ipAddress;
        if (port !== undefined) printer.port = port;
        if (paperWidth !== undefined) printer.paperWidth = paperWidth;
        if (isActive !== undefined) printer.isActive = isActive;
        if (location !== undefined) printer.location = location;

        await printer.save();

        res.status(200).json({
            success: true,
            message: "Impressora atualizada com sucesso!",
            data: printer
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Desativar impressora (soft delete)
 */
const deletePrinter = async (req, res, next) => {
    try {
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
        const { id } = req.params;

        const printer = await Printer.findOne({ _id: id, store: storeRef });
        if (!printer) {
            throw createHttpError(404, "Impressora nao encontrada!");
        }

        printer.isActive = false;
        await printer.save();

        res.status(200).json({
            success: true,
            message: "Impressora desativada com sucesso!"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Disparar impressao de cupom/comanda
 * POST /api/print/receipt
 * Body: { orderId, printerType: 'receipt' | 'kitchen' }
 */
const printReceipt = async (req, res, next) => {
    try {
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
        const { orderId, printerType } = req.body;

        if (!orderId || !printerType) {
            throw createHttpError(400, "orderId e printerType sao obrigatorios!");
        }

        if (!['receipt', 'kitchen'].includes(printerType)) {
            throw createHttpError(400, "printerType deve ser 'receipt' ou 'kitchen'!");
        }

        // Buscar pedido
        const order = await Order.findById(orderId);
        if (!order) {
            throw createHttpError(404, "Pedido nao encontrado!");
        }

        // Verificar se o pedido pertence a loja
        if (order.store.toString() !== storeRef.toString()) {
            throw createHttpError(403, "Pedido nao pertence a esta loja!");
        }

        // Buscar impressora ativa do tipo correto
        const printer = await Printer.getActivePrinter(storeRef, printerType);
        if (!printer) {
            // Nao e erro — apenas informa que nao ha impressora configurada
            return res.status(200).json({
                success: false,
                message: `Nenhuma impressora ${printerType === 'kitchen' ? 'de cozinha' : 'de cupom'} configurada para esta loja. Configure uma impressora em Configuracoes > Impressoras.`
            });
        }

        // Disparar impressao (fire-and-forget mas aguardamos para retornar status)
        const result = await thermalPrinterService.printOrder({
            order,
            printer,
            printType: printerType
        });

        res.status(200).json({
            success: result.success,
            message: result.message,
            data: {
                orderId: order._id,
                orderNumber: order.orderNumber,
                printer: printer.name,
                printerType: printerType
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Testar conexao com impressora
 * POST /api/print/printers/:id/test
 */
const testPrinter = async (req, res, next) => {
    try {
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
        const { id } = req.params;

        const printer = await Printer.findOne({ _id: id, store: storeRef });
        if (!printer) {
            throw createHttpError(404, "Impressora nao encontrada!");
        }

        if (printer.protocol !== 'tcp' || !printer.ipAddress) {
            throw createHttpError(400, "Teste de conexao disponivel apenas para impressoras TCP/IP com IP configurado!");
        }

        // Testar conexao TCP
        const result = await thermalPrinterService.testConnection(printer);

        // Atualizar timestamp do ultimo teste se sucesso
        if (result.success) {
            printer.lastTestAt = new Date();
            await printer.save();
        }

        res.status(200).json({
            success: result.success,
            message: result.message,
            data: {
                printer: printer.name,
                ipAddress: printer.ipAddress,
                port: printer.port,
                lastTestAt: printer.lastTestAt
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createPrinter,
    getPrinters,
    updatePrinter,
    deletePrinter,
    printReceipt,
    testPrinter
};
