# 🏗️ Plano de Implementação: PDV Multi-Loja SaaS

## Contexto

Este plano descreve a transformação do "Restaurant_POS_System" (atualmente single-tenant) em uma plataforma SaaS multi-loja com:
- **Multi-tenancy** via `storeId` (UUID) em todas as coleções
- **Gestão de Estoque Centralizado** com ingredientes globais e fichas técnicas
- **Segurança Aprimorada** com aprovação de dispositivos
- **Backend-Centric Architecture** com todos os cálculos no servidor
- **Tempo Real** via Socket.io para atualizações de estoque
- **Inteligência de Demanda** com sugestão de compras

**Estado Atual:**
- Produtos/categorias hardcoded no frontend (`constants/index.js`)
- Backend gerencia apenas: orders, users, tables, payments
- Sem isolamento por loja/tenant
- Sem controle de estoque ou receitas

---

## 1. Modelagem de Dados (Backend)

### 1.1 Novos Schemas a Criar

#### **Store Model** (`models/storeModel.js`)
```javascript
const storeSchema = new Schema({
  name: { type: String, required: true },
  cnpj: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: {
    street: String,
    number: String,
    neighborhood: String,
    city: String,
    state: String,
    zipCode: String
  },
  isActive: { type: Boolean, default: true },
  subscriptionPlan: {
    type: String,
    enum: ['basic', 'pro', 'enterprise'],
    default: 'basic'
  },
  settings: {
    taxRate: { type: Number, default: 5.25 },
    currency: { type: String, default: 'BRL' },
    timezone: { type: String, default: 'America/Sao_Paulo' }
  }
}, { timestamps: true });
```

#### **GlobalIngredient Model** (`models/globalIngredientModel.js`)
```javascript
const globalIngredientSchema = new Schema({
  name: { type: String, required: true, unique: true },
  category: { 
    type: String, 
    enum: ['proteina', 'carboidrato', 'vegetal', 'laticinio', 'tempero', 'bebida', 'outro'],
    required: true 
  },
  baseUnit: { 
    type: String, 
    enum: ['g', 'kg', 'ml', 'L', 'unidade'], 
    required: true 
  },
  conversionToBase: { type: Map, of: Number }, // Ex: { 'xícara': 240, 'colher': 15 } para ml
  averageCost: { type: Number, required: true }, // Custo por unidade base
  supplier: { type: Schema.Types.ObjectId, ref: 'Supplier' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
```

#### **Product Model** (`models/productModel.js`)
```javascript
const productSchema = new Schema({
  storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
  name: { type: String, required: true },
  description: String,
  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  price: { type: Number, required: true },
  cost: { type: Number }, // Custo para cálculo de margem
  type: { 
    type: String, 
    enum: ['vegetariano', 'vegano', 'onivoro'],
    default: 'onivoro'
  },
  temperature: { 
    type: String, 
    enum: ['quente', 'frio', 'ambiente'],
    default: 'ambiente'
  },
  isAlcoholic: { type: Boolean, default: false },
  images: [String],
  isActive: { type: Boolean, default: true },
  isAvailable: { type: Boolean, default: true }, // Controlado pelo estoque
  preparationTime: Number, // minutos
  allergens: [String],
  nutritionalInfo: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number
  }
}, { timestamps: true });

productSchema.index({ storeId: 1, category: 1 });
productSchema.index({ storeId: 1, isActive: 1, isAvailable: 1 });
```

#### **Category Model** (`models/categoryModel.js`)
```javascript
const categorySchema = new Schema({
  storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
  name: { type: String, required: true },
  icon: { type: String, default: '🍽️' },
  color: String, // Cor do card no frontend
  description: String,
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

categorySchema.index({ storeId: 1, sortOrder: 1 });
```

#### **Recipe (Ficha Técnica) Model** (`models/recipeModel.js`)
```javascript
const recipeSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
  storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
  ingredients: [{
    ingredient: { 
      type: Schema.Types.ObjectId, 
      ref: 'GlobalIngredient', 
      required: true 
    },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true }, // unidade de entrada
    quantityInBaseUnit: { type: Number, required: true } // convertido para base
  }],
  yieldQuantity: { type: Number, default: 1 }, // Rendimento da receita
  yieldUnit: { type: String }, // Unidade do rendimento
  preparationSteps: [String],
  notes: String
}, { timestamps: true });

recipeSchema.index({ storeId: 1 });
```

