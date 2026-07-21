const path = require('path');

const BASE_URL = 'https://portal.ifood.com.br';

module.exports = {
  BASE_URL,

  URLS: {
    LOGIN: `${BASE_URL}/login`,
    HOME: `${BASE_URL}/home`,
    ORDERS: `${BASE_URL}/orders`,
    FINANCIAL: `${BASE_URL}/financial`,
    MENU: `${BASE_URL}/menu`,
    REVIEWS: `${BASE_URL}/reviews`,
    PERFORMANCE: `${BASE_URL}/performance`,
    PROFILE: `${BASE_URL}/profile`,
    PROFILE_ADDRESS: `${BASE_URL}/profile/address-v2`,
    SETTINGS: `${BASE_URL}/settings`,
  },

  PATHS: {
    AUTH_STATE: path.join(__dirname, 'auth-state'),
    COOKIES_FILE: path.join(__dirname, 'auth-state', 'cookies.json'),
    OUTPUT_DIR: path.join(__dirname, 'output'),
    ORDERS_DIR: path.join(__dirname, 'output', 'orders'),
    FINANCIAL_DIR: path.join(__dirname, 'output', 'financials'),
    MENU_DIR: path.join(__dirname, 'output', 'menu'),
    REVIEWS_DIR: path.join(__dirname, 'output', 'reviews'),
    STORE_DIR: path.join(__dirname, 'output', 'store'),
  },

  BROWSER: {
    HEADLESS: false,
    VIEWPORT: { width: 1920, height: 1080 },
    TIMEOUT: 30000,
    NAV_TIMEOUT: 60000,
    SLOW_MO: 100,
    USER_AGENT:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  },

  RETRY: {
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
  },

  // Seletores CSS comuns do portal iFood
  SELECTORS: {
    // Navegação
    SIDEBAR_MENU: 'nav, [class*="sidebar"], [class*="menu"]',
    MENU_ITEM: 'a[href*="/orders"], a[href*="/financial"], a[href*="/menu"]',

    // Pedidos
    ORDERS: {
      TABLE: 'table, [class*="order-list"], [class*="OrderList"]',
      ROW: 'tr, [class*="order-row"], [class*="OrderRow"], [class*="order-item"]',
      SEARCH_INPUT: 'input[placeholder*="número do pedido"], input[placeholder*="pedido"]',
      DATE_PICKER: 'input[placeholder*="Período"], [class*="date-picker"], [class*="DatePicker"]',
      FILTER_TABS: '[class*="tab"], [class*="Tab"], [role="tab"]',
      EXPORT_BUTTON: 'button:has-text("Exportar"), [class*="export"]',
      DETAIL_DRAWER: '[class*="drawer"], [class*="Drawer"], [class*="modal"], [class*="sidebar-detail"]',
      PAGINATION: '[class*="pagination"], [class*="Pagination"], button:has-text("Próxima")',
    },

    // Financeiro
    FINANCIAL: {
      MONTH_SELECTOR: '[class*="month"], [class*="Month"], button:has-text("de 20")',
      BILLING_CARDS: '[class*="card"], [class*="Card"], [class*="billing"]',
      TRANSFERS_TABLE: 'table, [class*="transfer"], [class*="Transfer"]',
      EXPORT_BUTTON: 'button:has-text("Exportar"), [class*="export"]',
    },

    // Cardápio
    MENU: {
      CATEGORIES_TAB: '[role="tab"]:has-text("Categorias"), button:has-text("Categorias")',
      PRODUCTS_TAB: '[role="tab"]:has-text("Produtos"), button:has-text("Produtos")',
      COMPLEMENTS_TAB: '[role="tab"]:has-text("Complementos"), button:has-text("Complementos")',
      PRODUCT_ITEM: '[class*="product"], [class*="Product"], [class*="item"]',
    },

    // Avaliações
    REVIEWS: {
      SUMMARY: '[class*="summary"], [class*="Summary"], [class*="rating"]',
      REVIEW_ITEM: '[class*="review"], [class*="Review"], [class*="comment"]',
    },
  },
};
