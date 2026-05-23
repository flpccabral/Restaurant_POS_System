import { api } from "@/lib/api";
import type { ApiResponse } from "./types";

export interface RecipeIngredient {
  ingredient: string;
  netQuantity: number;
  unit: string;
  lossFactor?: number;
  substituteId?: string | null;
}

export interface Recipe {
  _id: string;
  store: string;
  sku: string;
  product: string | { _id: string; name: string };
  variation: string;
  name: string;
  ingredients: Array<{
    ingredient: { _id: string; name: string; category?: string; averageCost?: number };
    netQuantity: number;
    unit: string;
    lossFactor: number;
    substitute?: { _id: string; name: string } | null;
  }>;
  preparationTime?: number;
  instructions?: string;
  yieldQuantity?: number;
  totalCost?: number;
  isActive: boolean;
  version?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeCost {
  totalCost: number;
  ingredientCosts: Array<{
    ingredient: string;
    ingredientName: string;
    quantity: number;
    unit: string;
    cost: number;
  }>;
  calculatedAt: string;
}

export interface RecipeStockCheck {
  allIngredientsAvailable: boolean;
  wouldDeduct: Array<{
    ingredientId: string;
    ingredientName: string;
    available: number;
    required: number;
    hasEnough: boolean;
  }>;
  wouldFail: Array<{
    ingredientId: string;
    ingredientName: string;
    required: number;
    available: number;
    shortfall: number;
  }>;
}

export interface RecipeValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Recipe API service.
 * Backend mounts recipe routes at `/api/recipe`.
 */
export const recipesService = {
  /** List recipes, optionally filtered by productId, isActive, store */
  getAll: (params?: { productId?: string; isActive?: string; store?: string }) =>
    api.get<ApiResponse<Recipe[]>>("/recipe", { params }),

  /** Get recipe by ID */
  getById: (id: string) => api.get<ApiResponse<Recipe>>(`/recipe/${id}`),

  /** Get recipe by SKU */
  getBySku: (sku: string) => api.get<ApiResponse<Recipe>>(`/recipe/sku/${sku}`),

  /** Create new recipe */
  create: (data: Partial<Recipe> & { ingredients: RecipeIngredient[] }) =>
    api.post<ApiResponse<Recipe>>("/recipe", data),

  /** Update recipe */
  update: (id: string, data: Partial<Recipe> & { ingredients?: RecipeIngredient[] }) =>
    api.put<ApiResponse<Recipe>>(`/recipe/${id}`, data),

  /** Toggle recipe active/inactive status */
  toggleStatus: (id: string, isActive: boolean) =>
    api.put<ApiResponse<Recipe>>(`/recipe/${id}/toggle-status`, { isActive }),

  /** Delete recipe */
  delete: (id: string) => api.delete<ApiResponse<void>>(`/recipe/${id}`),

  /** Calculate recipe cost */
  getCost: (id: string) => api.get<ApiResponse<RecipeCost>>(`/recipe/${id}/cost`),

  /** Check stock availability for recipe */
  checkStock: (id: string, quantity?: number) =>
    api.get<ApiResponse<RecipeStockCheck>>(`/recipe/${id}/stock/check`, {
      params: { quantity: quantity || 1 },
    }),

  /** Validate recipe data without saving */
  validate: (data: Record<string, unknown>) =>
    api.post<ApiResponse<RecipeValidation>>("/recipe/validate", data),

  /** Get product that has no active recipe */
  getProductsWithoutRecipe: () =>
    api.get<ApiResponse<Array<{ productId: string; productName: string; sku?: string; missingRecipe?: boolean }>>>("/recipe/without-recipe"),

  /** Get sellable products (those with active recipe) */
  getSellableRecipes: () =>
    api.get<ApiResponse<Array<{ productId: string; productName: string; recipeId: string; recipeName: string; sku: string; totalCost: number }>>>("/recipe/sellable"),

  /** Get recipe by product ID */
  getByProduct: (productId: string) =>
    api.get<ApiResponse<Recipe>>(`/recipe/product/${productId}/sellable?variation=`),
};