#### **Inventory Model** (`models/inventoryModel.js`)
```javascript
const inventorySchema = new Schema({
  storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
  ingredient: { 
    type: Schema.Types.ObjectId, 
    ref: 'GlobalIngredient', 
    required: true 
  },
  quantity: { type: Number, required: true, default: 0 },
  unit: { type: String, required: true },
  minThreshold: { type: Number, required: true }, // Ponto de reposição
  maxCapacity: { type: Number },
  status: { 
    type: String, 
    enum: ['em_estoque', 'baixo', 'esgotado', 'em_transito'],
    default: 'em_estoque'
  },
  lastRestocked: Date,
  nextDelivery: Date,
  location: String // Prateleira/armazém
}, { timestamps: true });

inventorySchema.index({ storeId: 1, ingredient: 1 }, { unique: true });
inventorySchema.index({ storeId: 1, status: 1 });
```

#### **StockMovement Model** (`models/stockMovementModel.js`)
```javascript
const stockMovementSchema = new Schema({
  storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
  ingredient: { 
    type: Schema.Types.ObjectId, 
    ref: 'GlobalIngredient', 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['entrada', 'saida', 'ajuste', 'transferencia', 'perda'],
    required: true 
  },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  reason: String,
  reference: {
    type: Schema.Types.Mixed, // { type: 'order', id: '...' } ou { type: 'purchase_order', id: '...' }
  },
  performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

stockMovementSchema.index({ storeId: 1, ingredient: 1, createdAt: -1 });
```

#### **PurchaseOrder Model** (`models/purchaseOrderModel.js`)
```javascript
const purchaseOrderSchema = new Schema({
  storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
  supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  items: [{
    ingredient: { type: Schema.Types.ObjectId, ref: 'GlobalIngredient', required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    unitCost: { type: Number, required: true },
    totalCost: { type: Number, required: true }
  }],
  totalAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['rascunho', 'pendente', 'aprovado', 'enviado', 'recebido', 'cancelado'],
    default: 'rascunho'
  },
  expectedDelivery: Date,
  actualDelivery: Date,
  notes: String
}, { timestamps: true });
```

#### **Device Model** (`models/deviceModel.js`)
```javascript
const deviceSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  store: { type: Schema.Types.ObjectId, ref: 'Store', index: true },
  deviceId: { type: String, required: true, index: true }, // Hash fingerprint
  deviceInfo: {
    userAgent: String,
    browser: String,
    os: String,
    ip: String,
    device: String // mobile, desktop, tablet
  },
  isApproved: { type: Boolean, default: false },
  isCurrent: { type: Boolean, default: false },
  lastActiveAt: Date,
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date
}, { timestamps: true });

deviceSchema.index({ user: 1, deviceId: 1 }, { unique: true });
```

#### **SessionLog Model** (`models/sessionLogModel.js`)
```javascript
const sessionLogSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  store: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
  device: { type: Schema.Types.ObjectId, ref: 'Device' },
  action: { type: String, required: true }, // 'login', 'logout', 'order_created', etc.
  metadata: Schema.Types.Mixed, // Dados específicos da ação
  ipAddress: String
}, { timestamps: true });

sessionLogSchema.index({ storeId: 1, createdAt: -1 });
```

---

### 1.2 Modificações em Schemas Existentes

#### **Order Model** (Adicionar campos)
```javascript
// Adicionar no início do schema
storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
device: { type: Schema.Types.ObjectId, ref: 'Device' },

// Modificar items para ter schema definido
items: [{
  product: { type: Schema.Types.ObjectId, ref: 'Product' },
  name: String, // Snapshot do nome
  pricePerQuantity: Number,
  quantity: Number,
  price: Number,
  notes: String,
  recipe: { type: Schema.Types.ObjectId, ref: 'Recipe' } // Para baixa de estoque
}],

// Adicionar metadados de sessão
sessionMetadata: {
  tableTime: Number, // Tempo em minutos na mesa
  edits: [{
    timestamp: Date,
    field: String,
    oldValue: Mixed,
    newValue: Mixed
  }]
}
```

#### **User Model** (Adicionar campos)
```javascript
store: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
isMasterAdmin: { type: Boolean, default: false },
lastLoginAt: Date,
lastDevice: { type: Schema.Types.ObjectId, ref: 'Device' }
```

#### **Table Model** (Adicionar campos)
```javascript
storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
section: String, // Área do restaurante
```

#### **Payment Model** (Adicionar campos)
```javascript
storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
order: { type: Schema.Types.ObjectId, ref: 'Order' }
```

---

## 2. Backend Implementation

### 2.1 Estrutura de Diretórios

