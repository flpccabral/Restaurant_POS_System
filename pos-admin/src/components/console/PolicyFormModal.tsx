"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCapabilities } from "@/hooks/useCapabilities";
import { ingredientsService } from "@/services/api/ingredients";
import { storesService } from "@/services/api/stores";
import { inventoryService } from "@/services/api/inventory";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { StockPolicy } from "@/types";

interface PolicyFormData {
  storeId: string;
  locationId: string;
  ingredientId: string;
  minQuantity: string;
  reorderPoint: string;
  idealQuantity: string;
  maxQuantity: string;
  unit: string;
  priority: "high" | "medium" | "low";
  isActive: boolean;
}

interface FormErrors {
  storeId?: string;
  locationId?: string;
  ingredientId?: string;
  minQuantity?: string;
  reorderPoint?: string;
  idealQuantity?: string;
  maxQuantity?: string;
  unit?: string;
}

interface PolicyFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    storeId: string;
    locationId: string;
    ingredientId: string;
    minQuantity: number;
    reorderPoint: number;
    idealQuantity: number;
    maxQuantity: number;
    unit: string;
    priority: "high" | "medium" | "low";
    isActive: boolean;
  }) => Promise<void>;
  initialData: StockPolicy | null;
  isLoading?: boolean;
}

const INITIAL_FORM: PolicyFormData = {
  storeId: "",
  locationId: "",
  ingredientId: "",
  minQuantity: "",
  reorderPoint: "",
  idealQuantity: "",
  maxQuantity: "",
  unit: "",
  priority: "medium",
  isActive: true,
};

function validateForm(values: PolicyFormData): FormErrors {
  const errors: FormErrors = {};

  if (!values.storeId) errors.storeId = "Loja e obrigatoria.";
  if (!values.locationId) errors.locationId = "Localizacao e obrigatoria.";
  if (!values.ingredientId) errors.ingredientId = "Ingrediente e obrigatorio.";

  const min = Number(values.minQuantity);
  const reorder = Number(values.reorderPoint);
  const ideal = Number(values.idealQuantity);
  const max = Number(values.maxQuantity);

  if (values.minQuantity === "" || isNaN(min))
    errors.minQuantity = "Quantidade minima e obrigatoria.";
  else if (min < 0) errors.minQuantity = "Nao pode ser negativa.";
  else if (min > 999999) errors.minQuantity = "Valor muito alto.";

  if (values.reorderPoint === "" || isNaN(reorder))
    errors.reorderPoint = "Ponto de ressuprimento e obrigatorio.";
  else if (reorder < 0) errors.reorderPoint = "Nao pode ser negativo.";
  else if (reorder > 999999) errors.reorderPoint = "Valor muito alto.";

  if (values.idealQuantity === "" || isNaN(ideal))
    errors.idealQuantity = "Quantidade ideal e obrigatoria.";
  else if (ideal < 0) errors.idealQuantity = "Nao pode ser negativa.";
  else if (ideal > 999999) errors.idealQuantity = "Valor muito alto.";

  if (values.maxQuantity === "" || isNaN(max))
    errors.maxQuantity = "Quantidade maxima e obrigatoria.";
  else if (max < 0) errors.maxQuantity = "Nao pode ser negativa.";
  else if (max > 999999) errors.maxQuantity = "Valor muito alto.";

  // Hierarchical validation
  if (!isNaN(min) && !isNaN(reorder) && min > reorder) {
    errors.minQuantity = "Minimo deve ser <= Ponto de Ressuprimento.";
  }
  if (!isNaN(reorder) && !isNaN(ideal) && reorder > ideal) {
    errors.reorderPoint = "Ponto de Ressuprimento deve ser <= Quantidade Ideal.";
  }
  if (!isNaN(ideal) && !isNaN(max) && ideal > max) {
    errors.idealQuantity = "Quantidade Ideal deve ser <= Maxima.";
  }

  if (!values.unit) errors.unit = "Unidade e obrigatoria.";

  return errors;
}

