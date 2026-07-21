const config = require('../config');
const Exporter = require('../utils/export');
const dayjs = require('dayjs');

class FinancialScraper {
  /**
   * @param {import('../utils/browser')} browserManager
   */
  constructor(browserManager) {
    this.bm = browserManager;
  }

  /**
   * Extrai dados financeiros
   * @param {Object} options
   * @param {string} options.month - Mês no formato YYYY-MM (ex: 2026-05)
   * @param {string} options.format - Formato de saída: json|csv|both
   */
  async scrape(options = {}) {
    const { month = null, format = 'both' } = options;

    console.log('\n💰 ═══════════════════════════════════════');
    console.log('   SCRAPER FINANCEIRO');
    console.log('═══════════════════════════════════════════\n');

    // Navegar para a página financeira
    await this.bm.navigateTo(config.URLS.FINANCIAL);
    await this.bm.page.waitForTimeout(3000);
    await this.bm.waitForContent();

    // Selecionar mês se especificado
    if (month) {
      await this._selectMonth(month);
    }

    // Extrair faturamento
    const billing = await this._extractBilling();
    console.log(`📊 Faturamento total: ${billing.totalBilling}`);

    // Extrair repasses
    const transfers = await this._extractTransfers();
    console.log(`📊 ${transfers.length} repasses encontrados`);

    // Extrair dados de comissão/contrato
    const commission = await this._extractCommission();

    const result = {
      month: month || dayjs().format('YYYY-MM'),
      billing,
      transfers,
      commission,
    };

    // Exportar
    if (format === 'json' || format === 'both') {
      Exporter.saveJSON(result, config.PATHS.FINANCIAL_DIR, 'financeiro');
    }
    if (format === 'csv' || format === 'both') {
      Exporter.saveCSV(transfers, config.PATHS.FINANCIAL_DIR, 'repasses');
    }

    Exporter.printSummary('Dados Financeiros', {
      ...billing,
      repasses: `${transfers.length} registros`,
    });

    return result;
  }

  /**
   * Seleciona um mês específico
   */
  async _selectMonth(month) {
    try {
      console.log(`📅 Selecionando mês: ${month}`);

      // Clicar no seletor de mês
      const monthSelector = this.bm.page.locator(
        'button:has-text("de 20"), [class*="month-selector"], [class*="MonthSelector"]'
      ).first();

      if (await monthSelector.isVisible()) {
        await monthSelector.click();
        await this.bm.page.waitForTimeout(1000);

        // Tentar encontrar e clicar no mês desejado
        const [year, monthNum] = month.split('-');
        const monthNames = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
        ];
        const monthName = monthNames[parseInt(monthNum) - 1];

        const monthOption = this.bm.page.locator(
          `button:has-text("${monthName}"), [class*="option"]:has-text("${monthName}")`
        ).first();

        if (await monthOption.isVisible()) {
          await monthOption.click();
          await this.bm.page.waitForTimeout(2000);
        }
      }
    } catch (e) {
      console.log(`⚠️  Não foi possível selecionar o mês: ${e.message}`);
    }
  }

  /**
   * Extrai dados de faturamento (cards no topo)
   */
  async _extractBilling() {
    return await this.bm.page.evaluate(() => {
      const text = document.body.textContent || '';

      const extractValue = (label) => {
        // Procura por padrões como "Valor das vendas R$ 12.579,20" ou "Valor das vendas ● R$ 12.579,20"
        const regex = new RegExp(label + '[\\s●]*R\\$\\s*([\\d.,]+)', 'i');
        const negRegex = new RegExp(label + '[\\s●]*-?R\\$\\s*([\\d.,]+)', 'i');
        const match = text.match(negRegex) || text.match(regex);
        if (match) {
          const isNegative = text.includes(`-R$ ${match[1]}`) || text.includes(`- R$ ${match[1]}`);
          return isNegative ? `-R$ ${match[1]}` : `R$ ${match[1]}`;
        }
        return 'N/A';
      };

      return {
        salesValue: extractValue('Valor das vendas'),
        taxesAndCommissions: extractValue('Taxas e comiss'),
        servicesAndPromotions: extractValue('Servi.os e promo'),
        adjustments: extractValue('Ajustes'),
        totalBilling: extractValue('Total faturamento'),
      };
    });
  }

  /**
   * Extrai tabela de repasses
   */
  async _extractTransfers() {
    await this.bm.scrollToBottom();

    return await this.bm.page.evaluate(() => {
      const transfers = [];
      const rows = document.querySelectorAll('tr');

      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 5) continue;

        const cellTexts = Array.from(cells).map((c) => c.textContent?.trim() || '');

        // Verificar se é uma linha de repasse (contém uma data no formato DD/MM/YYYY)
        const dateMatch = cellTexts[0]?.match(/\d{2}\/\d{2}\/\d{4}/);
        if (!dateMatch) continue;

        // Extrair status
        const statusText = cellTexts[2] || '';
        const status = statusText.includes('Pago')
          ? 'Pago'
          : statusText.includes('aberto')
            ? 'Em aberto'
            : statusText;

        transfers.push({
          paymentDate: cellTexts[0] || '',
          period: cellTexts[1] || '',
          status,
          subtotal: cellTexts[3] || '',
          anticipationFee: cellTexts[4] || '',
          value: cellTexts[5]?.replace(/[>›»→]/g, '').trim() || '',
        });
      }

      return transfers;
    });
  }

  /**
   * Extrai dados de comissão (tentar via botão "Ver detalhes")
   */
  async _extractCommission() {
    try {
      // Clicar em "Ver detalhes" se disponível
      const detailsBtn = this.bm.page.locator('button:has-text("Ver detalhes")').first();

      if (await detailsBtn.isVisible()) {
        await detailsBtn.click();
        await this.bm.page.waitForTimeout(2000);

        const commission = await this.bm.page.evaluate(() => {
          const text = document.body.textContent || '';

          const extractPercent = (label) => {
            const regex = new RegExp(label + '[\\s:]*([\\d,]+)%', 'i');
            const match = text.match(regex);
            return match ? `${match[1]}%` : 'N/A';
          };

          const extractBankInfo = () => {
            const bankMatch = text.match(/(\d{3})\s*[-–]\s*([\w\s()]+?)(?:\n|Agência)/);
            const agencyMatch = text.match(/Ag(?:ê|e)ncia\s*(\d+)/);
            const accountMatch = text.match(/Conta\s*([\d-]+)/);

            return {
              bank: bankMatch ? `${bankMatch[1]} - ${bankMatch[2].trim()}` : 'N/A',
              agency: agencyMatch ? agencyMatch[1] : 'N/A',
              account: accountMatch ? accountMatch[1] : 'N/A',
            };
          };

          return {
            deliveryCommission: extractPercent('Comiss(?:ã|a)o.*?[Dd]elivery'),
            pickupCommission: extractPercent('Comiss(?:ã|a)o.*?[Rr]etirada'),
            bankInfo: extractBankInfo(),
          };
        });

        // Voltar
        await this.bm.page.keyboard.press('Escape');
        await this.bm.page.waitForTimeout(1000);

        return commission;
      }
    } catch (e) {
      console.log(`⚠️  Não foi possível extrair dados de comissão: ${e.message}`);
    }

    return { deliveryCommission: 'N/A', pickupCommission: 'N/A', bankInfo: {} };
  }
}

module.exports = FinancialScraper;