```
pos-backend/
├── models/
│   ├── storeModel.js           (NOVO)
│   ├── globalIngredientModel.js (NOVO)
│   ├── productModel.js          (NOVO)
│   ├── categoryModel.js         (NOVO)
│   ├── recipeModel.js           (NOVO)
│   ├── inventoryModel.js        (NOVO)
│   ├── stockMovementModel.js    (NOVO)
│   ├── purchaseOrderModel.js    (NOVO)
│   ├── deviceModel.js           (NOVO)
│   ├── sessionLogModel.js       (NOVO)
│   ├── orderModel.js            (MODIFICAR)
│   ├── userModel.js             (MODIFICAR)
│   ├── tableModel.js            (MODIFICAR)
│   └── paymentModel.js          (MODIFICAR)
├── controllers/
│   ├── storeController.js       (NOVO)
│   ├── productController.js     (NOVO)
│   ├── categoryController.js    (NOVO)
│   ├── ingredientController.js  (NOVO)
│   ├── recipeController.js      (NOVO)
│   ├── inventoryController.js   (NOVO)
│   ├── purchaseOrderController.js (NOVO)
│   ├── deviceController.js      (NOVO)
│   └── [existing...]
├── middlewares/
│   ├── tokenVerification.js     (MODIFICAR)
│   ├── storeIsolation.js        (NOVO)
│   └── deviceApproval.js        (NOVO)
├── services/
│   ├── inventoryService.js      (NOVO)
│   ├── recipeService.js         (NOVO)
│   └── calculationService.js    (NOVO)
├── utils/
│   ├── deviceFingerprint.js     (NOVO)
│   └── unitConversion.js        (NOVO)
└── app.js                       (MODIFICAR - Socket.io)
```

---

### 2.2 Middlewares

#### **storeIsolation.js** (NOVO)
```javascript
const createHttpError = require("http-errors");

const storeIsolation = async (req, res, next) => {
  try {
    const user = req.user;
    
    // Master admin pode acessar todas as lojas
    if (user.isMasterAdmin) {
      const { storeId } = req.query;
      req.storeId = storeId || null;
      return next();
    }
    
    // Usuário comum: usa store do próprio usuário
    req.storeId = user.store.toString();
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { storeIsolation };
```

#### **deviceApproval.js** (NOVO)
```javascript
const createHttpError = require("http-errors");
const Device = require("../models/deviceModel");
const { generateDeviceFingerprint } = require("../utils/deviceFingerprint");

const deviceApproval = async (req, res, next) => {
  try {
    const deviceId = generateDeviceFingerprint(req);
    
    const device = await Device.findOne({ 
      deviceId,
      user: req.user._id 
    });
    
    if (!device) {
      // Novo dispositivo - requer aprovação
      const error = createHttpError(403, "Dispositivo não autorizado. Contate o admin.");
      return next(error);
    }
    
    if (!device.isApproved) {
      const error = createHttpError(403, "Dispositivo pendente de aprovação.");
      return next(error);
    }
    
    // Atualiza lastActiveAt
    device.lastActiveAt = new Date();
    device.isCurrent = true;
    await device.save();
    
    req.device = device;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { deviceApproval };
```

#### **tokenVerification.js** (MODIFICAR)
```javascript
// Adicionar após verificar usuário:
const isVerifiedUser = async (req, res, next) => {
  try {
    // ... existing code ...
    
    const user = await User.findById(decodeToken._id).populate('store');
    if (!user) {
      const error = createHttpError(401, "User not exist!");
      return next(error);
    }
    
    // Verificar aprovação do dispositivo (exceto para login/register)
    if (!req.path.includes('/login') && !req.path.includes('/register')) {
      // Device approval check será feito em middleware separado
    }
    
    req.user = user;
    next();
  } catch (error) {
    const err = createHttpError(401, "Invalid Token!");
    next(err);
  }
};
```

---

### 2.3 Controllers Principais

#### **productController.js** (NOVO)
```javascript
const Product = require("../models/productModel");
const createHttpError = require("http-errors");
const Inventory = require("../models/inventoryModel");
const Recipe = require("../models/recipeModel");

const getProducts = async (req, res, next) => {
  try {
    const { category, isActive, isAvailable } = req.query;
    const filter = { storeId: req.storeId };
    
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (isAvailable !== undefined) filter.isAvailable = isAvailable === 'true';
    
    const products = await Product.find(filter)
      .populate('category', 'name icon color')
      .sort('name');
    
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const productData = { ...req.body, storeId: req.storeId };
    const product = await Product.create(productData);
    
    // Criar registro de estoque vazio para cada ingrediente da receita
    if (req.body.recipe) {
      await Recipe.create({
        product: product._id,
        storeId: req.storeId,
        ingredients: req.body.recipe.ingredients
      });
    }
    
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

const updateProductAvailability = async (req, res, next) => {
  try {
    const { isAvailable } = req.body;
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, storeId: req.storeId },
      { isAvailable },
      { new: true }
    );
    
    if (!product) {
      const error = createHttpError(404, "Product not found!");
      return next(error);
    }
    
    // Emitir evento Socket.io para atualizar frontend em tempo real
    req.app.get('io').to(`store:${req.storeId}`).emit('product:availability', {
      productId: product._id,
      isAvailable
    });
    
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProducts, createProduct, updateProduct, updateProductAvailability };
```

