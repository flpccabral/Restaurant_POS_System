/**
 * Servico de Impressao Termica ESC/POS
 *
 * Envia comandos ESC/POS para impressoras termicas via TCP/IP (porta 9100).
 * Compativel com Bematech, Epson TM-T88, Daruma, Star, e qualquer impressora
 * termica que suporte protocolo ESC/POS padrao.
 *
 * Templates:
 * - receipt: Cupom nao-fiscal (PDV/balcao)
 * - kitchen: Comanda de cozinha
 */

const net = require('net');

// ============================================
// COMANDOS ESC/POS
// ============================================
const ESC = {
    // Inicializacao
    INIT: Buffer.from([0x1B, 0x40]),

    // Alinhamento (0=esquerda, 1=centro, 2=direita)
    ALIGN_LEFT: Buffer.from([0x1B, 0x61, 0x00]),
    ALIGN_CENTER: Buffer.from([0x1B, 0x61, 0x01]),
    ALIGN_RIGHT: Buffer.from([0x1B, 0x61, 0x02]),

    // Negrito (0=off, 1=on)
    BOLD_ON: Buffer.from([0x1B, 0x45, 0x01]),
    BOLD_OFF: Buffer.from([0x1B, 0x45, 0x00]),

    // Sublinhado (0=off, 1=on)
    UNDERLINE_ON: Buffer.from([0x1B, 0x2D, 0x01]),
    UNDERLINE_OFF: Buffer.from([0x1B, 0x2D, 0x00]),

    // Fonte dupla
    DOUBLE_WIDTH_ON: Buffer.from([0x1B, 0x21, 0x20]),
    DOUBLE_HEIGHT_ON: Buffer.from([0x1B, 0x21, 0x10]),
    DOUBLE_ON: Buffer.from([0x1B, 0x21, 0x30]),   // largura + altura
    FONT_NORMAL: Buffer.from([0x1B, 0x21, 0x00]),

    // Fonte secundaria (menor)
    FONT_B_ON: Buffer.from([0x1B, 0x4D, 0x01]),
    FONT_A_ON: Buffer.from([0x1B, 0x4D, 0x00]),

    // Alimentar linhas
    LINE_FEED: Buffer.from([0x0A]),
    feedLines: (n) => Buffer.from([0x1B, 0x64, n]),

    // Corte de papel
    CUT_PARTIAL: Buffer.from([0x1D, 0x56, 0x01]),
    CUT_FULL: Buffer.from([0x1D, 0x56, 0x00]),

    // Beep
    BEEP: Buffer.from([0x1B, 0x42, 0x02, 0x0A]),

    // Abertura de gaveta (nao usamos, mas disponivel)
    OPEN_DRAWER: Buffer.from([0x1B, 0x70, 0x00, 0x19, 0x19])
};

// ============================================
// FUNCOES AUXILIARES
// ============================================

/**
 * Converte string para buffer com encoding latin1 (compativel com ESC/POS)
 * Caracteres especiais brasileiros (acentos) funcionam corretamente
 */
const textToBuffer = (text) => {
    return Buffer.from(text, 'latin1');
};

/**
 * Cria uma linha separadora com o comprimento do papel
 */
const separatorLine = (paperWidth = 80) => {
    const chars = paperWidth === 80 ? 48 : 32;
    return textToBuffer('-'.repeat(chars) + '\n');
};

/**
 * Cria uma linha dupla separadora
 */
const doubleSeparatorLine = (paperWidth = 80) => {
    const chars = paperWidth === 80 ? 48 : 32;
    return textToBuffer('='.repeat(chars) + '\n');
};

/**
 * Formata texto com espacamento (esquerda + direita)
 */
const spacedLine = (left, right, paperWidth = 80) => {
    const chars = paperWidth === 80 ? 48 : 32;
    const leftStr = String(left);
    const rightStr = String(right);
    const spaces = Math.max(1, chars - leftStr.length - rightStr.length);
    return textToBuffer(`${leftStr}${' '.repeat(spaces)}${rightStr}\n`);
};

/**
 * Formata uma linha de item (quantidade x nome ... preco)
 */
const itemLine = (qty, name, price, paperWidth = 80) => {
    const chars = paperWidth === 80 ? 48 : 32;
    const qtyStr = `${qty}x`;
    const priceStr = `R$ ${Number(price).toFixed(2)}`;
    const nameStr = String(name);

    // Se o nome cabe na linha
    const available = chars - qtyStr.length - priceStr.length - 2; // 2 espacos
    if (nameStr.length <= available) {
        const spaces = chars - qtyStr.length - nameStr.length - priceStr.length;
        return textToBuffer(`${qtyStr} ${nameStr}${' '.repeat(spaces)}${priceStr}\n`);
    }

    // Se o nome e longo, truncar
    const truncated = nameStr.substring(0, available - 3) + '...';
    const spaces = chars - qtyStr.length - truncated.length - priceStr.length;
    return textToBuffer(`${qtyStr} ${truncated}${' '.repeat(spaces)}${priceStr}\n`);
};

