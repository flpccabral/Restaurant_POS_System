const config = require('../config');

class LoginManager {
  /**
   * @param {import('./browser')} browserManager
   */
  constructor(browserManager) {
    this.bm = browserManager;
  }

  /**
   * Garante que o usuário está autenticado.
   * Se não estiver, abre o navegador para login manual.
   */
  async ensureLoggedIn() {
    console.log('🔐 Verificando autenticação...');

    // Navegar para a home para checar se está logado
    await this.bm.navigateTo(config.URLS.HOME);
    await this.bm.waitForContent();

    if (await this.bm.isLoggedIn()) {
      console.log('✅ Sessão ativa! Usuário autenticado.');
      return true;
    }

    // Se não está logado, pedir login manual
    console.log('\n' + '═'.repeat(60));
    console.log('🔑 LOGIN NECESSÁRIO');
    console.log('═'.repeat(60));
    console.log('O navegador será aberto na página de login do iFood.');
    console.log('Por favor, faça login manualmente.');
    console.log('O scraper continuará automaticamente após o login.');
    console.log('═'.repeat(60) + '\n');

    // Navegar para a página de login
    await this.bm.navigateTo(config.URLS.LOGIN);

    // Esperar até que o usuário faça login (verificar a cada 3 segundos)
    const maxWaitMinutes = 5;
    const checkInterval = 3000;
    const maxChecks = (maxWaitMinutes * 60 * 1000) / checkInterval;

    for (let i = 0; i < maxChecks; i++) {
      await this.bm.page.waitForTimeout(checkInterval);

      const currentUrl = this.bm.page.url();

      // Se saiu da página de login, provavelmente logou
      if (!currentUrl.includes('/login')) {
        await this.bm.waitForContent();

        if (await this.bm.isLoggedIn()) {
          console.log('✅ Login realizado com sucesso!');

          // Salvar cookies para próxima execução
          await this.bm.saveStorageState();
          return true;
        }
      }

      if (i % 10 === 0 && i > 0) {
        console.log(`⏳ Aguardando login... (${Math.floor((i * checkInterval) / 1000)}s)`);
      }
    }

    throw new Error('⏰ Timeout: Login não realizado em 5 minutos');
  }

  /**
   * Fluxo apenas de login (sem scraping depois)
   */
  async loginOnly() {
    await this.ensureLoggedIn();
    console.log('💾 Sessão salva. Você pode fechar o navegador.');
    console.log('   Nas próximas execuções, o login será automático.');
  }
}

module.exports = LoginManager;
