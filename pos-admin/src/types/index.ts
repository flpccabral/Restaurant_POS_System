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
  category: string;
  price: number;
  isActive: boolean;
  variations?: ProductVariation[];
  store: string;
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