/**
 * Formata data/hora para impressao
 */
const formatDateTime = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
};

/**
 * Formata preco em BRL
 */
const formatCurrency = (value) => {
    return `R$ ${Number(value || 0).toFixed(2)}`;
};

// ============================================
// TEMPLATES DE IMPRESSAO
// ============================================

/**
 * Template: Comanda de Cozinha
 * - Numero do pedido (grande, centralizado)
 * - Mesa/balcao
 * - Cliente
 * - Itens com quantidades
 * - Observacoes (destacadas)
 */
const buildKitchenBuffer = (order, printer) => {
    const buffers = [];
    const pw = printer.paperWidth || 80;

    // Inicializacao
    buffers.push(ESC.INIT);

    // Numero do pedido (grande e centralizado)
    buffers.push(ESC.ALIGN_CENTER);
    buffers.push(ESC.DOUBLE_ON);
    buffers.push(ESC.BOLD_ON);
    buffers.push(textToBuffer(`PEDIDO #${order.orderNumber || order._id.toString().slice(-6)}\n`));
    buffers.push(ESC.FONT_NORMAL);
    buffers.push(ESC.BOLD_OFF);

    // Tipo do pedido (mesa ou balcao)
    buffers.push(ESC.BOLD_ON);
    const orderType = order.orderType === 'dine_in' ? 'MESA' : 'BALCAO';
    const tableInfo = order.tableNumber || order.table || '';
    buffers.push(textToBuffer(`${orderType}${tableInfo ? ` ${tableInfo}` : ''}\n`));
    buffers.push(ESC.BOLD_OFF);

    // Cliente (se houver)
    if (order.customerName) {
        buffers.push(textToBuffer(`Cliente: ${order.customerName}\n`));
    }

    // Data/hora
    buffers.push(ESC.FONT_B_ON);
    buffers.push(textToBuffer(`${formatDateTime(order.createdAt || new Date())}\n`));
    buffers.push(ESC.FONT_A_ON);

    // Separador
    buffers.push(ESC.ALIGN_LEFT);
    buffers.push(separatorLine(pw));

    // ITENS
    const items = order.items || [];
    items.forEach((item, idx) => {
        const name = item.name || item.productName || `Item ${idx + 1}`;
        const qty = item.quantity || 1;
        const notes = item.notes || item.observations || '';

        // Item principal (negrito)
        buffers.push(ESC.BOLD_ON);
        buffers.push(textToBuffer(`${qty}x ${name}\n`));
        buffers.push(ESC.BOLD_OFF);

        // Observacoes do item (se houver)
        if (notes) {
            buffers.push(ESC.FONT_B_ON);
            buffers.push(textToBuffer(`   >> ${notes}\n`));
            buffers.push(ESC.FONT_A_ON);
        }

        // Modificadores (se houver)
        if (item.modifiers && item.modifiers.length > 0) {
            buffers.push(ESC.FONT_B_ON);
            item.modifiers.forEach(mod => {
                const modName = typeof mod === 'string' ? mod : mod.name;
                buffers.push(textToBuffer(`   + ${modName}\n`));
            });
            buffers.push(ESC.FONT_A_ON);
        }
    });

    // Separador
    buffers.push(separatorLine(pw));

    // Observacoes gerais do pedido
    if (order.observations || order.notes) {
        buffers.push(ESC.BOLD_ON);
        buffers.push(textToBuffer('OBSERVACOES:\n'));
        buffers.push(ESC.BOLD_OFF);
        buffers.push(textToBuffer(`${order.observations || order.notes}\n`));
        buffers.push(separatorLine(pw));
    }

    // Rodape
    buffers.push(ESC.ALIGN_CENTER);
    buffers.push(ESC.BOLD_ON);
    buffers.push(textToBuffer('COZINHA\n'));
    buffers.push(ESC.BOLD_OFF);
    buffers.push(textToBuffer(`${formatDateTime(new Date())}\n`));

    // Alimentar linhas + corte
    buffers.push(ESC.feedLines(4));
    buffers.push(ESC.CUT_PARTIAL);

    return Buffer.concat(buffers);
};

/**
 * Template: Cupom Nao-Fiscal (PDV)
 * - Nome do restaurante
 * - Data/hora
 * - Itens com quantidades e precos
 * - Subtotal, taxa, total
 * - Forma de pagamento
 * - Agradecimento
 */
