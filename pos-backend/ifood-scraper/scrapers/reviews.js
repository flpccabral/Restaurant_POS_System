const config = require('../config');
const Exporter = require('../utils/export');

class ReviewsScraper {
  /**
   * @param {import('../utils/browser')} browserManager
   */
  constructor(browserManager) {
    this.bm = browserManager;
  }

  /**
   * Extrai avaliações da loja
   * @param {Object} options
   * @param {string} options.format - Formato de saída: json|csv|both
   */
  async scrape(options = {}) {
    const { format = 'both' } = options;

    console.log('\n⭐ ═══════════════════════════════════════');
    console.log('   SCRAPER DE AVALIAÇÕES');
    console.log('═══════════════════════════════════════════\n');

    // Navegar para a página de avaliações
    await this.bm.navigateTo(config.URLS.REVIEWS);
    await this.bm.page.waitForTimeout(3000);
    await this.bm.waitForContent();

    // Extrair resumo geral
    const summary = await this._extractSummary();
    console.log(`📊 Nota média: ${summary.averageRating} (${summary.totalReviews} avaliações)`);

    // Navegar para avaliações individuais
    await this._clickTab('Avaliações');
    await this.bm.scrollToBottom();

    // Extrair avaliações individuais
    const reviews = await this._extractReviews();
    console.log(`💬 ${reviews.length} avaliações individuais extraídas`);

    const result = {
      summary,
      reviews,
    };

    // Exportar
    if (format === 'json' || format === 'both') {
      Exporter.saveJSON(result, config.PATHS.REVIEWS_DIR, 'avaliacoes');
    }
    if (format === 'csv' || format === 'both') {
      Exporter.saveCSV(reviews, config.PATHS.REVIEWS_DIR, 'avaliacoes');
    }

    Exporter.printSummary('Avaliações', {
      notaMedia: summary.averageRating,
      totalAvaliacoes: summary.totalReviews,
      avaliacoesExtraidas: reviews.length,
    });

    return result;
  }

  /**
   * Clica em uma aba da página de avaliações
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
   * Extrai resumo geral de avaliações
   */
  async _extractSummary() {
    return await this.bm.page.evaluate(() => {
      const text = document.body.textContent || '';

      // Extrair nota média (ex: "4.5" ou "4,5")
      const ratingMatch = text.match(/(\d[,.]?\d?)\s*(?:\/\s*5|estrelas?)/i) ||
        text.match(/nota\s*(?:média)?\s*:?\s*(\d[,.]?\d?)/i);
      const averageRating = ratingMatch ? ratingMatch[1].replace(',', '.') : 'N/A';

      // Extrair total de avaliações
      const totalMatch = text.match(/(\d+)\s*avalia[çc]/i) ||
        text.match(/total\s*:?\s*(\d+)/i);
      const totalReviews = totalMatch ? parseInt(totalMatch[1]) : 0;

      // Extrair distribuição de estrelas (se visível)
      const distribution = {};
      for (let i = 5; i >= 1; i--) {
        const regex = new RegExp(`${i}\\s*estrela[s]?[\\s:]*([\\d]+)`, 'i');
        const match = text.match(regex);
        if (match) distribution[`${i}stars`] = parseInt(match[1]);
      }

      return {
        averageRating,
        totalReviews,
        distribution: Object.keys(distribution).length > 0 ? distribution : null,
      };
    });
  }

  /**
   * Extrai avaliações individuais
   */
  async _extractReviews() {
    return await this.bm.page.evaluate(() => {
      const reviews = [];

      // Procurar por elementos de avaliação
      const items = document.querySelectorAll(
        '[class*="review"], [class*="Review"], [class*="avaliacao"], [class*="comment"], [class*="Comment"]'
      );

      for (const item of items) {
        const text = item.textContent || '';
        if (text.length < 10) continue;

        // Extrair nota (estrelas)
        const starsEl = item.querySelectorAll('[class*="star"], [class*="Star"], svg[class*="filled"]');
        const rating = starsEl.length > 0 ? starsEl.length : null;

        // Extrair comentário
        const commentEl = item.querySelector(
          '[class*="comment"], [class*="text"], [class*="body"], p'
        );
        const comment = commentEl?.textContent?.trim() || '';

        // Extrair data
        const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
        const dateMatch2 = text.match(/(\d{1,2}\s+de\s+\w+)/);
        const date = dateMatch ? dateMatch[1] : dateMatch2 ? dateMatch2[1] : '';

        // Extrair resposta do restaurante
        const replyEl = item.querySelector(
          '[class*="reply"], [class*="Reply"], [class*="response"], [class*="resposta"]'
        );
        const reply = replyEl?.textContent?.trim() || '';

        // Extrair nome do cliente (se disponível)
        const nameEl = item.querySelector(
          '[class*="customer"], [class*="name"], [class*="author"]'
        );
        const customerName = nameEl?.textContent?.trim() || '';

        if (comment || rating) {
          reviews.push({
            rating,
            comment,
            date,
            customerName,
            hasReply: reply.length > 0,
            reply,
          });
        }
      }

      return reviews;
    });
  }
}

module.exports = ReviewsScraper;
