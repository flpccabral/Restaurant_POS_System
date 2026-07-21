const config = require('../config');
const Exporter = require('../utils/export');
const dayjs = require('dayjs');

class OrdersScraper {
  /**
   * @param {import('../utils/browser')} browserManager
   */
  constructor(browserManager) {
    this.bm = browserManager;
  }

  /**
   * Extrai todos os pedidos com opções de filtro
   * @param {Object} options
   * @param {string} options.status - Filtro de status: todos|aberto|concluidos|cancelados|cancelamento_parcial
   * @param {string} options.startDate - Data inicial (DD/MM/YYYY)
   * @param {string} options.endDate - Data final (DD/MM/YYYY)
   * @param {boolean} options.withDetails - Se deve abrir cada pedido para detalhes
   * @param {string} options.format - Formato de saída: json|csv|both
   */
  async scrape(options = {}) {
    const {
      status = 'todos',
      startDate = null,
      endDate = null,
      withDetails = true,
      format = 'both',
    } = options;

    console.log('\n📋 ═══════════════════════════════════════');
    console.log('   SCRAPER DE PEDIDOS');
    console.log('═══════════════════════════════════════════\n');

    // Navegar para a página de pedidos
    await this.bm.navigateTo(config.URLS.ORDERS);
    await this.bm.page.waitForTimeout(3000);
    await this.bm.waitForContent();

    // Aplicar filtro de período se especificado
    if (startDate || endDate) {
      await this._applyDateFilter(startDate, endDate);
    }

    // Aplicar filtro de status
    if (status !== 'todos') {
      await this._applyStatusFilter(status);
    }

    // Extrair resumo do dia
    const summary = await this._extractSummary();
    console.log(`📊 Resumo: ${summary.totalOrders} pedidos, ${summary.totalValue}`);

    // Extrair todos os pedidos da lista
    const orders = await this._extractAllOrders(withDetails);

    console.log(`\n✅ ${orders.length} pedidos extraídos com sucesso!`);

    // Exportar dados
    const result = {
      summary,
      filters: { status, startDate, endDate },
      orders,
    };

    if (format === 'json' || format === 'both') {
      Exporter.saveJSON(result, config.PATHS.ORDERS_DIR, 'pedidos');
    }
    if (format === 'csv' || format === 'both') {
      // Flatten orders for CSV (sem detalhes aninhados)
      const flatOrders = orders.map((o) => ({
        horario: o.time,
        pedido: o.orderNumber,
        canal: o.channel,
        situacao: o.status,
        valor_venda: o.saleValue,
        valor_liquido: o.netValue,
        pagamento: o.details?.payment || '',
        tipo_entrega: o.details?.deliveryType || '',
        itens: o.details?.items?.map((i) => `${i.qty}x ${i.name}`).join(', ') || '',
        total_itens: o.details?.totalItems || '',
      }));
      Exporter.saveCSV(flatOrders, config.PATHS.ORDERS_DIR, 'pedidos');
    }

    Exporter.printSummary('Pedidos extraídos', orders);
    return result;
  }