#### **inventoryController.js** (NOVO)
```javascript
const Inventory = require("../models/inventoryModel");
const StockMovement = require("../models/stockMovementModel");
const GlobalIngredient = require("../models/globalIngredientModel");
const createHttpError = require("http-errors");

const getInventory = async (req, res, next) => {
  try {
    const { status, ingredient } = req.query;
    const filter = { storeId: req.storeId };
    
    if (status) filter.status = status;
    if (ingredient) filter.ingredient = ingredient;
    
    const inventory = await Inventory.find(filter)
      .populate('ingredient', 'name category baseUnit')
      .sort('ingredient.name');
    
    res.status(200).json({ success: true, data: inventory });
  } catch (error) {
    next(error);
  }
};

const updateInventory = async (req, res, next) => {
  try {
    const { quantity, type, reason, reference } = req.body;
    
    const inventory = await Inventory.findOne({
      storeId: req.storeId,
      ingredient: req.params.ingredientId
    });
    
    if (!inventory) {
      const error = createHttpError(404, "Inventory item not found!");
      return next(error);
    }
    
    const oldQuantity = inventory.quantity;
    inventory.quantity = quantity;
    
    // Atualizar status baseado na quantidade
    if (quantity === 0) {
      inventory.status = 'esgotado';
    } else if (quantity <= inventory.minThreshold) {
      inventory.status = 'baixo';
    } else {
      inventory.status = 'em_estoque';
    }
    
    await inventory.save();
    
    // Registrar movimento
    await StockMovement.create({
      storeId: req.storeId,
      ingredient: req.params.ingredientId,
      type,
      quantity: Math.abs(quantity - oldQuantity),
      unit: inventory.unit,
      reason,
      reference,
      performedBy: req.user._id
    });
    
    // Emitir evento Socket.io
    const io = req.app.get('io');
    io.to(`store:${req.storeId}`).emit('inventory:updated', {
      ingredientId: inventory.ingredient,
      quantity,
      status: inventory.status
    });
    
    // Verificar produtos afetados
    await checkAffectedProducts(req.storeId, inventory.ingredient, io);
    
    res.status(200).json({ success: true, data: inventory });
  } catch (error) {
    next(error);
  }
};

const checkAffectedProducts = async (storeId, ingredientId, io) => {
  const Recipe = require("../models/recipeModel");
  const Product = require("../models/productModel");
  
  const recipes = await Recipe.find({ 
    storeId,
    'ingredients.ingredient': ingredientId 
  }).populate('product');
  
  for (const recipe of recipes) {
    const canProduce = await checkRecipeAvailability(storeId, recipe);
    if (recipe.product.isAvailable !== canProduce) {
      recipe.product.isAvailable = canProduce;
      await recipe.product.save();
      
      io.to(`store:${storeId}`).emit('product:availability', {
        productId: recipe.product._id,
        isAvailable: canProduce
      });
    }
  }
};

const checkRecipeAvailability = async (storeId, recipe) => {
  const Inventory = require("../models/inventoryModel");
  
  for (const item of recipe.ingredients) {
    const inv = await Inventory.findOne({
      storeId,
      ingredient: item.ingredient
    });
    
    if (!inv || inv.quantity < item.quantityInBaseUnit) {
      return false;
    }
  }
  
  return true;
};

const generatePurchaseSuggestions = async (req, res, next) => {
  try {
    const inventory = await Inventory.find({
      storeId: req.storeId,
      status: { $in: ['baixo', 'esgotado'] }
    }).populate('ingredient');
    
    const suggestions = inventory.map(item => ({
      ingredient: item.ingredient,
      name: item.ingredient.name,
      currentQuantity: item.quantity,
      minThreshold: item.minThreshold,
      suggestedQuantity: (item.maxCapacity || item.minThreshold * 3) - item.quantity,
      unit: item.unit,
      estimatedCost: item.ingredient.averageCost * (item.maxCapacity || item.minThreshold * 3)
    }));
    
    res.status(200).json({ success: true, data: suggestions });
  } catch (error) {
    next(error);
  }
};

module.exports = { 
  getInventory, 
  updateInventory, 
  generatePurchaseSuggestions,
  checkAffectedProducts 
};
```

