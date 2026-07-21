const config = require('../config');
const Exporter = require('../utils/export');

class MenuScraper {
  /**
   * @param {import('../utils/browser')} browserManager
   */
  constructor(browserManager) {
    this.bm = browserManager;
  }

  /**
   * Extrai dados do cardápio
   * @param {Object} options
   * @param {string} options.format - Formato de saída: json|csv|both
   */
  async scrape(options = {}) {
    const { format = 'both' } = options;

    console.log('\n🍽️  ═══════════════════════════════════════');
    console.log('   SCRAPER DE CARDÁPIO');
    console.log('═══════════════════════════════════════════\n');

    // Navegar para a página de cardápio
    await this.bm.navigateTo(config.URLS.MENU);
    await this.bm.page.waitForTimeout(3000);
    await this.bm.waitForContent();

    // Extrair categorias
    const categories = await this._extractCategories();
    console.log(`📂 ${categories.length} categorias encontradas`);

    // Navegar para aba de produtos
    await this._clickTab('Produtos');
    const products = await this._extractProducts();
    console.log(`📦 ${products.length} produtos encontrados`);

    // Navegar para aba de complementos
    await this._clickTab('Complementos');
    const complements = await this._extractComplements();
    console.log(`➕ ${complements.length} grupos de complementos encontrados`);

    const result = {
      categories,
      products,
      complements,
      stats: {
        totalCategories: categories.length,
        totalProducts: products.length,
        totalComplements: complements.length,
        activeProducts: products.filter((p) => p.active).length,
        pausedProducts: products.filter((p) => !p.active).length,
      },
    };

    // Exportar
    if (format === 'json' || format === 'both') {
      Exporter.saveJSON(result, config.PATHS.MENU_DIR, 'cardapio');
    }
    if (format === 'csv' || format === 'both') {
      Exporter.saveCSV(products, config.PATHS.MENU_DIR, 'produtos');
    }

    Exporter.printSummary('Cardápio', result.stats);
    return result;
  }

  /**
   * Clica em uma aba do cardápio
   */
  async _clickTab(tabName) {
    try {
      const tab = this.bm.page.locator(
        `[role="tab"]:has-text("${tabName}"), button:has-text("${tabName}"), a:has-text("${tabName}")`
      ).first();

      if (await tab.isVisible()) {
        await tab.click();
        await this.bm.page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log(`⚠️  Aba "${tabName}" não encontrada`);
    }
  }

  /**
   * Extrai lista de categorias
   */
  async _extractCategories() {
    await this.bm.scrollToBottom();

    return await this.bm.page.evaluate(() => {
      const categories = [];

      // Procurar por elementos que parecem categorias
      const items = document.querySelectorAll(
        '[class*="category"], [class*="Category"], [class*="grupo"], [class*="Grupo"]'
      );

      for (const item of items) {
        const name = item.querySelector(
          '[class*="name"], [class*="title"], h3, h4, span'
        )?.textContent?.trim();
        if (name && name.length > 1 && name.length < 100) {
          categories.push({
            name,
            productCount: item.querySelector('[class*="count"], [class*="badge"]')?.textContent?.trim() || '',
          });
        }
      }

      // Fallback: procurar headers de seção
      if (categories.length === 0) {
        const headers = document.querySelectorAll('h2, h3, [class*="section-title"]');
        for (const h of headers) {
          const text = h.textContent?.trim();
          if (text && text.length > 1 && text.length < 100 && !text.includes('Cardápio')) {
            categories.push({ name: text, productCount: '' });
          }
        }
      }

      return categories;
    });
  }

  /**
   * Extrai lista de produtos
   */
  async _extractProducts() {
    await this.bm.scrollToBottom();

    return await this.bm.page.evaluate(() => {
      const products = [];

      // Procurar elementos de produto
      const items = document.querySelectorAll(
        '[class*="product"], [class*="Product"], [class*="item-card"], [class*="ItemCard"]'
      );

      for (const item of items) {
        const text = item.textContent || '';

        // Extrair nome
        const nameEl = item.querySelector(
          '[class*="name"], [class*="title"], h3, h4, strong'
        );
        const name = nameEl?.textContent?.trim();
        if (!name || name.length < 2) continue;

        // Extrair preço
        const priceMatch = text.match(/R\$\s*([\d.,]+)/);
        const price = priceMatch ? `R$ ${priceMatch[1]}` : '';

        // Extrair descrição
        const descEl = item.querySelector(
          '[class*="description"], [class*="desc"], p'
        );
        const description = descEl?.textContent?.trim() || '';

        // Verificar se está ativo ou pausado
        const isPaused = text.toLowerCase().includes('pausado') ||
          text.toLowerCase().includes('indisponível') ||
          item.querySelector('[class*="paused"], [class*="disabled"]') !== null;

        products.push({
          name,
          price,
          description: description !== name ? description : '',
          active: !isPaused,
          status: isPaused ? 'Pausado' : 'Ativo',
        });
      }

      return products;
    });
  }

  /**
   * Extrai grupos de complementos
   */
  async _extractComplements() {
    await this.bm.scrollToBottom();

    return await this.bm.page.evaluate(() => {
      const groups = [];

      const items = document.querySelectorAll(
        '[class*="complement"], [class*="Complement"], [class*="group"], [class*="Group"]'
      );

      for (const item of items) {
        const nameEl = item.querySelector(
          '[class*="name"], [class*="title"], h3, h4, strong'
        );
        const name = nameEl?.textContent?.trim();
        if (!name || name.length < 2) continue;

        // Extrair opções dentro do grupo
        const optionEls = item.querySelectorAll(
          '[class*="option"], [class*="Option"], li'
        );
        const options = Array.from(optionEls).map((opt) => {
          const optText = opt.textContent || '';
          const priceMatch = optText.match(/R\$\s*([\d.,]+)/);
          return {
            name: opt.querySelector('[class*="name"], span')?.textContent?.trim() || optText.split('R$')[0]?.trim(),
            price: priceMatch ? `R$ ${priceMatch[1]}` : 'R$ 0,00',
          };
        }).filter((o) => o.name);

        groups.push({
          name,
          optionsCount: options.length,
          options,
        });
      }

      return groups;
    });
  }
}

module.exports = MenuScraper;
