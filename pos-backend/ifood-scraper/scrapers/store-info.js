const config = require('../config');
const Exporter = require('../utils/export');

class StoreInfoScraper {
  /**
   * @param {import('../utils/browser')} browserManager
   */
  constructor(browserManager) {
    this.bm = browserManager;
  }

  /**
   * Extrai todas as informações da loja
   * @param {Object} options
   * @param {string} options.format - Formato de saída: json|csv|both
   */
  async scrape(options = {}) {
    const { format = 'json' } = options;

    console.log('\n🏪 ═══════════════════════════════════════');
    console.log('   SCRAPER DE DADOS DA LOJA');
    console.log('═══════════════════════════════════════════\n');

    const result = {};

    // 1. Extrair dados do perfil
    console.log('📋 Extraindo perfil...');
    result.profile = await this._extractProfile();

    // 2. Extrair endereço
    console.log('📍 Extraindo endereço...');
    result.address = await this._extractAddress();

    // 3. Extrair configurações
    console.log('⚙️  Extraindo configurações...');
    result.settings = await this._extractSettings();

    // 4. Extrair dados do dashboard (métricas operacionais)
    console.log('📊 Extraindo métricas do dashboard...');
    result.dashboard = await this._extractDashboard();

    // Exportar
    if (format === 'json' || format === 'both') {
      Exporter.saveJSON(result, config.PATHS.STORE_DIR, 'loja');
    }

    Exporter.printSummary('Dados da Loja', {
      nome: result.profile?.storeName || 'N/A',
      cnpj: result.profile?.cnpj || 'N/A',
      endereco: result.address?.fullAddress || 'N/A',
    });

    return result;
  }

  /**
   * Extrai dados do perfil da loja
   */
  async _extractProfile() {
    await this.bm.navigateTo(config.URLS.PROFILE);
    await this.bm.page.waitForTimeout(3000);
    await this.bm.waitForContent();
    await this.bm.scrollToBottom();

    return await this.bm.page.evaluate(() => {
      const text = document.body.textContent || '';

      const extract = (label) => {
        const regex = new RegExp(label + '[:\\s]+([^\\n]+)', 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : '';
      };

      // Tentar extrair de campos de formulário
      const inputs = document.querySelectorAll('input, [class*="value"], [class*="info"]');
      const formData = {};
      for (const input of inputs) {
        const label = input.getAttribute('aria-label') ||
          input.getAttribute('placeholder') ||
          input.previousElementSibling?.textContent?.trim() || '';
        const value = input.value || input.textContent?.trim() || '';
        if (label && value) {
          formData[label] = value;
        }
      }

      return {
        storeName: extract('Nome(?:\\s+da\\s+loja)?') || document.querySelector('h1, h2, [class*="store-name"]')?.textContent?.trim() || '',
        category: extract('Categoria') || '',
        description: extract('Descri[çc]') || '',
        cnpj: (text.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/) || [])[1] || '',
        corporateName: extract('Raz[ãa]o [Ss]ocial') || '',
        type: text.includes('MEI') ? 'MEI' : text.includes('LTDA') ? 'LTDA' : '',
        representative: extract('Representante') || '',
        cpf: (text.match(/CPF[:\s]*([\d.-]+)/) || [])[1] || '',
        phone: (text.match(/(?:Telefone|Tel)[:\s]*([\d\s()-]+)/) || [])[1]?.trim() || '',
        email: (text.match(/[\w.+-]+@[\w.-]+\.\w+/) || [])[0] || '',
        formData,
      };
    });
  }

