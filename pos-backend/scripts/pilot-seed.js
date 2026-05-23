/**
 * Script de Seed do Piloto Controlado — Fase 9
 *
 * Cria dados realistas para um food park com 4 operacoes + Central:
 *   PILOT_Hamburgueria, PILOT_Pizzaria, PILOT_Arabe, PILOT_Bar,
 *   PILOT_Central (almoxarifado central)
 *
 * Uso: node scripts/pilot-seed.js
 *
 * Para limpar dados do piloto: node scripts/pilot-seed.js --clean
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Store = require('../models/storeModel');
const User = require('../models/userModel');
const Role = require('../models/roleModel');
const GlobalIngredient = require('../models/globalIngredientModel');
const StockLocation = require('../models/stockLocationModel');
const StockBalance = require('../models/stockBalanceModel');
const StockPolicy = require('../models/stockPolicyModel');
const Category = require('../models/categoryModel');
const Product = require('../models/productModel');
const { createSystemRoles } = require('../controllers/roleController');

// ============================================================
// CONFIGURACAO DO PILOTO
// ============================================================
const PILOT_PREFIX = 'PILOT_';
const PILOT_STORES = [
  {
    name: `${PILOT_PREFIX}Hamburgueria`,
    cnpj: '11.111.111/0001-11',
    email: 'hamburgueria@pilot.com',
    phone: '(11) 91111-1111',
    operationType: 'hamburgueria',
    address: { street: 'Av. Principal', number: '100', neighborhood: 'Food Park', city: 'Sao Paulo', state: 'SP', zipCode: '01001-100' }
  },
  {
    name: `${PILOT_PREFIX}Pizzaria`,
    cnpj: '22.222.222/0001-22',
    email: 'pizzaria@pilot.com',
    phone: '(11) 92222-2222',
    operationType: 'pizzaria',
    address: { street: 'Av. Principal', number: '200', neighborhood: 'Food Park', city: 'Sao Paulo', state: 'SP', zipCode: '01001-200' }
  },
  {
    name: `${PILOT_PREFIX}Arabe`,
    cnpj: '33.333.333/0001-33',
    email: 'arabe@pilot.com',
    phone: '(11) 93333-3333',
    operationType: 'arabe',
    address: { street: 'Av. Principal', number: '300', neighborhood: 'Food Park', city: 'Sao Paulo', state: 'SP', zipCode: '01001-300' }
  },
  {
    name: `${PILOT_PREFIX}Bar`,
    cnpj: '44.444.444/0001-44',
    email: 'bar@pilot.com',
    phone: '(11) 94444-4444',
    operationType: 'bar',
    address: { street: 'Av. Principal', number: '400', neighborhood: 'Food Park', city: 'Sao Paulo', state: 'SP', zipCode: '01001-400' }
  },
  {
    name: `${PILOT_PREFIX}Central`,
    cnpj: '55.555.555/0001-55',
    email: 'central@pilot.com',
    phone: '(11) 95555-5555',
    operationType: 'geral',
    address: { street: 'Rua do Almoxarifado', number: '1', neighborhood: 'Distrito Industrial', city: 'Sao Paulo', state: 'SP', zipCode: '01002-000' }
  }
];

// ============================================================
// INGREDIENTES GLOBAIS — agrupados por categoria
// ============================================================
const PILOT_INGREDIENTS = [
  // ---------- Proteinas ----------
  { name: 'Carne Bovina (Acém)', category: 'proteina', baseUnit: 'g', averageCost: 0.032, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['hamburgueria', 'arabe', 'geral'] },
  { name: 'Carne Bovina (Fraldinha)', category: 'proteina', baseUnit: 'g', averageCost: 0.045, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['hamburgueria', 'geral'] },
  { name: 'Carne Bovina Moída', category: 'proteina', baseUnit: 'g', averageCost: 0.038, itemType: 'prepared', productionState: 'ground', compatibleOperations: ['hamburgueria', 'arabe', 'geral'] },
  { name: 'Frango (Peito)', category: 'proteina', baseUnit: 'g', averageCost: 0.025, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['arabe', 'hamburgueria', 'geral'] },
  { name: 'Peixe (Tilápia)', category: 'proteina', baseUnit: 'g', averageCost: 0.042, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['bar', 'geral'] },
  { name: 'Carne de Cordeiro', category: 'proteina', baseUnit: 'g', averageCost: 0.055, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['arabe', 'geral'] },
  { name: 'Calabresa', category: 'proteina', baseUnit: 'g', averageCost: 0.030, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['pizzaria', 'geral'] },
  { name: 'Bacon', category: 'proteina', baseUnit: 'g', averageCost: 0.050, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['hamburgueria', 'geral'] },
  { name: 'Ovo', category: 'proteina', baseUnit: 'unidade', averageCost: 0.80, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['hamburgueria', 'bar', 'geral'] },

  // ---------- Carboidratos ----------
  { name: 'Pão de Hambúrguer', category: 'carboidrato', baseUnit: 'unidade', averageCost: 1.20, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['hamburgueria', 'geral'] },
  { name: 'Pão Sírio', category: 'carboidrato', baseUnit: 'unidade', averageCost: 0.90, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['arabe', 'geral'] },
  { name: 'Farinha de Trigo', category: 'carboidrato', baseUnit: 'g', averageCost: 0.005, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['pizzaria', 'hamburgueria', 'arabe', 'geral'] },
  { name: 'Massa de Pizza (Pronta)', category: 'carboidrato', baseUnit: 'unidade', averageCost: 3.50, itemType: 'prepared', productionState: 'ready_to_use', compatibleOperations: ['pizzaria', 'geral'] },
  { name: 'Arroz Branco', category: 'carboidrato', baseUnit: 'g', averageCost: 0.008, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['arabe', 'bar', 'geral'] },
  { name: 'Batata', category: 'carboidrato', baseUnit: 'g', averageCost: 0.006, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['hamburgueria', 'bar', 'geral'] },
  { name: 'Batata Pré-Frita', category: 'carboidrato', baseUnit: 'g', averageCost: 0.015, itemType: 'prepared', productionState: 'portioned', compatibleOperations: ['hamburgueria', 'bar', 'geral'] },

  // ---------- Vegetais ----------
  { name: 'Alface', category: 'vegetal', baseUnit: 'unidade', averageCost: 2.50, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['hamburgueria', 'arabe', 'geral'] },
  { name: 'Tomate', category: 'vegetal', baseUnit: 'g', averageCost: 0.012, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['hamburgueria', 'pizzaria', 'arabe', 'bar', 'geral'] },
  { name: 'Cebola', category: 'vegetal', baseUnit: 'g', averageCost: 0.008, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['hamburgueria', 'pizzaria', 'arabe', 'bar', 'geral'] },
  { name: 'Pimentão', category: 'vegetal', baseUnit: 'g', averageCost: 0.015, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['pizzaria', 'arabe', 'geral'] },
  { name: 'Pepino', category: 'vegetal', baseUnit: 'g', averageCost: 0.010, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['arabe', 'geral'] },
  { name: 'Cenoura', category: 'vegetal', baseUnit: 'g', averageCost: 0.010, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['arabe', 'geral'] },
  { name: 'Rúcula', category: 'vegetal', baseUnit: 'unidade', averageCost: 3.00, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['pizzaria', 'hamburgueria', 'geral'] },

  // ---------- Laticínios ----------
  { name: 'Queijo Mussarela', category: 'laticinio', baseUnit: 'g', averageCost: 0.050, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['pizzaria', 'hamburgueria', 'arabe', 'bar', 'geral'] },
  { name: 'Queijo Parmesão', category: 'laticinio', baseUnit: 'g', averageCost: 0.065, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['pizzaria', 'hamburgueria', 'geral'] },
  { name: 'Queijo Provolone', category: 'laticinio', baseUnit: 'g', averageCost: 0.060, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['pizzaria', 'hamburgueria', 'geral'] },
  { name: 'Manteiga', category: 'laticinio', baseUnit: 'g', averageCost: 0.040, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['hamburgueria', 'pizzaria', 'arabe', 'bar', 'geral'] },
  { name: 'Creme de Leite', category: 'laticinio', baseUnit: 'g', averageCost: 0.030, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['pizzaria', 'bar', 'geral'] },
  { name: 'Iogurte Natural', category: 'laticinio', baseUnit: 'g', averageCost: 0.025, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['arabe', 'bar', 'geral'] },

  // ---------- Temperos e Condimentos ----------
  { name: 'Sal', category: 'tempero', baseUnit: 'g', averageCost: 0.002, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['hamburgueria', 'pizzaria', 'arabe', 'bar', 'geral'] },
  { name: 'Pimenta do Reino', category: 'tempero', baseUnit: 'g', averageCost: 0.12, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['hamburgueria', 'pizzaria', 'arabe', 'bar', 'geral'] },
  { name: 'Alho', category: 'tempero', baseUnit: 'g', averageCost: 0.08, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['hamburgueria', 'pizzaria', 'arabe', 'bar', 'geral'] },
  { name: 'Azeite de Oliva', category: 'tempero', baseUnit: 'ml', averageCost: 0.12, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['hamburgueria', 'pizzaria', 'arabe', 'bar', 'geral'] },
  { name: 'Óleo de Soja', category: 'tempero', baseUnit: 'ml', averageCost: 0.008, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['hamburgueria', 'pizzaria', 'arabe', 'bar', 'geral'] },
  { name: 'Extrato de Tomate', category: 'tempero', baseUnit: 'g', averageCost: 0.025, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['pizzaria', 'arabe', 'hamburgueria', 'geral'] },
  { name: 'Molho de Soja', category: 'tempero', baseUnit: 'ml', averageCost: 0.05, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['arabe', 'geral'] },
  { name: 'Orégano', category: 'tempero', baseUnit: 'g', averageCost: 0.10, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['pizzaria', 'geral'] },
  { name: 'Cominho', category: 'tempero', baseUnit: 'g', averageCost: 0.08, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['arabe', 'geral'] },
  { name: 'Hortelã', category: 'tempero', baseUnit: 'g', averageCost: 0.15, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['arabe', 'bar', 'geral'] },
  { name: 'Limão', category: 'tempero', baseUnit: 'unidade', averageCost: 1.20, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['bar', 'arabe', 'hamburgueria', 'geral'] },
  { name: 'Vinagre', category: 'tempero', baseUnit: 'ml', averageCost: 0.008, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['hamburgueria', 'arabe', 'bar', 'geral'] },

  // ---------- Bebidas ----------
  { name: 'Água Mineral (500ml)', category: 'bebida', baseUnit: 'unidade', averageCost: 2.00, itemType: 'packaging', productionState: 'ready_to_sell', compatibleOperations: ['hamburgueria', 'pizzaria', 'arabe', 'bar', 'geral'] },
  { name: 'Refrigerante Lata', category: 'bebida', baseUnit: 'unidade', averageCost: 3.50, itemType: 'packaging', productionState: 'ready_to_sell', compatibleOperations: ['hamburgueria', 'pizzaria', 'arabe', 'bar', 'geral'] },
  { name: 'Cerveja Lata', category: 'bebida', baseUnit: 'unidade', averageCost: 4.00, itemType: 'packaging', productionState: 'ready_to_sell', compatibleOperations: ['hamburgueria', 'pizzaria', 'bar', 'geral'] },
  { name: 'Cerveja Long Neck', category: 'bebida', baseUnit: 'unidade', averageCost: 5.50, itemType: 'packaging', productionState: 'ready_to_sell', compatibleOperations: ['bar', 'geral'] },
  { name: 'Suco Natural (Litro)', category: 'bebida', baseUnit: 'ml', averageCost: 0.025, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['bar', 'hamburgueria', 'geral'] },
  { name: 'Café', category: 'bebida', baseUnit: 'g', averageCost: 0.06, itemType: 'raw_material', productionState: 'raw', compatibleOperations: ['hamburgueria', 'pizzaria', 'bar', 'geral'] },
  { name: 'Água de Coco', category: 'bebida', baseUnit: 'unidade', averageCost: 3.00, itemType: 'packaging', productionState: 'ready_to_sell', compatibleOperations: ['bar', 'hamburgueria', 'geral'] },

  // ---------- Embalagens e Descartáveis ----------
  { name: 'Hamburger Paper', category: 'outro', baseUnit: 'unidade', averageCost: 0.15, itemType: 'packaging', productionState: 'ready_to_use', compatibleOperations: ['hamburgueria', 'geral'] },
  { name: 'Caixa de Pizza (Grande)', category: 'outro', baseUnit: 'unidade', averageCost: 1.80, itemType: 'packaging', productionState: 'ready_to_use', compatibleOperations: ['pizzaria', 'geral'] },
  { name: 'Caixa de Pizza (Média)', category: 'outro', baseUnit: 'unidade', averageCost: 1.50, itemType: 'packaging', productionState: 'ready_to_use', compatibleOperations: ['pizzaria', 'geral'] },
  { name: 'Saco de Papel', category: 'outro', baseUnit: 'unidade', averageCost: 0.10, itemType: 'packaging', productionState: 'ready_to_use', compatibleOperations: ['hamburgueria', 'pizzaria', 'arabe', 'bar', 'geral'] },
  { name: 'Luva Descartável', category: 'outro', baseUnit: 'pacote', averageCost: 5.00, itemType: 'consumable', productionState: 'ready_to_use', compatibleOperations: ['hamburgueria', 'pizzaria', 'arabe', 'bar', 'geral'] },
  { name: 'Papel Toalha', category: 'outro', baseUnit: 'pacote', averageCost: 3.00, itemType: 'consumable', productionState: 'ready_to_use', compatibleOperations: ['hamburgueria', 'pizzaria', 'arabe', 'bar', 'geral'] },
  { name: 'Detergente', category: 'outro', baseUnit: 'ml', averageCost: 0.01, itemType: 'consumable', productionState: 'ready_to_use', compatibleOperations: ['hamburgueria', 'pizzaria', 'arabe', 'bar', 'geral'] },
  { name: 'Álcool Gel', category: 'outro', baseUnit: 'ml', averageCost: 0.02, itemType: 'consumable', productionState: 'ready_to_use', compatibleOperations: ['hamburgueria', 'pizzaria', 'arabe', 'bar', 'geral'] },
];

// ============================================================
// USUARIOS DO PILOTO
// ============================================================
const PILOT_USERS = [
  // Usuário Master Admin (rede toda)
  { name: 'Admin Mestre do Piloto', email: 'piloto.admin@pos.com', password: 'admin123', isMasterAdmin: true, roleName: null },
  // Observador da rede (Viewer — enxerga tudo, nao executa nada)
  { name: 'Observador da Rede', email: 'piloto.viewer@pos.com', password: 'viewer123', isMasterAdmin: false, roleName: 'Viewer' },
];

// Usuários por loja
const PILOT_STORE_USERS = [
  { name: 'Gerente Hamburgueria', email: 'hamburgueria.gerente@pos.com', password: 'hamb123', roleName: 'Gerente', storeIndex: 0 },
  { name: 'Operador Hamburgueria', email: 'hamburgueria.operador@pos.com', password: 'hamb123', roleName: 'Operator', storeIndex: 0 },
  { name: 'Gerente Pizzaria', email: 'pizzaria.gerente@pos.com', password: 'pizz123', roleName: 'Gerente', storeIndex: 1 },
  { name: 'Operador Pizzaria', email: 'pizzaria.operador@pos.com', password: 'pizz123', roleName: 'Operator', storeIndex: 1 },
  { name: 'Gerente Árabe', email: 'arabe.gerente@pos.com', password: 'arabe123', roleName: 'Gerente', storeIndex: 2 },
  { name: 'Operador Árabe', email: 'arabe.operador@pos.com', password: 'arabe123', roleName: 'Operator', storeIndex: 2 },
  { name: 'Gerente Bar', email: 'bar.gerente@pos.com', password: 'bar123', roleName: 'Gerente', storeIndex: 3 },
  { name: 'Operador Bar', email: 'bar.operador@pos.com', password: 'bar123', roleName: 'Operator', storeIndex: 3 },
  { name: 'Gerente Central', email: 'central.gerente@pos.com', password: 'central123', roleName: 'Gerente', storeIndex: 4 },
  { name: 'Operador Central', email: 'central.operador@pos.com', password: 'central123', roleName: 'Operator', storeIndex: 4 },
];

// ============================================================
// CONFIGURACAO DE ESTOQUE INICIAL (storeIndex -> [{ingredientName, balance}])
// ============================================================
const PILOT_STOCK_INITIAL = [
  // Hamburgueria (index 0)
  {
    storeIndex: 0, balances: [
      { name: 'Carne Bovina Moída', balance: 15000 },       // 15kg
      { name: 'Pão de Hambúrguer', balance: 200 },           // 200 unidades
      { name: 'Queijo Mussarela', balance: 8000 },           // 8kg
      { name: 'Alface', balance: 40 },                       // 40 unidades
      { name: 'Tomate', balance: 6000 },                     // 6kg
      { name: 'Bacon', balance: 3000 },                      // 3kg
      { name: 'Batata Pré-Frita', balance: 12000 },          // 12kg
      { name: 'Óleo de Soja', balance: 10000 },              // 10L
      { name: 'Sal', balance: 2000 },                        // 2kg
      { name: 'Hamburger Paper', balance: 500 },             // 500 unidades
      { name: 'Refrigerante Lata', balance: 120 },            // 120 latas
      { name: 'Cerveja Lata', balance: 72 },                 // 72 latas
      { name: 'Água Mineral (500ml)', balance: 48 },          // 48 unidades
    ]
  },
  // Pizzaria (index 1)
  {
    storeIndex: 1, balances: [
      { name: 'Massa de Pizza (Pronta)', balance: 60 },       // 60 unidades
      { name: 'Queijo Mussarela', balance: 15000 },           // 15kg
      { name: 'Queijo Parmesão', balance: 3000 },             // 3kg
      { name: 'Calabresa', balance: 5000 },                   // 5kg
      { name: 'Extrato de Tomate', balance: 8000 },           // 8kg
      { name: 'Orégano', balance: 200 },                      // 200g
      { name: 'Cebola', balance: 3000 },                      // 3kg
      { name: 'Pimentão', balance: 2000 },                    // 2kg
      { name: 'Rúcula', balance: 20 },                        // 20 unidades
      { name: 'Creme de Leite', balance: 4000 },              // 4kg
      { name: 'Sal', balance: 1000 },                         // 1kg
      { name: 'Azeite de Oliva', balance: 2000 },             // 2L
      { name: 'Caixa de Pizza (Grande)', balance: 200 },      // 200 unidades
      { name: 'Caixa de Pizza (Média)', balance: 150 },       // 150 unidades
      { name: 'Refrigerante Lata', balance: 96 },              // 96 latas
      { name: 'Água Mineral (500ml)', balance: 36 },          // 36 unidades
    ]
  },
  // Árabe (index 2)
  {
    storeIndex: 2, balances: [
      { name: 'Carne de Cordeiro', balance: 8000 },           // 8kg
      { name: 'Frango (Peito)', balance: 6000 },              // 6kg
      { name: 'Pão Sírio', balance: 150 },                    // 150 unidades
      { name: 'Arroz Branco', balance: 10000 },               // 10kg
      { name: 'Iogurte Natural', balance: 5000 },             // 5kg
      { name: 'Hortelã', balance: 300 },                      // 300g
      { name: 'Alface', balance: 30 },                        // 30 unidades
      { name: 'Tomate', balance: 4000 },                      // 4kg
      { name: 'Cebola', balance: 4000 },                      // 4kg
      { name: 'Pepino', balance: 3000 },                      // 3kg
      { name: 'Molho de Soja', balance: 2000 },               // 2L
      { name: 'Azeite de Oliva', balance: 3000 },             // 3L
      { name: 'Sal', balance: 1500 },                         // 1.5kg
      { name: 'Limão', balance: 30 },                         // 30 unidades
      { name: 'Refrigerante Lata', balance: 72 },             // 72 latas
      { name: 'Água Mineral (500ml)', balance: 48 },          // 48 unidades
    ]
  },
  // Bar (index 3)
  {
    storeIndex: 3, balances: [
      { name: 'Cerveja Lata', balance: 192 },                  // 192 latas
      { name: 'Cerveja Long Neck', balance: 96 },              // 96 units
      { name: 'Refrigerante Lata', balance: 144 },             // 144 latas
      { name: 'Água Mineral (500ml)', balance: 72 },           // 72 unidades
      { name: 'Água de Coco', balance: 48 },                  // 48 unidades
      { name: 'Suco Natural (Litro)', balance: 10000 },        // 10L
      { name: 'Limão', balance: 60 },                         // 60 unidades
      { name: 'Peixe (Tilápia)', balance: 4000 },             // 4kg
      { name: 'Batata Pré-Frita', balance: 8000 },            // 8kg
      { name: 'Óleo de Soja', balance: 8000 },                 // 8L
      { name: 'Sal', balance: 500 },                          // 500g
      { name: 'Café', balance: 2000 },                        // 2kg
      { name: 'Açúcar', balance: 3000 },                      // 3kg
    ]
  },
  // Central (index 4) — estoque grande para abastecer as lojas
  {
    storeIndex: 4, balances: [
      { name: 'Carne Bovina Moída', balance: 60000 },         // 60kg
      { name: 'Pão de Hambúrguer', balance: 1000 },           // 1000 unidades
      { name: 'Massa de Pizza (Pronta)', balance: 300 },       // 300 unidades
      { name: 'Queijo Mussarela', balance: 40000 },            // 40kg
      { name: 'Queijo Parmesão', balance: 10000 },             // 10kg
      { name: 'Calabresa', balance: 15000 },                   // 15kg
      { name: 'Bacon', balance: 10000 },                       // 10kg
      { name: 'Batata Pré-Frita', balance: 30000 },            // 30kg
      { name: 'Óleo de Soja', balance: 40000 },                // 40L
      { name: 'Extrato de Tomate', balance: 25000 },           // 25kg
      { name: 'Azeite de Oliva', balance: 15000 },             // 15L
      { name: 'Sal', balance: 10000 },                         // 10kg
      { name: 'Caixa de Pizza (Grande)', balance: 500 },       // 500 unidades
      { name: 'Caixa de Pizza (Média)', balance: 400 },        // 400 unidades
      { name: 'Hamburger Paper', balance: 1000 },              // 1000 unidades
      { name: 'Refrigerante Lata', balance: 600 },             // 600 latas
      { name: 'Cerveja Lata', balance: 400 },                  // 400 latas
      { name: 'Água Mineral (500ml)', balance: 300 },          // 300 unidades
      { name: 'Café', balance: 5000 },                        // 5kg
      { name: 'Saco de Papel', balance: 1000 },               // 1000 unidades
      { name: 'Luva Descartável', balance: 30 },              // 30 pacotes
      { name: 'Papel Toalha', balance: 20 },                   // 20 pacotes
      { name: 'Detergente', balance: 10000 },                  // 10L
      { name: 'Álcool Gel', balance: 10000 },                  // 10L
    ]
  }
];

// ============================================================
// POLITICAS DE ESTOQUE (storeIndex -> [{ingredientName, min, reorder, ideal, max, priority}])
// ============================================================
const PILOT_POLICIES = [
  // Hamburgueria (index 0)
  { storeIndex: 0, policies: [
    { name: 'Carne Bovina Moída', min: 5000, reorder: 8000, ideal: 15000, max: 25000, priority: 'high' },
    { name: 'Pão de Hambúrguer', min: 80, reorder: 120, ideal: 200, max: 400, priority: 'high' },
    { name: 'Queijo Mussarela', min: 3000, reorder: 5000, ideal: 8000, max: 15000, priority: 'high' },
    { name: 'Alface', min: 15, reorder: 25, ideal: 40, max: 80, priority: 'medium' },
    { name: 'Tomate', min: 2000, reorder: 4000, ideal: 6000, max: 10000, priority: 'medium' },
    { name: 'Bacon', min: 1000, reorder: 2000, ideal: 4000, max: 8000, priority: 'low' },
    { name: 'Batata Pré-Frita', min: 5000, reorder: 8000, ideal: 12000, max: 20000, priority: 'medium' },
    { name: 'Óleo de Soja', min: 3000, reorder: 5000, ideal: 10000, max: 20000, priority: 'medium' },
  ]},
  // Pizzaria (index 1)
  { storeIndex: 1, policies: [
    { name: 'Massa de Pizza (Pronta)', min: 20, reorder: 40, ideal: 60, max: 120, priority: 'high' },
    { name: 'Queijo Mussarela', min: 5000, reorder: 8000, ideal: 15000, max: 25000, priority: 'high' },
    { name: 'Queijo Parmesão', min: 1000, reorder: 2000, ideal: 3000, max: 6000, priority: 'low' },
    { name: 'Calabresa', min: 2000, reorder: 3000, ideal: 5000, max: 10000, priority: 'medium' },
    { name: 'Extrato de Tomate', min: 3000, reorder: 5000, ideal: 8000, max: 15000, priority: 'high' },
    { name: 'Cebola', min: 1000, reorder: 2000, ideal: 3000, max: 6000, priority: 'low' },
    { name: 'Azeite de Oliva', min: 500, reorder: 1000, ideal: 2000, max: 5000, priority: 'low' },
  ]},
  // Árabe (index 2)
  { storeIndex: 2, policies: [
    { name: 'Carne de Cordeiro', min: 3000, reorder: 5000, ideal: 8000, max: 15000, priority: 'high' },
    { name: 'Frango (Peito)', min: 2000, reorder: 4000, ideal: 6000, max: 12000, priority: 'medium' },
    { name: 'Pão Sírio', min: 50, reorder: 100, ideal: 150, max: 300, priority: 'high' },
    { name: 'Arroz Branco', min: 3000, reorder: 6000, ideal: 10000, max: 20000, priority: 'medium' },
    { name: 'Iogurte Natural', min: 2000, reorder: 3000, ideal: 5000, max: 10000, priority: 'medium' },
    { name: 'Alface', min: 10, reorder: 20, ideal: 30, max: 60, priority: 'medium' },
    { name: 'Tomate', min: 1500, reorder: 3000, ideal: 4000, max: 8000, priority: 'medium' },
    { name: 'Limão', min: 10, reorder: 20, ideal: 30, max: 60, priority: 'low' },
  ]},
  // Bar (index 3)
  { storeIndex: 3, policies: [
    { name: 'Cerveja Lata', min: 72, reorder: 120, ideal: 192, max: 300, priority: 'high' },
    { name: 'Cerveja Long Neck', min: 36, reorder: 60, ideal: 96, max: 200, priority: 'medium' },
    { name: 'Refrigerante Lata', min: 48, reorder: 96, ideal: 144, max: 250, priority: 'high' },
    { name: 'Água Mineral (500ml)', min: 24, reorder: 48, ideal: 72, max: 144, priority: 'medium' },
    { name: 'Limão', min: 24, reorder: 40, ideal: 60, max: 120, priority: 'high' },
    { name: 'Batata Pré-Frita', min: 3000, reorder: 5000, ideal: 8000, max: 15000, priority: 'medium' },
    { name: 'Café', min: 500, reorder: 1000, ideal: 2000, max: 5000, priority: 'low' },
  ]},
  // Central (index 4) — sem políticas (central nao consome diretamente)
];

// ============================================================
// HELPERS
// ============================================================
function logSection(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function logItem(label, detail) {
  console.log(`  [${label}] ${detail}`);
}

// ============================================================
// MAIN
// ============================================================
async function seedPilot() {
  console.log('\n=== SEED DO PILOTO CONTROLADO (Fase 9) ===\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado ao MongoDB\n');

  // ---- 1. CRIAR STORES ----
  logSection('1. CRIANDO STORES DO PILOTO');
  const stores = [];
  for (const storeData of PILOT_STORES) {
    let store = await Store.findOne({ cnpj: storeData.cnpj });
    if (!store) {
      store = await Store.create({
        ...storeData,
        subscriptionPlan: 'pro',
        settings: { taxRate: 5.25, currency: 'BRL', timezone: 'America/Sao_Paulo' },
        isActive: true
      });
      logItem('CRIADO', `${store.name}`);
    } else {
      logItem('EXISTE', `${store.name} (ID: ${store._id})`);
    }
    stores.push(store);
  }

  // ---- 2. CRIAR ROLES DO SISTEMA ----
  logSection('2. CRIANDO ROLES DO SISTEMA + VIEWER + OPERATOR');
  const roleNames = ['Admin', 'Gerente', 'Caixa', 'Garçom', 'Viewer', 'Operator'];
  const roleMap = {};

  // Criar roles em cada loja (ou globais)
  for (const store of stores) {
    await createSystemRoles(store._id);

    // Criar role Viewer se nao existir (read-only)
    const viewerRole = await Role.findOne({ store: store._id, name: 'Viewer' });
    if (!viewerRole) {
      await Role.create({
        store: store._id,
        name: 'Viewer',
        description: 'Visualizador — acesso somente leitura a todos os modulos',
        permissions: {
          orders: { create: false, read: true, update: false, delete: false, cancel: false },
          tables: { create: false, read: true, update: false, delete: false },
          products: { create: false, read: true, update: false, delete: false },
          inventory: { create: false, read: true, update: false, delete: false, adjust: false, transfer: false },
          payments: { create: false, read: true, refund: false },
          users: { create: false, read: false, update: false, delete: false, manageRoles: false },
          devices: { read: false, approve: false, revoke: false },
          reports: { read: false, export: false, financial: false },
          settings: { read: false, update: false }
        },
        isSystem: true
      });
      logItem('CRIADO', `Role "Viewer" para loja ${store.name}`);
    } else {
      logItem('EXISTE', `Role "Viewer" para loja ${store.name}`);
    }

    // Criar role Operator se nao existir
    const operatorRole = await Role.findOne({ store: store._id, name: 'Operator' });
    if (!operatorRole) {
      await Role.create({
        store: store._id,
        name: 'Operator',
        description: 'Operador de loja — acesso a estoque, alertas, transferencias',
        permissions: {
          orders: { create: true, read: true, update: true, delete: false, cancel: true },
          tables: { create: false, read: true, update: true, delete: false },
          products: { create: false, read: true, update: false, delete: false },
          inventory: { create: false, read: true, update: false, delete: false, adjust: true, transfer: true },
          payments: { create: false, read: true, refund: false },
          users: { create: false, read: false, update: false, delete: false, manageRoles: false },
          devices: { read: false, approve: false, revoke: false },
          reports: { read: true, export: false, financial: false },
          settings: { read: false, update: false }
        },
        isSystem: true
      });
      logItem('CRIADO', `Role "Operator" para loja ${store.name}`);
    } else {
      logItem('EXISTE', `Role "Operator" para loja ${store.name}`);
    }
  }

  // Mapa de roles para o store[0] (usado pelos usuarios piloto)
  for (const name of roleNames) {
    roleMap[name] = await Role.findOne({ store: stores[0]._id, name });
  }

  // ---- 3. CRIAR USUARIOS ----
  logSection('3. CRIANDO USUARIOS DO PILOTO');

  // Master Admin — password plain text (pre-save hook no model faz o hash)
  for (const userData of PILOT_USERS) {
    let user = await User.findOne({ email: userData.email });
    if (!user) {
      user = await User.create({
        name: userData.name,
        email: userData.email,
        phone: 11988888888,
        password: userData.password,
        role: roleMap[userData.roleName]?._id || 'Admin',
        store: stores[0]._id,
        isMasterAdmin: userData.isMasterAdmin,
        isActive: true
      });
      logItem('CRIADO', `${userData.name} (${userData.email} / ${userData.password})`);
    } else {
      logItem('EXISTE', `${userData.email}`);
    }
  }

  // Usuários de loja — password plain text (pre-save hook no model faz o hash)
  for (const userData of PILOT_STORE_USERS) {
    let user = await User.findOne({ email: userData.email });
    if (!user) {
      const targetStore = stores[userData.storeIndex];
      // Buscar role na loja correta
      const role = await Role.findOne({ store: targetStore._id, name: userData.roleName });
      user = await User.create({
        name: userData.name,
        email: userData.email,
        phone: 11977777777,
        password: userData.password,
        role: role?._id || 'Garçom',
        store: targetStore._id,
        isMasterAdmin: false,
        isActive: true
      });
      logItem('CRIADO', `${userData.name} (${userData.email} / ${userData.password}) @ ${targetStore.name}`);
    } else {
      logItem('EXISTE', `${userData.email}`);
    }
  }

  // ---- 4. CRIAR INGREDIENTES GLOBAIS ----
  logSection('4. CRIANDO INGREDIENTES GLOBAIS');

  // Mapa de ingredientes
  const ingredientMap = {};
  for (const ingData of PILOT_INGREDIENTS) {
    let ingredient = await GlobalIngredient.findOne({ name: ingData.name });
    if (!ingredient) {
      ingredient = await GlobalIngredient.create({
        ...ingData,
        isActive: true,
        conversionToBase: ingData.baseUnit === 'g' || ingData.baseUnit === 'kg'
          ? new Map([['kg', 1000], ['g', 1]])
          : ingData.baseUnit === 'ml' || ingData.baseUnit === 'L'
            ? new Map([['L', 1000], ['ml', 1]])
            : undefined
      });
      logItem('CRIADO', `${ingredient.name} (${ingredient.category})`);
    }
    ingredientMap[ingData.name] = ingredient;
  }

  // ---- 5. CRIAR LOCALIZACOES DE ESTOQUE ----
  logSection('5. CRIANDO LOCALIZACOES DE ESTOQUE');

  const locationMap = {};
  for (const store of stores) {
    // Localização padrão da loja
    let storeLoc = await StockLocation.findOne({
      store: store._id,
      type: 'STORE'
    });
    if (!storeLoc) {
      storeLoc = await StockLocation.create({
        name: `Estoque - ${store.name}`,
        type: 'STORE',
        store: store._id,
        description: `Localizacao padrao da ${store.name}`,
        isActive: true
      });
      logItem('CRIADO', `${storeLoc.name}`);
    }
    locationMap[`store:${store._id}`] = storeLoc;
  }

  // Central compartilhado (único, sem store)
  let centralLoc = await StockLocation.findOne({
    type: 'CENTRAL_WAREHOUSE',
    store: null
  });
  if (!centralLoc) {
    centralLoc = await StockLocation.create({
      name: 'Almoxarifado Central Compartilhado',
      type: 'CENTRAL_WAREHOUSE',
      store: null,
      description: 'Estoque central do Food Park — abastece todas as operacoes',
      isActive: true
    });
    logItem('CRIADO', `Almoxarifado Central Compartilhado`);
  }
  locationMap['central'] = centralLoc;

  // ---- 6. CRIAR SALDOS DE ESTOQUE INICIAIS ----
  logSection('6. CRIANDO SALDOS DE ESTOQUE INICIAIS');

  for (const storeStock of PILOT_STOCK_INITIAL) {
    const store = stores[storeStock.storeIndex];
    const location = storeStock.storeIndex === 4
      ? locationMap['central']
      : locationMap[`store:${store._id}`];

    for (const balanceData of storeStock.balances) {
      const ingredient = ingredientMap[balanceData.name];
      if (!ingredient) {
        console.warn(`  [AVISO] Ingrediente "${balanceData.name}" nao encontrado. Pulando.`);
        continue;
      }

      let existing = await StockBalance.findOne({
        location: location._id,
        ingredient: ingredient._id
      });

      if (!existing) {
        await StockBalance.create({
          store: store._id,
          location: location._id,
          ingredient: ingredient._id,
          balance: balanceData.balance,
          reserved: 0,
          available: balanceData.balance,
          minimumStock: 0,
          unit: ingredient.baseUnit,
          lastPurchasePrice: ingredient.averageCost,
          lastPurchaseDate: new Date('2026-05-20')
        });
        logItem('ESTOQUE', `${ingredient.name}: ${balanceData.balance} ${ingredient.baseUnit} em ${store.name}`);
      }
    }
  }

  // ---- 7. CRIAR POLITICAS DE ESTOQUE ----
  logSection('7. CRIANDO POLITICAS DE ESTOQUE');

  for (const storePolicy of PILOT_POLICIES) {
    const store = stores[storePolicy.storeIndex];
    const location = storePolicy.storeIndex === 4
      ? locationMap['central']
      : locationMap[`store:${store._id}`];

    for (const policyData of storePolicy.policies) {
      const ingredient = ingredientMap[policyData.name];
      if (!ingredient) {
        console.warn(`  [AVISO] Ingrediente "${policyData.name}" nao encontrado. Pulando.`);
        continue;
      }

      let existing = await StockPolicy.findOne({
        store: store._id,
        location: location._id,
        ingredient: ingredient._id
      });

      if (!existing) {
        await StockPolicy.create({
          store: store._id,
          location: location._id,
          ingredient: ingredient._id,
          minQuantity: policyData.min,
          reorderPoint: policyData.reorder,
          idealQuantity: policyData.ideal,
          maxQuantity: policyData.max,
          unit: ingredient.baseUnit,
          priority: policyData.priority,
          isActive: true
        });
        logItem('POLITICA', `${ingredient.name}: min=${policyData.min} reorder=${policyData.reorder} ideal=${policyData.ideal} max=${policyData.max} (${store.name})`);
      }
    }
  }

  // ---- 8. CRIAR CATEGORIAS E PRODUTOS BÁSICOS ----
  logSection('8. CRIANDO CATEGORIAS E PRODUTOS BASICOS');

  for (const store of stores) {
    const categoriesData = [
      { name: 'Bebidas', description: 'Bebidas em geral', order: 0 },
      { name: 'Lanches', description: 'Lanches e sanduíches', order: 1 },
      { name: 'Pratos Principais', description: 'Pratos de almoço e jantar', order: 2 },
      { name: 'Entradas', description: 'Aperitivos e entradas', order: 4 }
    ];

    for (const catData of categoriesData) {
      let category = await Category.findOne({ store: store._id, name: catData.name });
      if (!category) {
        category = await Category.create({ store: store._id, ...catData });
      }
    }
    logItem('CATEGORIAS', `${categoriesData.length} categorias configuradas para ${store.name}`);
  }

  // ============================================================
  // RESUMO
  // ============================================================
  logSection('RESUMO DO PILOTO');

  const totalStores = await Store.countDocuments({ name: { $regex: `^${PILOT_PREFIX}` } });
  const totalUsers = await User.countDocuments({ email: { $regex: /@pos\.com$/ } });
  const totalIngredients = await GlobalIngredient.countDocuments({ name: { $in: PILOT_INGREDIENTS.map(i => i.name) } });
  const totalStockBalances = await StockBalance.countDocuments({ store: { $in: stores.map(s => s._id) } });
  const totalPolicies = await StockPolicy.countDocuments({ store: { $in: stores.map(s => s._id) } });
  const totalRoles = await Role.countDocuments({ store: { $in: [...stores.map(s => s._id), null] } });

  console.log(`\n  Lojas do Piloto:       ${totalStores}`);
  console.log(`  Usuarios:              ${totalUsers}`);
  console.log(`  Ingredientes Globais:  ${totalIngredients}`);
  console.log(`  Saldos de Estoque:     ${totalStockBalances}`);
  console.log(`  Politicas de Estoque:  ${totalPolicies}`);
  console.log(`  Roles:                 ${totalRoles}`);

  console.log('\n  CREDENCIAIS:\n');
  console.log(`     Master Admin:    piloto.admin@pos.com / admin123`);
  console.log(`     Viewer:          piloto.viewer@pos.com / viewer123`);
  console.log(`     Gerente Hamburg: hamburgueria.gerente@pos.com / hamb123`);
  console.log(`     Operador Hamburg: hamburgueria.operador@pos.com / hamb123`);
  console.log(`     Gerente Pizzaria: pizzaria.gerente@pos.com / pizz123`);
  console.log(`     Operador Pizzaria: pizzaria.operador@pos.com / pizz123`);
  console.log(`     Gerente Arabe:   arabe.gerente@pos.com / arabe123`);
  console.log(`     Operador Arabe:  arabe.operador@pos.com / arabe123`);
  console.log(`     Gerente Bar:     bar.gerente@pos.com / bar123`);
  console.log(`     Operador Bar:    bar.operador@pos.com / bar123`);
  console.log(`     Gerente Central: central.gerente@pos.com / central123`);
  console.log(`     Operador Central: central.operador@pos.com / central123`);

  console.log('\n  Para limpar: node scripts/pilot-seed.js --clean\n');

  await mongoose.connection.close();
  process.exit(0);
}

// ============================================================
// CLEAN
// ============================================================
async function cleanPilot() {
  console.log('\n=== LIMPANDO DADOS DO PILOTO ===\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado ao MongoDB\n');

  const pilotStoreIds = (await Store.find({ name: { $regex: `^${PILOT_PREFIX}` } }).select('_id')).map(s => s._id);
  const pilotEmails = [
    'piloto.admin@pos.com', 'piloto.viewer@pos.com',
    ...PILOT_STORE_USERS.map(u => u.email)
  ];

  console.log(`  Lojas piloto encontradas: ${pilotStoreIds.length}`);

  // Ordem import para respeitar foreign keys
  await StockPolicy.deleteMany({ store: { $in: pilotStoreIds } });
  console.log('  Politicas: removidas');

  await StockBalance.deleteMany({ store: { $in: pilotStoreIds } });
  console.log('  Saldos: removidos');

  // Movimentacoes associadas
  const StockMovement = require('../models/stockMovementModel');
  const OperationalAlert = require('../models/operationalAlertModel');
  const OperationalAuditLog = require('../models/operationalAuditLogModel');

  await StockMovement.deleteMany({ store: { $in: pilotStoreIds } });
  console.log('  Movimentacoes: removidas');

  await OperationalAlert.deleteMany({ store: { $in: pilotStoreIds } });
  console.log('  Alertas: removidos');

  await OperationalAuditLog.deleteMany({ store: { $in: pilotStoreIds } });
  console.log('  Logs de auditoria: removidos');

  // Usuarios
  await User.deleteMany({ email: { $in: pilotEmails } });
  console.log('  Usuarios: removidos');

  // Produtos e categorias
  const Product = require('../models/productModel');
  const Category = require('../models/categoryModel');
  await Product.deleteMany({ store: { $in: pilotStoreIds } });
  await Category.deleteMany({ store: { $in: pilotStoreIds } });
  console.log('  Produtos/Categorias: removidos');

  // Roles
  await Role.deleteMany({ store: { $in: pilotStoreIds } });
  console.log('  Roles: removidas');

  // Localizacoes (apenas as das lojas piloto — nao remover central se houver outros dados)
  const stockLocationIds = (await StockLocation.find({ store: { $in: pilotStoreIds } }).select('_id')).map(l => l._id);
  await StockLocation.deleteMany({ _id: { $in: stockLocationIds } });
  console.log('  Localizacoes de loja: removidas');

  // Lojas
  await Store.deleteMany({ _id: { $in: pilotStoreIds } });
  console.log('  Lojas: removidas');

  console.log('\n  NOTA: Ingredientes globais NAO foram removidos (compartilhados com outros ambientes)');
  console.log('  Para remover ingredientes do piloto manualmente, use:');
  console.log('  db.globalingredients.deleteMany({name: /PILOT_/})');
  console.log('\nLimpeza concluida.\n');

  await mongoose.connection.close();
  process.exit(0);
}

// ============================================================
// ENTRY POINT
// ============================================================
const isClean = process.argv.includes('--clean');
if (isClean) {
  cleanPilot();
} else {
  seedPilot();
}