const buildReceiptBuffer = (order, printer) => {
    const buffers = [];
    const pw = printer.paperWidth || 80;

    // Inicializacao
    buffers.push(ESC.INIT);

    // Cabecalho do restaurante
    buffers.push(ESC.ALIGN_CENTER);
    buffers.push(ESC.DOUBLE_ON);
    buffers.push(ESC.BOLD_ON);
    buffers.push(textToBuffer('RESTAURANTE POS\n'));
    buffers.push(ESC.FONT_NORMAL);
    buffers.push(ESC.BOLD_OFF);
    buffers.push(textToBuffer('CNPJ: 00.000.000/0001-00\n'));
    buffers.push(textToBuffer('Rua Exemplo, 123 - Centro\n'));
    buffers.push(ESC.feedLines(1));

    // Data/hora
    buffers.push(ESC.FONT_B_ON);
    buffers.push(textToBuffer(`${formatDateTime(order.createdAt || new Date())}\n`));
    buffers.push(ESC.FONT_A_ON);

    // Numero do pedido
    buffers.push(ESC.BOLD_ON);
    buffers.push(textToBuffer(`PEDIDO #${order.orderNumber || order._id.toString().slice(-6)}\n`));
    buffers.push(ESC.BOLD_OFF);

    // Tipo
    const orderType = order.orderType === 'dine_in' ? 'MESA' :
                      order.orderType === 'delivery' ? 'DELIVERY' :
                      order.orderType === 'takeout' ? 'PARA LEVAR' : 'BALCAO';
    buffers.push(textToBuffer(`${orderType}${order.tableNumber ? ` - Mesa ${order.tableNumber}` : ''}\n`));

    // Cliente (se houver)
    if (order.customerName) {
        buffers.push(textToBuffer(`Cliente: ${order.customerName}\n`));
    }

    buffers.push(separatorLine(pw));

    // ITENS
    buffers.push(ESC.ALIGN_LEFT);
    const items = order.items || [];
    items.forEach((item, idx) => {
        const name = item.name || item.productName || `Item ${idx + 1}`;
        const qty = item.quantity || 1;
        const price = item.price || item.totalPrice || 0;
        const total = item.totalPrice || (price * qty);

        buffers.push(itemLine(qty, name, total, pw));

        // Observacoes
        if (item.notes || item.observations) {
            buffers.push(ESC.FONT_B_ON);
            buffers.push(textToBuffer(`   Obs: ${item.notes || item.observations}\n`));
            buffers.push(ESC.FONT_A_ON);
        }
    });

    buffers.push(separatorLine(pw));

    // TOTAIS
    // Subtotal
    const subtotal = order.subtotal || items.reduce((sum, item) => {
        return sum + (item.totalPrice || (item.price || 0) * (item.quantity || 1));
    }, 0);

    buffers.push(spacedLine('Subtotal:', formatCurrency(subtotal), pw));

    // Taxa de servico
    if (order.bills && order.bills.tax > 0) {
        buffers.push(spacedLine('Taxa (5.25%):', formatCurrency(order.bills.tax), pw));
    } else if (order.tax > 0) {
        buffers.push(spacedLine('Taxa:', formatCurrency(order.tax), pw));
    }

    // Desconto
    if (order.discount > 0) {
        buffers.push(spacedLine('Desconto:', `-${formatCurrency(order.discount)}`, pw));
    }

    // TOTAL (negrito + fonte dupla)
    buffers.push(ESC.BOLD_ON);
    const total = order.total || order.totalAmount || subtotal;
    buffers.push(spacedLine('TOTAL:', formatCurrency(total), pw));
    buffers.push(ESC.BOLD_OFF);

    buffers.push(separatorLine(pw));

    // FORMA DE PAGAMENTO
    const paymentMethod = order.paymentMethod || order.bills?.paymentMethod || 'N/A';
    const paymentLabels = {
        'cash': 'Dinheiro',
        'Dinheiro': 'Dinheiro',
        'pix': 'PIX',
        'Pix': 'PIX',
        'debit': 'Debito',
        'Debito': 'Debito',
        'credit': 'Credito',
        'Credito': 'Credito',
        'voucher': 'Voucher',
        'Voucher': 'Voucher'
    };
    buffers.push(spacedLine('Pagamento:', paymentLabels[paymentMethod] || paymentMethod, pw));

    buffers.push(separatorLine(pw));

    // Rodape
    buffers.push(ESC.ALIGN_CENTER);
    buffers.push(ESC.BOLD_ON);
    buffers.push(textToBuffer('OBRIGADO PELA PREFERENCIA!\n'));
    buffers.push(ESC.BOLD_OFF);
    buffers.push(ESC.FONT_B_ON);
    buffers.push(textToBuffer('Volte sempre!\n'));
    buffers.push(ESC.FONT_A_ON);
    buffers.push(textToBuffer(`${formatDateTime(new Date())}\n`));

    // Alimentar linhas + corte
    buffers.push(ESC.feedLines(5));
    buffers.push(ESC.CUT_PARTIAL);

    return Buffer.concat(buffers);
};