  /**
   * Extrai endereço da loja
   */
  async _extractAddress() {
    await this.bm.navigateTo(config.URLS.PROFILE_ADDRESS);
    await this.bm.page.waitForTimeout(3000);
    await this.bm.waitForContent();

    return await this.bm.page.evaluate(() => {
      const text = document.body.textContent || '';

      // Procurar por endereço completo
      const cepMatch = text.match(/(\d{5}-?\d{3})/);
      const addressParts = [];

      // Tentar pegar de campos de formulário
      const inputs = document.querySelectorAll('input');
      const fields = {};
      for (const input of inputs) {
        const label = input.getAttribute('aria-label') ||
          input.getAttribute('placeholder') ||
          input.getAttribute('name') || '';
        const value = input.value || '';
        if (value) fields[label] = value;
      }

      // Tentar pegar de texto visível
      const fullAddressMatch = text.match(
        /(Rua|Av|Avenida|Travessa|Alameda)[^,\n]+,\s*\d+[^,\n]*(?:,[^,\n]+)?/i
      );

      return {
        fullAddress: fullAddressMatch ? fullAddressMatch[0].trim() : '',
        cep: cepMatch ? cepMatch[1] : '',
        fields,
      };
    });
  }

  /**
   * Extrai configurações da loja
   */
  async _extractSettings() {
    await this.bm.navigateTo(`${config.BASE_URL}/settings`);
    await this.bm.page.waitForTimeout(3000);
    await this.bm.waitForContent();
    await this.bm.scrollToBottom();

    return await this.bm.page.evaluate(() => {
      const text = document.body.textContent || '';

      // Extrair horários de funcionamento
      const daysOfWeek = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
      const schedule = {};

      for (const day of daysOfWeek) {
        const regex = new RegExp(day + '[\\s:]+([^\\n]+)', 'i');
        const match = text.match(regex);
        if (match) {
          const hours = match[1].trim();
          schedule[day] = hours.includes('Fechado') ? 'Fechado' : hours;
        }
      }

      // Extrair formas de pagamento
      const paymentMethods = [];
      const paymentKeywords = [
        'Mastercard', 'Visa', 'Elo', 'Hipercard', 'Amex', 'American Express',
        'Pix', 'Google Pay', 'Apple Pay', 'NuPay', 'Débito', 'Crédito',
      ];

      for (const method of paymentKeywords) {
        if (text.includes(method)) {
          paymentMethods.push(method);
        }
      }

      // Extrair plano de entrega
      const deliveryPlan = text.includes('Plano Entrega')
        ? 'Plano Entrega'
        : text.includes('Entrega própria')
          ? 'Entrega própria'
          : '';

      // Pedidos agendados
      const scheduledOrders = text.includes('agendados') &&
        (text.includes('Habilitado') || text.includes('Ativado'));

      return {
        schedule: Object.keys(schedule).length > 0 ? schedule : null,
        paymentMethods,
        deliveryPlan,
        scheduledOrders,
      };
    });
  }

  /**
   * Extrai métricas do dashboard
   */
  async _extractDashboard() {
    await this.bm.navigateTo(config.URLS.HOME);
    await this.bm.page.waitForTimeout(3000);
    await this.bm.waitForContent();
    await this.bm.scrollToBottom();

    return await this.bm.page.evaluate(() => {
      const text = document.body.textContent || '';

      const extractMetric = (label) => {
        // Tentar "Total das vendas R$ 3.533,18"
        const regex = new RegExp(label + '[\\s●:]*R?\\$?\\s*([\\d.,]+%?)', 'i');
        const match = text.match(regex);
        return match ? match[1] : 'N/A';
      };

      const extractVariation = (label) => {
        const regex = new RegExp(label + '[^%]*?([+-]?[\\d.,]+%)', 'i');
        const match = text.match(regex);
        return match ? match[1] : 'N/A';
      };

      return {
        totalSales: extractMetric('Total das vendas'),
        averageTicket: extractMetric('Ticket m[ée]dio'),
        cancellationValue: extractMetric('Valor dos cancelamentos'),
        cancellationRate: extractMetric('Taxa de cancelamento'),
        completedOrders: extractMetric('Pedidos conclu[ií]dos'),
        cancelledOrders: extractMetric('Pedidos cancelados'),
        variations: {
          totalSales: extractVariation('Total das vendas'),
          averageTicket: extractVariation('Ticket m[ée]dio'),
          cancellationRate: extractVariation('Taxa de cancelamento'),
        },
      };
    });
  }
}

module.exports = StoreInfoScraper;