#### **orderController.js** (MODIFICAR)
```javascript
// Adicionar no início dos imports
const Inventory = require("../models/inventoryModel");
const Recipe = require("../models/recipeModel");
const CalculationService = require("../services/calculationService");

const addOrder = async (req, res, next) => {
  try {
    const { customerDetails, items, table, paymentMethod, paymentData } = req.body;
    
    // VALIDAÇÃO: Buscar preços reais do backend
    const validatedItems = [];
    let subtotal = 0;
    
    for (const item of items) {
      const product = await Product.findOne({
        _id: item.productId,
        storeId: req.storeId,
        isActive: true,
        isAvailable: true
      });
      
      if (!product) {
        const error = createHttpError(400, `Produto "${item.name}" não está disponível!`);
        return next(error);
      }
      
      // Usar preço do backend, não do frontend
      const pricePerQuantity = product.price;
      const itemTotal = pricePerQuantity * item.quantity;
      subtotal += itemTotal;
      
      validatedItems.push({
        product: product._id,
        name: product.name,
        pricePerQuantity,
        quantity: item.quantity,
        price: itemTotal,
        notes: item.notes
      });
    }
    
    // CÁLCULO BACKEND: Totais e impostos
    const store = await Store.findById(req.storeId);
    const taxRate = store.settings?.taxRate || 5.25;
    const calculations = CalculationService.calculateOrderTotals(subtotal, taxRate);
    
    // Criar pedido
    const order = await Order.create({
      storeId: req.storeId,
      createdBy: req.user._id,
      device: req.device?._id,
      customerDetails,
      orderStatus: "Em Preparo",
      orderDate: new Date(),
      bills: {
        subtotal: calculations.subtotal,
        tax: calculations.tax,
        totalWithTax: calculations.total
      },
      items: validatedItems,
      table,
      paymentMethod,
      paymentData,
      sessionMetadata: {
        tableTime: 0,
        edits: []
      }
    });
    
    // BAIXA DE ESTOQUE automática via Recipe
    await processInventoryDeduction(req.storeId, validatedItems, req.user._id);
    
    // Atualizar mesa
    await Table.findByIdAndUpdate(table, {
      status: "Ocupada",
      currentOrder: order._id
    });
    
    // Emitir evento Socket.io
    req.app.get('io').to(`store:${req.storeId}`).emit('order:created', {
      orderId: order._id,
      tableNo: table
    });
    
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

const processInventoryDeduction = async (storeId, items, userId) => {
  const Recipe = require("../models/recipeModel");
  const Inventory = require("../models/inventoryModel");
  const StockMovement = require("../models/stockMovementModel");
  
  for (const item of items) {
    const recipe = await Recipe.findOne({ product: item.product, storeId });
    if (!recipe) continue;
    
    for (const ingredient of recipe.ingredients) {
      const quantityToDeduct = ingredient.quantityInBaseUnit * item.quantity;
      
      const inventory = await Inventory.findOne({
        storeId,
        ingredient: ingredient.ingredient
      });
      
      if (inventory) {
        inventory.quantity -= quantityToDeduct;
        
        if (inventory.quantity === 0) {
          inventory.status = 'esgotado';
        } else if (inventory.quantity <= inventory.minThreshold) {
          inventory.status = 'baixo';
        }
        
        await inventory.save();
        
        // Registrar movimento
        await StockMovement.create({
          storeId,
          ingredient: ingredient.ingredient,
          type: 'saida',
          quantity: quantityToDeduct,
          unit: inventory.unit,
          reason: `Venda - Pedido ${item.name} x${item.quantity}`,
          reference: { type: 'order', itemId: item.product },
          performedBy: userId
        });
      }
    }
  }
};

module.exports = { addOrder, getOrderById, getOrders, updateOrder };
```

---

### 2.4 Services

#### **services/calculationService.js** (NOVO)
```javascript
const calculateOrderTotals = (subtotal, taxRate = 5.25) => {
  const tax = (subtotal * taxRate) / 100;
  const total = subtotal + tax;
  
  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
    taxRate
  };
};

const calculateRecipeCost = (ingredients) => {
  let totalCost = 0;
  
  for (const ingredient of ingredients) {
    // ingredient.averageCost já está na unidade base
    totalCost += ingredient.averageCost * ingredient.quantityInBaseUnit;
  }
  
  return totalCost;
};

const calculateProductMargin = (price, cost) => {
  const margin = ((price - cost) / price) * 100;
  return {
    cost: parseFloat(cost.toFixed(2)),
    margin: parseFloat(margin.toFixed(2)),
    profit: parseFloat((price - cost).toFixed(2))
  };
};

module.exports = {
  calculateOrderTotals,
  calculateRecipeCost,
  calculateProductMargin
};
```

#### **services/inventoryService.js** (NOVO)
```javascript
const convertToBaseUnit = (quantity, fromUnit, conversionMap) => {
  if (fromUnit in conversionMap) {
    return quantity * conversionMap[fromUnit];
  }
  return quantity; // Já está na unidade base
};

const checkIngredientAvailability = (inventory, requiredQuantity) => {
  return inventory.quantity >= requiredQuantity;
};

const suggestRestock = (inventory) => {
  const suggestedQuantity = (inventory.maxCapacity || inventory.minThreshold * 3) - inventory.quantity;
  return {
    ingredient: inventory.ingredient,
    currentQuantity: inventory.quantity,
    suggestedQuantity: Math.max(0, suggestedQuantity),
    urgency: inventory.status === 'esgotado' ? 'alta' : 
             inventory.status === 'baixo' ? 'media' : 'baixa'
  };
};

module.exports = {
  convertToBaseUnit,
  checkIngredientAvailability,
  suggestRestock
};
```