// ============================================
// FUNCOES PRINCIPAIS
// ============================================

/**
 * Envia buffer para impressora via TCP/IP
 *
 * @param {Object} printer - Modelo Printer com ipAddress, port
 * @param {Buffer} buffer - Buffer ESC/POS a ser enviado
 * @returns {Promise<{success: boolean, message: string}>}
 */
const sendToPrinter = (printer, buffer) => {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        const timeout = 5000; // 5 segundos

        // Timeout de conexao
        const timer = setTimeout(() => {
            socket.destroy();
            reject(new Error(`Timeout: impressora ${printer.ipAddress}:${printer.port} nao respondeu em ${timeout}ms`));
        }, timeout);

        socket.connect(printer.port, printer.ipAddress, () => {
            clearTimeout(timer);
            console.log(`[ThermalPrinter] Conectado a ${printer.ipAddress}:${printer.port}`);

            // Enviar buffer
            socket.write(buffer, (err) => {
                if (err) {
                    socket.destroy();
                    return reject(new Error(`Erro ao enviar dados para impressora: ${err.message}`));
                }

                console.log(`[ThermalPrinter] Buffer enviado com sucesso (${buffer.length} bytes)`);

                // Fechar conexao graciosamente
                socket.end(() => {
                    resolve({ success: true, message: 'Impressao enviada com sucesso!' });
                });
            });
        });

        socket.on('error', (err) => {
            clearTimeout(timer);
            console.error(`[ThermalPrinter] Erro na conexao TCP:`, err.message);
            reject(new Error(`Falha na conexao com impressora ${printer.ipAddress}:${printer.port}: ${err.message}`));
        });

        socket.on('close', () => {
            clearTimeout(timer);
        });
    });
};

/**
 * Testa conexao com a impressora
 * Envia um comando de inicializacao e verifica se a impressora responde
 */
const testConnection = async (printer) => {
    try {
        // Envia apenas o comando de inicializacao + beep + corte (teste basico)
        const testBuffer = Buffer.concat([
            ESC.INIT,
            ESC.ALIGN_CENTER,
            ESC.BOLD_ON,
            textToBuffer('TESTE DE IMPRESSAO\n'),
            ESC.BOLD_OFF,
            textToBuffer(`${printer.name}\n`),
            textToBuffer(`${printer.ipAddress}:${printer.port}\n`),
            textToBuffer(`${formatDateTime(new Date())}\n`),
            ESC.BEEP,
            ESC.feedLines(3),
            ESC.CUT_PARTIAL
        ]);

        await sendToPrinter(printer, testBuffer);
        return { success: true, message: 'Conexao com impressora OK! Cupom de teste impresso.' };
    } catch (error) {
        console.error(`[ThermalPrinter] Teste falhou:`, error.message);
        return { success: false, message: `Falha na conexao: ${error.message}` };
    }
};

/**
 * Funcao principal: imprime pedido
 *
 * @param {Object} params
 * @param {Object} params.order - Documento Order (Mongoose)
 * @param {Object} params.printer - Documento Printer (Mongoose)
 * @param {string} params.printType - 'receipt' | 'kitchen'
 * @returns {Promise<{success: boolean, message: string}>}
 */
const printOrder = async ({ order, printer, printType }) => {
    try {
        // Popularelacoes necessarias (table, products, etc.)
        // O order ja deve vir populado do controller

        // Construir buffer baseado no tipo
        let buffer;
        if (printType === 'kitchen') {
            buffer = buildKitchenBuffer(order, printer);
        } else {
            buffer = buildReceiptBuffer(order, printer);
        }

        console.log(`[ThermalPrinter] Imprimindo pedido ${order._id} (${printType}) na impressora ${printer.name} (${printer.ipAddress}:${printer.port})`);

        // Enviar para impressora
        const result = await sendToPrinter(printer, buffer);

        return {
            success: true,
            message: `${printType === 'kitchen' ? 'Comanda de cozinha' : 'Cupom nao-fiscal'} impresso com sucesso!`,
            bufferLength: buffer.length
        };
    } catch (error) {
        console.error(`[ThermalPrinter] Erro ao imprimir pedido ${order._id}:`, error.message);
        return {
            success: false,
            message: `Falha na impressao: ${error.message}`
        };
    }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
    printOrder,
    testConnection,
    sendToPrinter,
    buildKitchenBuffer,
    buildReceiptBuffer
};
