export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string | Role;
  stores: string[];
  isMasterAdmin?: boolean;
  isActive?: boolean;
}

export interface Role {
  _id: string;
  name: string;
  description: string;
  permissions: Record<string, string[]>;
  isSystem?: boolean;
  isActive?: boolean;
}

export interface Store {
  _id: string;
  name: string;
  cnpj?: string;
  email: string;
  phone: string;
  address?: { street?: string; number?: string; neighborhood?: string; city?: string; state?: string; zipCode?: string };
  isActive: boolean;
  settings?: { taxRate?: number; currency?: string; timezone?: string };
  subscription?: Subscription;
}

export interface Subscription {
  plan: string;
  status: string;
  expiresAt: string;
}

export interface Product {
  _id: string;
  name: string;
  description: string;
  category: string | { _id: string; name: string };
  price: number;
  isActive: boolean;
  isCurrent?: boolean;
  variations?: ProductVariation[];
  store: string;
  hasActiveRecipe?: boolean;
  // Fase 9.1A — Regra de Impacto em Estoque
  sellableType?: 'prepared_product' | 'industrialized_resale' | 'combo' | 'service_fee';
  stockImpactRule?: 'recipe_composition' | 'stock_item_direct' | 'no_stock_impact' | 'combo_components';
  directStockItem?: string | { _id: string; name: string };
  directStockQuantity?: number;
  directStockUnit?: string;
  productReadinessStatus?: string;
  productReadinessLabel?: string;
  productReadinessReason?: string;
}

export interface ProductVariation {
  _id: string;
  name: string;
  sku: string;
  price: number;
}

export interface Category {
  _id: string;
  name: string;
  description: string;
  isActive: boolean;
  store: string;
}

export interface Ingredient {
  _id: string;
  name: string;
  unit: string;
  baseUnit: string;
  category: string;
  averageCost: number;
  minimumStock: number;
  isActive: boolean;
  // Fase 9.1A
  isSellableDirectly?: boolean;
  itemType?: string;
}

export interface InventoryItem {
  _id: string;
  ingredient: Ingredient;
  store: string;
  currentQuantity: number;
  minimumQuantity: number;
  unit: string;
}

export interface Supplier {
  _id: string;
  name: string;
  tradeName?: string;
  document?: string;
  contact: { name?: string; email?: string; phone?: string; cellPhone?: string };
  address: { street?: string; number?: string; complement?: string; neighborhood?: string; city?: string; state?: string; zipCode?: string; country?: string };
  isActive: boolean;
  rating?: number;
  notes?: string;
}

export interface PurchaseOrder {
  _id: string;
  orderNumber?: string;
  supplier: { name?: string } | string;
  store: string;
  items: PurchaseOrderItem[];
  status: string;
  total: number;
  expectedDate?: string;
  createdAt: string;
}

export interface PurchaseOrderItem {
  ingredient: string;
  quantity: number;
  unitPrice: number;
}

export interface Device {
  _id: string;
  store: { name?: string } | string;
  name?: string;
  nickname?: string;
  type: string;
  isApproved: boolean;
  deviceInfo?: { userAgent?: string; browser?: string; os?: string; ip?: string; device?: string; screenResolution?: string; timezone?: string };
  lastActiveAt?: string;
  lastSeen: string;
}

export interface Order {
  _id: string;
  store: string;
  table?: string;
  items: OrderItem[];
  status: string;
  total: number;
  createdAt: string;
}

export interface OrderItem {
  product: string;
  name: string;
  quantity: number;
  price: number;
  status: string;
}

export interface CashSession {
  _id: string;
  store: string;
  openedBy: string;
  openedAt: string;
  closedAt?: string;
  openingBalance: number;
  closingBalance?: number;
  status: string;
}

export interface KdsTicket {
  _id: string;
  orderId: string;
  items: KdsItem[];
  status: string;
  createdAt: string;
}

export interface KdsItem {
  name: string;
  quantity: number;
  status: string;
}

export type Permission =
  | "orders:read"
  | "orders:create"
  | "orders:update"
  | "orders:delete"
  | "products:read"
  | "products:create"
  | "products:update"
  | "products:delete"
  | "inventory:read"
  | "inventory:create"
  | "inventory:update"
  | "inventory:delete"
  | "inventory:adjust"
  | "inventory:transfer"
  | "users:read"
  | "users:create"
  | "users:update"
  | "users:delete"
  | "stores:read"
  | "stores:create"
  | "stores:update"
  | "stores:delete"
  | "roles:read"
  | "roles:create"
  | "roles:update"
  | "roles:delete"
  | "devices:read"
  | "devices:approve"
  | "devices:delete";

// ── Console / Observability Types ──────────────────────────────────────────

export interface StockHealthSummary {
  stockout: number;
  critical: number;
  low: number;
  ok: number;
  excess: number;
  noPolicy: number;
}

export interface IngredientHealth {
  ingredient: {
    id: string;
    name: string;
    category?: string;
  };
  balance: number;
  unit: string;
  status: "stockout" | "critical" | "low" | "ok" | "excess" | "no_policy";
  policy?: {
    minQuantity: number;
    reorderPoint: number;
    maxQuantity: number;
    idealQuantity: number;
  };
  consumption?: {
    last24h?: { netConsumption: number };
    last7d?: { netConsumption: number };
    avgDailyConsumption?: number;
  };
  daysUntilStockout?: number;
  storeId?: string;
  locationId?: string;
  locationName?: string;
}

export interface StockHealthData {
  storeId: string;
  ingredientCount: number;
  statusSummary: StockHealthSummary;
  ingredients: IngredientHealth[];
  generatedAt?: string;
}

export interface OperationalAlert {
  _id: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  status: "new" | "acknowledged" | "resolved" | "dismissed";
  message: string;
  ingredient?: { id: string; name: string };
  storeId?: string;
  locationId?: string;
  currentValue?: number;
  thresholdValue?: number;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface Recommendation {
  type: "central_to_store" | "inter_store_transfer" | "purchase_needed" | "no_action";
  priority: "critical" | "high" | "medium" | "low";
  ingredient?: { id: string; name: string };
  storeId?: string;
  storeName?: string;
  suggestedQuantity: number;
  unit: string;
  currentBalance: number;
  justification: string;
  actionSuggested?: string;
  source?: {
    storeId?: string;
    storeName?: string;
    locationId?: string;
    locationName?: string;
    availableQuantity?: number;
  };
  destinationLocationId?: string;
  risks?: string[];
}

export interface TimelineEvent {
  type: string;
  eventType: string;
  timestamp: string;
  ingredient?: string;
  quantity?: number;
  unit?: string;
  location?: string;
  severity?: string;
  message?: string;
  reason?: string;
  outputs?: Array<{ ingredient: string; quantity: number; unit: string }>;
  user?: string;
  storeId?: string;
}

export interface StockPolicy {
  _id: string;
  store?: { _id: string; name: string };
  location?: { _id: string; name: string };
  ingredient?: { _id: string; name: string };
  minQuantity: number;
  reorderPoint: number;
  idealQuantity: number;
  maxQuantity: number;
  unit: string;
  priority: "high" | "medium" | "low";
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface OverviewData {
  totalIngredients: number;
  stockout: number;
  critical: number;
  low: number;
  ok: number;
  excess: number;
  noPolicy: number;
  newAlerts: number;
  saleWithoutDeduction: number;
  productsWithoutRecipe: number;
  pendingRecommendations: number;
  alerts: OperationalAlert[];
}