---

### 2.5 Socket.io Setup

#### **app.js** (MODIFICAR)
```javascript
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/database");
const config = require("./config/config");
const globalErrorHandler = require("./middlewares/globalErrorHandler");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
    credentials: true
  }
});

// Store io instance para acesso nos controllers
app.set('io', io);

// Socket.io middleware e eventos
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  // Entrar em room da loja
  socket.on('join:store', (storeId) => {
    socket.join(`store:${storeId}`);
    console.log(`Socket ${socket.id} joined store:${storeId}`);
  });
  
  // Eventos de tempo real
  socket.on('order:status', (data) => {
    socket.to(`store:${data.storeId}`).emit('order:status', data);
  });
  
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// ... existing middlewares ...
app.use(cors({ credentials: true, origin: ['http://localhost:5173'] }));
app.use(express.json());
app.use(cookieParser());

// ... existing routes ...

// Server
server.listen(config.port, () => {
  console.log(`☑️  POS Server is listening on port ${config.port}`);
});
```

---

### 2.6 Utils

#### **utils/deviceFingerprint.js** (NOVO)
```javascript
const crypto = require('crypto');

const generateDeviceFingerprint = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.connection.remoteAddress || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  const acceptEncoding = req.headers['accept-encoding'] || '';
  
  const fingerprintString = `${userAgent}|${ip}|${acceptLanguage}|${acceptEncoding}`;
  
  return crypto
    .createHash('sha256')
    .update(fingerprintString)
    .digest('hex');
};

const parseDeviceInfo = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  
  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'desktop';
  
  // Detect browser
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';
  
  // Detect OS
  if (userAgent.includes('Win')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iOS')) os = 'iOS';
  
  // Detect device
  if (/mobile|android|phone|tablet/i.test(userAgent)) {
    device = userAgent.includes('Android') || userAgent.includes('iPhone') ? 'mobile' : 'tablet';
  }
  
  return { userAgent, browser, os, device, ip: req.ip };
};

module.exports = { generateDeviceFingerprint, parseDeviceInfo };
```

#### **utils/unitConversion.js** (NOVO)
```javascript
// Fatores de conversão para unidade base
const VOLUME_CONVERSIONS = {
  'ml': 1,
  'L': 1000,
  'xícara': 240,
  'colher_sopa': 15,
  'colher_chá': 5,
  'pitada': 0.5
};

const WEIGHT_CONVERSIONS = {
  'g': 1,
  'kg': 1000,
  'mg': 0.001,
  'unidade': 100 //假设1 unidade = 100g
};

const convertToBase = (quantity, fromUnit, baseUnit) => {
  if (['g', 'kg', 'mg', 'unidade'].includes(baseUnit)) {
    const factor = WEIGHT_CONVERSIONS[fromUnit] || 1;
    return quantity * factor;
  }
  
  if (['ml', 'L', 'xícara', 'colher_sopa', 'colher_chá'].includes(baseUnit)) {
    const factor = VOLUME_CONVERSIONS[fromUnit] || 1;
    return quantity * factor;
  }
  
  return quantity;
};

module.exports = { convertToBase, VOLUME_CONVERSIONS, WEIGHT_CONVERSIONS };
```

---

## 3. Frontend Implementation

### 3.1 Redux Store Updates

#### **Adicionar storeSlice.js** (NOVO)
```javascript
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  _id: "",
  name: "",
  cnpj: "",
  settings: {
    taxRate: 5.25,
    currency: "BRL"
  }
};

const storeSlice = createSlice({
  name: "store",
  initialState,
  reducers: {
    setStore: (state, action) => {
      const { _id, name, cnpj, settings } = action.payload;
      state._id = _id;
      state.name = name;
      state.cnpj = cnpj;
      state.settings = settings || state.settings;
    },
    removeStore: (state) => {
      state._id = "";
      state.name = "";
      state.cnpj = "";
      state.settings = { taxRate: 5.25, currency: "BRL" };
    }
  }
});

export const { setStore, removeStore } = storeSlice.actions;
export default storeSlice.reducer;
```

#### **Atualizar store.js**
```javascript
import { configureStore } from "@reduxjs/toolkit";
import customerSlice from "./slices/customerSlice";
import cartSlice from "./slices/cartSlice";
import userSlice from "./slices/userSlice";
import storeSlice from "./slices/storeSlice"; // NOVO

const store = configureStore({
  reducer: {
    customer: customerSlice,
    cart: cartSlice,
    user: userSlice,
    store: storeSlice // NOVO
  },
  devTools: import.meta.env.NODE_ENV !== "production",
});

export default store;
```

