const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const config = require('../config');

class BrowserManager {
  constructor(options = {}) {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.headless = options.headless ?? config.BROWSER.HEADLESS;
  }

  /**
   * Inicializa o browser com Playwright
   */
  async launch() {
    console.log(`🚀 Iniciando navegador (headless: ${this.headless})...`);

    this.browser = await chromium.launch({
      headless: this.headless,
      slowMo: this.headless ? 0 : config.BROWSER.SLOW_MO,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    // Carregar cookies salvos se existirem
    const storageState = await this._loadStorageState();

    this.context = await this.browser.newContext({
      viewport: config.BROWSER.VIEWPORT,
      userAgent: config.BROWSER.USER_AGENT,
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      ...(storageState ? { storageState } : {}),
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(config.BROWSER.TIMEOUT);
    this.page.setDefaultNavigationTimeout(config.BROWSER.NAV_TIMEOUT);

    return this.page;
  }

  /**
   * Navega para uma URL e espera a SPA carregar
   */
  async navigateTo(url, waitOptions = {}) {
    const { waitForSelector, waitTime = 2000 } = waitOptions;

    console.log(`📍 Navegando para: ${url}`);
    await this.page.goto(url, { waitUntil: 'networkidle' });

    // Aguardar a SPA renderizar
    await this.page.waitForTimeout(waitTime);

    // Se foi passado um seletor específico, esperar por ele
    if (waitForSelector) {
      try {
        await this.page.waitForSelector(waitForSelector, { timeout: 10000 });
      } catch (e) {
        console.log(`⚠️  Seletor "${waitForSelector}" não encontrado, continuando...`);
      }
    }

    // Esperar que o splash screen desapareça
    try {
      await this.page.waitForSelector('#app-loading-splash-screen', {
        state: 'hidden',
        timeout: 5000,
      });
    } catch (e) {
      // Splash screen já sumiu
    }

    return this.page;
  }

  /**
   * Espera o conteúdo da página carregar completamente
   */
  async waitForContent(timeout = 10000) {
    try {
      // Esperar pelo menos algum conteúdo no #app
      await this.page.waitForFunction(
        () => {
          const app = document.querySelector('#app');
          return app && app.children.length > 0 && app.innerText.trim().length > 50;
        },
        { timeout }
      );
    } catch (e) {
      console.log('⚠️  Timeout esperando conteúdo carregar');
    }
  }

  /**
   * Executa uma ação com retry
   */
  async withRetry(fn, description = 'ação', maxRetries = config.RETRY.MAX_RETRIES) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) {
          console.error(`❌ Falha em "${description}" após ${maxRetries} tentativas: ${error.message}`);
          throw error;
        }
        console.log(
          `⚠️  Tentativa ${attempt}/${maxRetries} falhou para "${description}". Retentando em ${config.RETRY.RETRY_DELAY}ms...`
        );
        await this.page.waitForTimeout(config.RETRY.RETRY_DELAY);
      }
    }
  }

  /**
   * Rola a página até o final para carregar conteúdo lazy-loaded
   */
  async scrollToBottom(pauseMs = 500) {
    let previousHeight = 0;
    let currentHeight = await this.page.evaluate(() => document.body.scrollHeight);

    while (previousHeight !== currentHeight) {
      previousHeight = currentHeight;
      await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await this.page.waitForTimeout(pauseMs);
      currentHeight = await this.page.evaluate(() => document.body.scrollHeight);
    }
  }

  /**
   * Captura screenshot para debug
   */
  async screenshot(name) {
    const dir = path.join(config.PATHS.OUTPUT_DIR, 'screenshots');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filepath = path.join(dir, `${name}-${Date.now()}.png`);
    await this.page.screenshot({ path: filepath, fullPage: true });
    console.log(`📸 Screenshot salvo: ${filepath}`);
    return filepath;
  }

  /**
   * Salva o estado de autenticação (cookies + localStorage)
   */
  async saveStorageState() {
    const dir = config.PATHS.AUTH_STATE;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const state = await this.context.storageState();
    fs.writeFileSync(config.PATHS.COOKIES_FILE, JSON.stringify(state, null, 2));
    console.log('💾 Estado de autenticação salvo');
  }

  /**
   * Carrega estado de autenticação salvo
   */
  async _loadStorageState() {
    try {
      if (fs.existsSync(config.PATHS.COOKIES_FILE)) {
        const state = JSON.parse(fs.readFileSync(config.PATHS.COOKIES_FILE, 'utf-8'));
        console.log('🔑 Cookies de sessão carregados');
        return state;
      }
    } catch (e) {
      console.log('⚠️  Erro ao carregar cookies, será necessário login manual');
    }
    return null;
  }

  /**
   * Verifica se o usuário está logado
   */
  async isLoggedIn() {
    try {
      const url = this.page.url();
      // Se estiver em /login ou a página redireciona para login, não está logado
      if (url.includes('/login')) return false;

      // Verificar se o sidebar de navegação está presente
      const hasNav = await this.page.locator('a[href*="/orders"], a[href*="/home"]').count();
      return hasNav > 0;
    } catch (e) {
      return false;
    }
  }

  /**
   * Extrai texto de um elemento de forma segura
   */
  async safeText(selector, defaultValue = '') {
    try {
      const el = this.page.locator(selector).first();
      const text = await el.textContent({ timeout: 3000 });
      return text?.trim() || defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }

  /**
   * Extrai texto de todos os elementos que correspondem ao seletor
   */
  async allTexts(selector) {
    try {
      return await this.page.locator(selector).allTextContents();
    } catch (e) {
      return [];
    }
  }

  /**
   * Fecha o navegador
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 Navegador fechado');
    }
  }
}

module.exports = BrowserManager;
