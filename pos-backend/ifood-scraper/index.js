#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const BrowserManager = require('./utils/browser');
const LoginManager = require('./auth/login');
const OrdersScraper = require('./scrapers/orders');
const FinancialScraper = require('./scrapers/financials');
const MenuScraper = require('./scrapers/menu');
const ReviewsScraper = require('./scrapers/reviews');
const StoreInfoScraper = require('./scrapers/store-info');

const BANNER = `
${chalk.red('╔══════════════════════════════════════════════════════╗')}
${chalk.red('║')}  ${chalk.bold.white('🍔 iFood Scraper')} ${chalk.gray('— Portal do Parceiro')}                  ${chalk.red('║')}
${chalk.red('║')}  ${chalk.gray('Extração automatizada de dados do iFood')}              ${chalk.red('║')}
${chalk.red('╚══════════════════════════════════════════════════════╝')}
`;

program
  .name('ifood-scraper')
  .description('Scraper automatizado do Portal do Parceiro iFood')
  .version('1.0.0');

program
  .option('--all', 'Extrair TODOS os dados (pedidos, financeiro, cardápio, avaliações, loja)')
  .option('--orders', 'Extrair pedidos')
  .option('--financial', 'Extrair dados financeiros')
  .option('--menu', 'Extrair cardápio')
  .option('--reviews', 'Extrair avaliações')
  .option('--store', 'Extrair dados da loja')
  .option('--login-only', 'Apenas fazer login e salvar sessão')
  .option('--status <status>', 'Filtro de status dos pedidos (todos|aberto|concluidos|cancelados)', 'todos')
  .option('--date <date>', 'Data para filtro de pedidos (DD/MM/YYYY)')
  .option('--month <month>', 'Mês para dados financeiros (YYYY-MM)')
  .option('--format <format>', 'Formato de saída (json|csv|both)', 'both')
  .option('--headless', 'Executar em modo headless (sem interface visual)', false)
  .option('--no-details', 'Não extrair detalhes individuais dos pedidos (mais rápido)')
  .parse();

const opts = program.opts();

async function main() {
  console.log(BANNER);

  const startTime = Date.now();
  const bm = new BrowserManager({ headless: opts.headless });

  try {
    // Inicializar navegador
    await bm.launch();

    // Garantir autenticação
    const loginManager = new LoginManager(bm);
    await loginManager.ensureLoggedIn();

    if (opts.loginOnly) {
      console.log(chalk.green('\n✅ Login realizado com sucesso! Sessão salva.'));
      return;
    }

    // Determinar quais scrapers executar
    const runAll = opts.all || (!opts.orders && !opts.financial && !opts.menu && !opts.reviews && !opts.store);

    const results = {};

    // ═══════════════════════════════════════
    // PEDIDOS
    // ═══════════════════════════════════════
    if (runAll || opts.orders) {
      try {
        const scraper = new OrdersScraper(bm);
        results.orders = await scraper.scrape({
          status: opts.status,
          startDate: opts.date,
          withDetails: opts.details !== false,
          format: opts.format,
        });
      } catch (e) {
        console.error(chalk.red(`\n❌ Erro no scraper de pedidos: ${e.message}`));
        if (process.env.DEBUG) console.error(e.stack);
      }
    }

    // ═══════════════════════════════════════
    // FINANCEIRO
    // ═══════════════════════════════════════
    if (runAll || opts.financial) {
      try {
        const scraper = new FinancialScraper(bm);
        results.financial = await scraper.scrape({
          month: opts.month,
          format: opts.format,
        });
      } catch (e) {
        console.error(chalk.red(`\n❌ Erro no scraper financeiro: ${e.message}`));
        if (process.env.DEBUG) console.error(e.stack);
      }
    }

    // ═══════════════════════════════════════
    // CARDÁPIO
    // ═══════════════════════════════════════
    if (runAll || opts.menu) {
      try {
        const scraper = new MenuScraper(bm);
        results.menu = await scraper.scrape({
          format: opts.format,
        });
      } catch (e) {
        console.error(chalk.red(`\n❌ Erro no scraper de cardápio: ${e.message}`));
        if (process.env.DEBUG) console.error(e.stack);
      }
    }

    // ═══════════════════════════════════════
    // AVALIAÇÕES
    // ═══════════════════════════════════════
    if (runAll || opts.reviews) {
      try {
        const scraper = new ReviewsScraper(bm);
        results.reviews = await scraper.scrape({
          format: opts.format,
        });
      } catch (e) {
        console.error(chalk.red(`\n❌ Erro no scraper de avaliações: ${e.message}`));
        if (process.env.DEBUG) console.error(e.stack);
      }
    }

    // ═══════════════════════════════════════
    // DADOS DA LOJA
    // ═══════════════════════════════════════
    if (runAll || opts.store) {
      try {
        const scraper = new StoreInfoScraper(bm);
        results.store = await scraper.scrape({
          format: opts.format,
        });
      } catch (e) {
        console.error(chalk.red(`\n❌ Erro no scraper de dados da loja: ${e.message}`));
        if (process.env.DEBUG) console.error(e.stack);
      }
    }

    // Salvar sessão atualizada
    await bm.saveStorageState();

    // Resumo final
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + chalk.green('═'.repeat(55)));
    console.log(chalk.green.bold('  ✅ EXTRAÇÃO CONCLUÍDA COM SUCESSO!'));
    console.log(chalk.green('═'.repeat(55)));
    console.log(chalk.gray(`  ⏱️  Tempo total: ${elapsed}s`));

    if (results.orders) {
      console.log(chalk.white(`  📋 Pedidos: ${results.orders.orders?.length || 0} extraídos`));
    }
    if (results.financial) {
      console.log(chalk.white(`  💰 Financeiro: faturamento ${results.financial.billing?.totalBilling || 'N/A'}`));
    }
    if (results.menu) {
      console.log(chalk.white(`  🍽️  Cardápio: ${results.menu.products?.length || 0} produtos`));
    }
    if (results.reviews) {
      console.log(chalk.white(`  ⭐ Avaliações: ${results.reviews.reviews?.length || 0} extraídas`));
    }
    if (results.store) {
      console.log(chalk.white(`  🏪 Loja: dados extraídos`));
    }

    console.log(chalk.gray(`\n  📁 Dados salvos em: pos-backend/ifood-scraper/output/`));
    console.log(chalk.green('═'.repeat(55)) + '\n');

  } catch (error) {
    console.error(chalk.red(`\n❌ Erro fatal: ${error.message}`));
    if (process.env.DEBUG) console.error(error.stack);

    // Capturar screenshot para debug
    try {
      await bm.screenshot('error');
    } catch (e) {
      // Ignorar
    }

    process.exit(1);
  } finally {
    await bm.close();
  }
}

main();