### 3.2 API Calls

#### **Adicionar em https/index.js**
```javascript
// Store Endpoints
export const getStore = () => axiosWrapper.get("/api/store");
export const updateStore = (data) => axiosWrapper.put("/api/store", data);

// Product Endpoints
export const getProducts = (params) => 
  axiosWrapper.get("/api/product", { params });
export const createProduct = (data) => 
  axiosWrapper.post("/api/product", data);
export const updateProduct = (id, data) => 
  axiosWrapper.put(`/api/product/${id}`, data);

// Category Endpoints
export const getCategories = () => axiosWrapper.get("/api/category");
export const createCategory = (data) => axiosWrapper.post("/api/category", data);

// Inventory Endpoints
export const getInventory = (params) => 
  axiosWrapper.get("/api/inventory", { params });
export const updateInventory = (ingredientId, data) => 
  axiosWrapper.put(`/api/inventory/${ingredientId}`, data);
export const getPurchaseSuggestions = () => 
  axiosWrapper.get("/api/inventory/suggestions");

// Device Endpoints
export const getDevices = () => axiosWrapper.get("/api/device");
export const approveDevice = (deviceId) => 
  axiosWrapper.post(`/api/device/${deviceId}/approve`);
export const revokeDevice = (deviceId) => 
  axiosWrapper.delete(`/api/device/${deviceId}`);
```

### 3.3 Componentes a Criar/Modificar

#### **Menu.jsx** (MODIFICAR - Filtro Automático)
```javascript
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { getProducts, getCategories } from "../../https";
import MenuContainer from "../components/menu/MenuContainer";
// ... other imports

const Menu = () => {
  const { store } = useSelector((state) => state);
  const { customerData } = useSelector((state) => state.customer);
  
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories', store._id],
    queryFn: () => getCategories(),
    enabled: !!store._id
  });
  
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', store._id],
    queryFn: () => getProducts({ isActive: true, isAvailable: true }),
    enabled: !!store._id
  });
  
  // Socket.io listener para atualizações em tempo real
  useEffect(() => {
    const socket = io(import.meta.env.VITE_BACKEND_URL);
    
    socket.on('connect', () => {
      socket.emit('join:store', store._id);
    });
    
    socket.on('product:availability', (data) => {
      // Atualizar produto na lista
      queryClient.setQueryData(['products', store._id], (old) => {
        return old?.data?.map(p => 
          p._id === data.productId 
            ? { ...p, isAvailable: data.isAvailable }
            : p
        );
      });
    });
    
    return () => socket.disconnect();
  }, [store._id]);
  
  if (categoriesLoading || productsLoading) return <FullScreenLoader />;
  
  return (
    <section className="bg-[#1f1f1f] h-[calc(100vh-5rem)] overflow-hidden flex gap-3">
      {/* ... existing layout ... */}
      <MenuContainer 
        categories={categoriesData?.data || []}
        products={productsData?.data || []}
      />
      {/* ... rest of component ... */}
    </section>
  );
};
```

#### **MenuContainer.jsx** (MODIFICAR)
```javascript
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { addItems } from "../../redux/slices/cartSlice";

const MenuContainer = ({ categories, products }) => {
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?._id);
  const [itemCount, setItemCount] = useState(0);
  const [itemId, setItemId] = useState();
  const dispatch = useDispatch();
  const { store } = useSelector((state) => state);
  
  // Filtrar produtos da categoria selecionada
  const categoryProducts = products.filter(
    p => p.category._id === selectedCategory
  );
  
  const handleAddToCart = (product) => {
    if (itemCount === 0 || !product.isAvailable) return;
    
    const { name, price } = product;
    const newObj = { 
      id: new Date(), 
      productId: product._id, // ID real do produto
      name, 
      pricePerQuantity: price, 
      quantity: itemCount, 
      price: price * itemCount 
    };
    
    dispatch(addItems(newObj));
    setItemCount(0);
  };
  
  return (
    <>
      {/* Categorias Grid */}
      <div className="grid grid-cols-4 gap-4 px-10 py-4 w-[100%]">
        {categories.map((category) => (
          <div
            key={category._id}
            className="flex flex-col items-start justify-between p-4 rounded-lg h-[100px] cursor-pointer"
            style={{ backgroundColor: category.color }}
            onClick={() => {
              setSelectedCategory(category._id);
              setItemId(0);
              setItemCount(0);
            }}
          >
            <div className="flex items-center justify-between w-full">
              <h1 className="text-[#f5f5f5] text-lg font-semibold">
                {category.icon} {category.name}
              </h1>
              {selectedCategory === category._id && (
                <GrRadialSelected className="text-white" size={20} />
              )}
            </div>
            <p className="text-[#ababab] text-sm font-semibold">
              {categoryProducts.length} Itens
            </p>
          </div>
        ))}
      </div>
      
      {/* Produtos Grid */}
      <div className="grid grid-cols-4 gap-4 px-10 py-4 w-[100%]">
        {categoryProducts.map((product) => (
          <div
            key={product._id}
            className={`flex flex-col items-start justify-between p-4 rounded-lg h-[150px] cursor-pointer 
              ${product.isAvailable ? 'hover:bg-[#2a2a2a] bg-[#1a1a1a]' : 'bg-[#2a2a2a] opacity-50'}`}
          >
            <div className="flex items-start justify-between w-full">
              <h1 className="text-[#f5f5f5] text-lg font-semibold">
                {product.name}
              </h1>
              <button 
                onClick={() => handleAddToCart(product)} 
                disabled={!product.isAvailable}
                className={`p-2 rounded-lg ${
                  product.isAvailable 
                    ? 'bg-[#2e4a40] text-[#02ca3a]' 
                    : 'bg-[#4a4a4a] text-[#888888]'
                }`}
              >
                <FaShoppingCart size={20} />
              </button>
            </div>
            <div className="flex items-center justify-between w-full">
              <p className="text-[#f5f5f5] text-xl font-bold">
                R${product.price.toFixed(2)}
              </p>
              {!product.isAvailable && (
                <span className="text-[#f44336] text-xs font-semibold">
                  Esgotado
                </span>
              )}
              {/* ... quantity selector ... */}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
```