export function PolicyFormModal({
  open,
  onOpenChange,
  onSave,
  initialData,
  isLoading = false,
}: PolicyFormModalProps) {
  const { isMasterAdmin, storeId: userStoreId } = useCapabilities();
  const [form, setForm] = useState<PolicyFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const isEdit = !!initialData;

  // Fetch dropdown data
  const { data: storesData } = useQuery({
    queryKey: ["stores"],
    queryFn: () => storesService.getAll().then((r) => r.data.data),
    enabled: open,
    staleTime: 120_000,
  });

  const { data: ingredientsData } = useQuery({
    queryKey: ["ingredients-active"],
    queryFn: () =>
      ingredientsService
        .getAll()
        .then((r) => r.data.data.filter((i) => i.isActive !== false)),
    enabled: open,
    staleTime: 120_000,
  });

  const { data: locationsData } = useQuery({
    queryKey: ["locations", form.storeId],
    queryFn: () =>
      inventoryService
        .getLocations()
        .then((r) => (Array.isArray(r.data.data) ? r.data.data : [])),
    enabled: open && !!form.storeId,
    staleTime: 60_000,
  });

  const stores = storesData ?? [];
  const ingredients = ingredientsData ?? [];
  const locations = locationsData ?? [];

  // Filter locations by selected store
  const filteredLocations = useMemo(() => {
    return form.storeId
      ? locations.filter(
          (loc: { store?: string; _id: string; name: string }) =>
            loc.store?.toString() === form.storeId
        )
      : [];
  }, [locations, form.storeId]);

  // Selected ingredient auto-populates unit
  const selectedIngredient = useMemo(() => {
    return ingredients.find(
      (i: { _id: string }) => i._id === form.ingredientId
    );
  }, [ingredients, form.ingredientId]);

  // Initialize form when modal opens
  useEffect(() => {
    if (!open) return;

    if (initialData) {
      setForm({
        storeId:
          (
            initialData.store as { _id?: string; name?: string } | undefined
          )?._id?.toString() ?? "",
        locationId:
          (
            initialData.location as { _id?: string; name?: string } | undefined
          )?._id?.toString() ?? "",
        ingredientId:
          (
            initialData.ingredient as
              | { _id?: string; name?: string }
              | undefined
          )?._id?.toString() ?? "",
        minQuantity: initialData.minQuantity?.toString() ?? "",
        reorderPoint: initialData.reorderPoint?.toString() ?? "",
        idealQuantity: initialData.idealQuantity?.toString() ?? "",
        maxQuantity: initialData.maxQuantity?.toString() ?? "",
        unit: initialData.unit ?? "",
        priority: initialData.priority ?? "medium",
        isActive: initialData.isActive !== false,
      });
    } else {
      setForm({
        ...INITIAL_FORM,
        storeId: isMasterAdmin ? "" : userStoreId ?? "",
      });
    }
    setErrors({});
  }, [open, initialData, isMasterAdmin, userStoreId]);

  // Auto-populate unit when ingredient changes (on create)
  useEffect(() => {
    if (
      selectedIngredient &&
      !initialData &&
      (selectedIngredient as { baseUnit?: string }).baseUnit
    ) {
      setForm((prev) => ({
        ...prev,
        unit:
          (selectedIngredient as { baseUnit?: string }).baseUnit ?? prev.unit,
      }));
    }
  }, [selectedIngredient, initialData]);

  const handleChange = (field: keyof PolicyFormData, value: string | boolean | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof FormErrors];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateForm(form);
    setErrors(validation);

    if (Object.keys(validation).length > 0) return;

    await onSave({
      storeId: form.storeId,
      locationId: form.locationId,
      ingredientId: form.ingredientId,
      minQuantity: Number(form.minQuantity),
      reorderPoint: Number(form.reorderPoint),
      idealQuantity: Number(form.idealQuantity),
      maxQuantity: Number(form.maxQuantity),
      unit: form.unit,
      priority: form.priority,
      isActive: form.isActive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Politica de Estoque" : "Criar Politica de Estoque"}
          </DialogTitle>
          <DialogDescription>
            Defina as quantidades ideais e limites para este ingrediente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Store */}
          <div className="space-y-2">
            <Label htmlFor="storeId">Loja</Label>
            {isMasterAdmin ? (
              <Select
                value={form.storeId}
                onValueChange={(v) => handleChange("storeId", v ?? "")}
                disabled={isLoading || isEdit}
              >
                <SelectTrigger id="storeId" className={errors.storeId ? "border-destructive" : ""}>
                  {form.storeId ? (
                    <span>{(stores as Array<{ _id: string; name: string }> | undefined)?.find((s) => s._id === form.storeId)?.name || "—"}</span>
                  ) : (
                    <SelectValue placeholder="Selecione uma loja" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {stores.map(
                    (s: { _id: string; name: string }) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.name}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={
                  stores.find(
                    (s: { _id: string }) => s._id === userStoreId
                  )?.name ?? "Minha Loja"
                }
                disabled
              />
            )}
            {errors.storeId && (
              <p className="text-xs text-destructive">{errors.storeId}</p>
            )}
          </div>

          {/* Row: Location + Ingredient */}
          <div className="grid grid-cols-2 gap-4">
            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="locationId">Localizacao</Label>
              <Select
                value={form.locationId}
                onValueChange={(v) => handleChange("locationId", v ?? "")}
                disabled={isLoading || !form.storeId}
              >
                <SelectTrigger
                  id="locationId"
                  className={errors.locationId ? "border-destructive" : ""}
                >
                  {form.locationId ? (
                    <span>{(filteredLocations as Array<{ _id: string; name: string }> | undefined)?.find((l) => l._id === form.locationId)?.name || "—"}</span>
                  ) : (
                    <SelectValue placeholder="Selecione" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {filteredLocations.map(
                    (loc: { _id: string; name: string }) => (
                      <SelectItem key={loc._id} value={loc._id}>
                        {loc.name}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              {errors.locationId && (
                <p className="text-xs text-destructive">{errors.locationId}</p>
              )}
            </div>

            {/* Ingredient */}
            <div className="space-y-2">
              <Label htmlFor="ingredientId">Ingrediente</Label>
              <Select
                value={form.ingredientId}
                onValueChange={(v) => handleChange("ingredientId", v ?? "")}
                disabled={isLoading || isEdit}
              >
                <SelectTrigger
                  id="ingredientId"
                  className={errors.ingredientId ? "border-destructive" : ""}
                >
                  {form.ingredientId ? (
                    <span>{(ingredients as Array<{ _id: string; name: string }> | undefined)?.find((i) => i._id === form.ingredientId)?.name || "—"}</span>
                  ) : (
                    <SelectValue placeholder="Selecione" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map(
                    (ing: { _id: string; name: string; baseUnit: string }) => (
                      <SelectItem key={ing._id} value={ing._id}>
                        {ing.name} ({ing.baseUnit})
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              {errors.ingredientId && (
                <p className="text-xs text-destructive">
                  {errors.ingredientId}
                </p>
              )}
            </div>
          </div>

          {/* Quantities */}
          <div className="space-y-2">
            <Label>Quantidades</Label>
            <div className="grid grid-cols-4 gap-3">
              {[
                { field: "minQuantity" as const, label: "Minimo", placeholder: "0" },
                { field: "reorderPoint" as const, label: "Ressuprimento", placeholder: "0" },
                { field: "idealQuantity" as const, label: "Ideal", placeholder: "0" },
                { field: "maxQuantity" as const, label: "Maximo", placeholder: "0" },
              ].map(({ field, label, placeholder }) => (
                <div key={field}>
                  <Input
                    type="number"
                    placeholder={placeholder}
                    min="0"
                    step="any"
                    value={form[field]}
                    onChange={(e) => handleChange(field, e.target.value)}
                    disabled={isLoading}
                    className={errors[field] ? "border-destructive" : ""}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                  {errors[field] && (
                    <p className="text-xs text-destructive mt-0.5">
                      {errors[field]}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {!errors.minQuantity &&
              !errors.reorderPoint &&
              !errors.idealQuantity &&
              !errors.maxQuantity && (
                <p className="text-xs text-muted-foreground">
                  Minimo ≤ Ressuprimento ≤ Ideal ≤ Maximo
                </p>
              )}
          </div>

          {/* Row: Unit + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit">Unidade</Label>
              <Input
                id="unit"
                value={form.unit}
                onChange={(e) => handleChange("unit", e.target.value)}
                disabled={isLoading}
                placeholder="g, kg, L, un"
                className={errors.unit ? "border-destructive" : ""}
              />
              {errors.unit && (
                <p className="text-xs text-destructive">{errors.unit}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade</Label>
              <Select
                value={form.priority}
                onValueChange={(v) =>
                  handleChange("priority", v as "high" | "medium" | "low")
                }
                disabled={isLoading}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => handleChange("isActive", e.target.checked)}
              disabled={isLoading || isEdit}
              className="w-4 h-4 rounded border-border text-brand focus:ring-brand/30 cursor-pointer disabled:opacity-50"
            />
            <span className="text-sm text-foreground/90">Ativo</span>
          </label>

          {/* Ingredient summary */}
          {selectedIngredient && (
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-0.5">
              <p>
                Ingrediente:{" "}
                <span className="text-foreground/90 font-medium">
                  {(selectedIngredient as { name: string }).name}
                </span>
              </p>
              <p>
                Categoria:{" "}
                <span className="text-foreground/90 font-medium">
                  {(selectedIngredient as { category: string }).category}
                </span>
              </p>
              <p>
                Unidade base:{" "}
                <span className="text-foreground/90 font-medium">
                  {(selectedIngredient as { baseUnit: string }).baseUnit}
                </span>
              </p>
            </div>
          )}

          {/* Footer */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