  /**
   * Extrai o resumo do dia (quantidade e valor total)
   */
  async _extractSummary() {
    try {
      // Procurar pelo texto que mostra "Hoje X pedidos • Valor das vendas de R$ X"
      const summaryText = await this.bm.page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
          const text = el.textContent?.trim() || '';
          if (text.includes('pedidos') && text.includes('Valor das vendas')) {
            return text;
          }
          if (text.includes('pedido') && text.includes('R$')) {
            return text;
          }
        }
        return '';
      });

      const matchCount = summaryText.match(/(\d+)\s*pedidos?/);
      const matchValue = summaryText.match(/R\$\s*([\d.,]+)/);

      return {
        rawText: summaryText,
        totalOrders: matchCount ? parseInt(matchCount[1]) : 0,
        totalValue: matchValue ? `R$ ${matchValue[1]}` : 'N/A',
      };
    } catch (e) {
      return { rawText: '', totalOrders: 0, totalValue: 'N/A' };
    }
  }

  /**
   * Aplica filtro de status na página de pedidos
   */
  async _applyStatusFilter(status) {
    const statusMap = {
      aberto: 'Em aberto',
      concluidos: 'Concluídos',
      cancelados: 'Cancelados',
      cancelamento_parcial: 'Cancelamento parcial',
    };

    const label = statusMap[status];
    if (!label) return;

    try {
      console.log(`🏷️  Filtrando por status: ${label}`);
      const tab = this.bm.page.locator(`button:has-text("${label}"), [role="tab"]:has-text("${label}")`).first();
      await tab.click();
      await this.bm.page.waitForTimeout(2000);
    } catch (e) {
      console.log(`⚠️  Não foi possível aplicar filtro de status: ${status}`);
    }
  }

  /**
   * Aplica filtro de período
   */
  async _applyDateFilter(startDate, endDate) {
    try {
      console.log(`📅 Filtrando período: ${startDate || 'início'} a ${endDate || 'hoje'}`);

      // Clicar no campo de período
      const datePicker = this.bm.page.locator(
        'input[placeholder*="Período"], [class*="date-picker"], [class*="DatePicker"]'
      ).first();
      await datePicker.click();
      await this.bm.page.waitForTimeout(1000);

      // Preencher datas (o comportamento exato depende do componente de data do portal)
      if (startDate) {
        await datePicker.fill(startDate);
      }

      await this.bm.page.waitForTimeout(1000);

      // Clicar no botão de busca
      const searchBtn = this.bm.page.locator('button[class*="search"], button:has([class*="search"])').first();
      if (await searchBtn.isVisible()) {
        await searchBtn.click();
        await this.bm.page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log(`⚠️  Não foi possível aplicar filtro de data: ${e.message}`);
    }
  }

  /**
   * Extrai todos os pedidos, navegando por páginas se necessário
   */
  async _extractAllOrders(withDetails = true) {
    let allOrders = [];
    let hasMorePages = true;
    let pageNum = 1;

    while (hasMorePages) {
      console.log(`📄 Extraindo página ${pageNum}...`);

      const pageOrders = await this._extractOrdersFromPage();
      console.log(`   Encontrados ${pageOrders.length} pedidos nesta página`);

      if (pageOrders.length === 0) break;

      // Se precisa dos detalhes, abrir cada pedido
      if (withDetails) {
        for (let i = 0; i < pageOrders.length; i++) {
          const order = pageOrders[i];
          console.log(`   📦 Extraindo detalhes do pedido ${order.orderNumber} (${i + 1}/${pageOrders.length})...`);
          try {
            order.details = await this._extractOrderDetails(i);
          } catch (e) {
            console.log(`   ⚠️  Erro nos detalhes do pedido ${order.orderNumber}: ${e.message}`);
            order.details = null;
          }
        }
      }

      allOrders = allOrders.concat(pageOrders);

      // Tentar ir para a próxima página
      hasMorePages = await this._goToNextPage();
      if (hasMorePages) pageNum++;
    }

    return allOrders;
  }

  /**
   * Extrai os pedidos visíveis na página atual
   */
  async _extractOrdersFromPage() {
    return await this.bm.page.evaluate(() => {
      const orders = [];

      // Estratégia 1: Encontrar linhas de tabela com dados de pedido
      const rows = document.querySelectorAll('tr, [class*="order-row"], [class*="OrderRow"]');

      for (const row of rows) {
        const cells = row.querySelectorAll('td, [class*="cell"], [class*="Cell"]');
        if (cells.length < 4) continue; // Pular header ou linhas sem dados

        const cellTexts = Array.from(cells).map((c) => c.textContent?.trim() || '');

        // Verificar se parece uma linha de pedido (tem horário no formato HH:MM)
        const timeMatch = cellTexts[0]?.match(/^\d{1,2}:\d{2}$/);
        if (!timeMatch) continue;

        orders.push({
          time: cellTexts[0] || '',
          orderNumber: cellTexts[1] || '',
          channel: cellTexts[2] || '',
          status: cellTexts[3]?.replace(/[●◉⬤]/g, '').trim() || '',
          saleValue: cellTexts[4] || '',
          netValue: cellTexts[5]?.replace(/[>›»→]/g, '').trim() || '',
        });
      }

      // Estratégia 2: Se não encontrou via tabela, tentar via divs
      if (orders.length === 0) {
        const items = document.querySelectorAll('[class*="order-item"], [class*="OrderItem"], [data-testid*="order"]');
        for (const item of items) {
          const text = item.textContent || '';
          const timeMatch = text.match(/(\d{1,2}:\d{2})/);
          const orderMatch = text.match(/\b(\d{4})\b/);
          const valueMatch = text.match(/R\$\s*([\d.,]+)/g);

          if (timeMatch && orderMatch) {
            orders.push({
              time: timeMatch[1],
              orderNumber: orderMatch[1],
              channel: text.includes('iFood') ? 'iFood' : '',
              status: text.includes('Concluído')
                ? 'Concluído'
                : text.includes('Cancelado')
                  ? 'Cancelado'
                  : text.includes('Confirmado')
                    ? 'Confirmado'
                    : '',
              saleValue: valueMatch?.[0] || '',
              netValue: valueMatch?.[1] || '',
            });
          }
        }
      }

      return orders;
    });
  }

  /**
   * Abre o drawer de detalhes de um pedido e extrai as informações
   */
  async _extractOrderDetails(rowIndex) {
    // Clicar na linha do pedido para abrir o drawer
    const rows = this.bm.page.locator('tr, [class*="order-row"], [class*="OrderRow"]');
    const dataRows = [];

    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const text = await row.textContent();
      if (/\d{1,2}:\d{2}/.test(text) && /\d{4}/.test(text)) {
        dataRows.push(row);
      }
    }

    if (rowIndex >= dataRows.length) return null;

    // Clicar na linha
    await dataRows[rowIndex].click();
    await this.bm.page.waitForTimeout(2000);

    // Extrair dados do drawer
    const details = await this.bm.page.evaluate(() => {
      const drawer =
        document.querySelector('[class*="drawer"], [class*="Drawer"], [class*="modal"]') || document;
      const text = drawer.textContent || '';

      // Extrair forma de pagamento
      const paymentMatch = text.match(/Pgto\.\s*pelo\s*app\s*([\w\s]+?)(?:Canal|Tipo)/s);
      const payment = paymentMatch ? paymentMatch[1].trim() : '';

      // Extrair tipo de entrega
      const deliveryMatch = text.match(/Tipo de entrega\s*([\w\s]+?)(?:Histórico|Itens)/s);
      const deliveryType = deliveryMatch ? deliveryMatch[1].trim() : '';

      // Extrair canal de venda
      const channelMatch = text.match(/Canal de venda\s*([\w]+)/);
      const channel = channelMatch ? channelMatch[1].trim() : '';

      // Extrair itens do pedido
      const items = [];
      const itemRows = drawer.querySelectorAll('[class*="item-row"], tr');
      for (const row of itemRows) {
        const rowText = row.textContent || '';
        const qtyMatch = rowText.match(/(\d+)x/);
        const priceMatches = rowText.match(/R\$\s*([\d.,]+)/g);

        if (qtyMatch) {
          const nameMatch = rowText.match(/\d+x\s+(.+?)(?:R\$|$)/);
          items.push({
            qty: qtyMatch[1],
            name: nameMatch ? nameMatch[1].trim() : '',
            unitPrice: priceMatches?.[0] || '',
            subtotal: priceMatches?.[1] || priceMatches?.[0] || '',
          });
        }
      }

      // Extrair total dos itens
      const totalMatch = text.match(/Total dos itens\s*R\$\s*([\d.,]+)/);
      const totalItems = totalMatch ? `R$ ${totalMatch[1]}` : '';

      // Extrair número do pedido do cliente
      const clientOrderMatch = text.match(/(\d+)º pedido desse/);
      const clientOrderCount = clientOrderMatch ? parseInt(clientOrderMatch[1]) : null;

      return {
        payment,
        channel,
        deliveryType,
        items,
        totalItems,
        clientOrderCount,
      };
    });

    // Fechar o drawer
    try {
      const closeBtn = this.bm.page.locator(
        'button[class*="close"], button:has([class*="close"]), [aria-label="Fechar"], [aria-label="Close"], button:has-text("✕"), button:has-text("×")'
      ).first();

      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      } else {
        // Tentar pressionar ESC
        await this.bm.page.keyboard.press('Escape');
      }
      await this.bm.page.waitForTimeout(1000);
    } catch (e) {
      await this.bm.page.keyboard.press('Escape');
      await this.bm.page.waitForTimeout(1000);
    }

    return details;
  }

  /**
   * Verifica se há próxima página e navega
   */
  async _goToNextPage() {
    try {
      const nextBtn = this.bm.page.locator(
        'button:has-text("Próxima"), button:has-text("próxima"), [class*="next"], [aria-label="Next"]'
      ).first();

      if (await nextBtn.isVisible() && await nextBtn.isEnabled()) {
        await nextBtn.click();
        await this.bm.page.waitForTimeout(2000);
        return true;
      }
    } catch (e) {
      // Sem próxima página
    }
    return false;
  }
}

module.exports = OrdersScraper;