### 3.4 Socket.io Hook

#### **hooks/useSocket.js** (NOVO)
```javascript
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useSelector } from 'react-redux';

const useSocket = (onOrderCreated, onInventoryUpdated, onProductAvailability) => {
  const { store } = useSelector((state) => state);
  const socketRef = useRef(null);
  
  useEffect(() => {
    if (!store._id) return;
    
    socketRef.current = io(import.meta.env.VITE_BACKEND_URL, {
      withCredentials: true
    });
    
    socketRef.current.on('connect', () => {
      socketRef.current.emit('join:store', store._id);
    });
    
    if (onOrderCreated) {
      socketRef.current.on('order:created', onOrderCreated);
    }
    
    if (onInventoryUpdated) {
      socketRef.current.on('inventory:updated', onInventoryUpdated);
    }
    
    if (onProductAvailability) {
      socketRef.current.on('product:availability', onProductAvailability);
    }
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [store._id]);
  
  return socketRef.current;
};

export default useSocket;
```

---

## 4. Migração e Setup

### 4.1 Script de Limpeza 🧹

#### **scripts/migration-cleanup.js**
```javascript
const mongoose = require('mongoose');

const cleanupDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
    
    // Drop todas as coleções existentes
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.drop();
      console.log(`🗑️  Dropped: ${collection.collectionName}`);
    }
    
    console.log('✅ Database cleaned successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
};

cleanupDatabase();
```

### 4.2 Script de Seed

#### **scripts/seed.js**
```javascript
// Criar loja padrão, admin, ingredientes globais, categorias, produtos de exemplo
```

### 4.3 .env.example Atualizado
```
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/pos-saas

# JWT
JWT_SECRET=your-super-secret-jwt-key

# Razorpay
RAZORPAY_KEY_ID=your-key-id
RAZORPAY_KEY_SECRET=your-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

# Socket.io
SOCKET_CORS_ORIGIN=http://localhost:5173

# Frontend
VITE_BACKEND_URL=http://localhost:3000
VITE_RAZORPAY_KEY_ID=your-key-id
```

---

## 5. Verificação e Testes

### 5.1 Testes de Integração

1. **Multi-tenancy**: Criar 2 lojas, verificar isolamento de dados
2. **Estoque**: Criar produto, receita, vender e verificar baixa automática
3. **Socket.io**: Abrir 2 abas, atualizar estoque em uma, verificar atualização na outra
4. **Device Approval**: Login em novo dispositivo, verificar bloqueio, aprovar no admin, tentar novamente

### 5.2 Critérios de Aceite

- [ ] Todas as queries filtram por `storeId`
- [ ] Cálculos de totais feitos no backend
- [ ] Produtos hardcoded removidos do frontend
- [ ] Socket.io atualiza frontend em tempo real
- [ ] Device approval bloqueia dispositivos não aprovados
- [ ] Sugestão de compra gera quando estoque < threshold

---

## 6. Cronograma Sugerido

| Fase | Tarefa | Duração |
|------|--------|---------|
| 1 | Models + Middlewares | 2 dias |
| 2 | Controllers (Product, Category, Inventory) | 2 dias |
| 3 | Socket.io + Services | 1 dia |
| 4 | Frontend Redux + API calls | 2 dias |
| 5 | Frontend Components + Socket listeners | 2 dias |
| 6 | Migração + Seed + Testes | 1 dia |

**Total estimado: 10 dias**

---

*Plano criado em: 2026-05-20*
