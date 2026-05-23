import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { motion } from "framer-motion";
import { MdClose, MdWarning } from "react-icons/md";
import {
  getIngredients,
  getLocations,
  getStores,
} from "../../https";

const INITIAL_FORM = {
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

const validateForm = (values) => {
  const errors = {};

  if (!values.storeId) errors.storeId = "Loja é obrigatória.";
  if (!values.locationId) errors.locationId = "Localização é obrigatória.";
  if (!values.ingredientId)
    errors.ingredientId = "Ingrediente é obrigatório.";

  const min = Number(values.minQuantity);
  const reorder = Number(values.reorderPoint);
  const ideal = Number(values.idealQuantity);
  const max = Number(values.maxQuantity);

  if (values.minQuantity === "" || isNaN(min))
    errors.minQuantity = "Quantidade mínima é obrigatória.";
  else if (min < 0) errors.minQuantity = "Não pode ser negativa.";
  else if (min > 999999) errors.minQuantity = "Valor muito alto.";

  if (values.reorderPoint === "" || isNaN(reorder))
    errors.reorderPoint = "Ponto de ressuprimento é obrigatório.";
  else if (reorder < 0) errors.reorderPoint = "Não pode ser negativo.";
  else if (reorder > 999999) errors.reorderPoint = "Valor muito alto.";

  if (values.idealQuantity === "" || isNaN(ideal))
    errors.idealQuantity = "Quantidade ideal é obrigatória.";
  else if (ideal < 0) errors.idealQuantity = "Não pode ser negativa.";
  else if (ideal > 999999) errors.idealQuantity = "Valor muito alto.";

  if (values.maxQuantity === "" || isNaN(max))
    errors.maxQuantity = "Quantidade máxima é obrigatória.";
  else if (max < 0) errors.maxQuantity = "Não pode ser negativa.";
  else if (max > 999999) errors.maxQuantity = "Valor muito alto.";

  // Hierarchical validation
  if (!isNaN(min) && !isNaN(reorder) && min > reorder) {
    errors.minQuantity = "Mínimo deve ser <= Ponto de Ressuprimento.";
  }
  if (!isNaN(reorder) && !isNaN(ideal) && reorder > ideal) {
    errors.reorderPoint =
      "Ponto de Ressuprimento deve ser <= Quantidade Ideal.";
  }
  if (!isNaN(ideal) && !isNaN(max) && ideal > max) {
    errors.idealQuantity = "Quantidade Ideal deve ser <= Máxima.";
  }

  if (!values.unit) errors.unit = "Unidade é obrigatória.";

  return errors;
};

const PolicyFormModal = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  isLoading,
}) => {
  const user = useSelector((state) => state.user);
  const isMasterAdmin = user?.isMasterAdmin;
  const userStoreId = user?.store?._id;

  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});

  // Fetch dropdown data
  const { data: storesData } = useQuery({
    queryKey: ["stores"],
    queryFn: getStores,
    enabled: isOpen,
    staleTime: 120_000,
  });

  const { data: ingredientsData } = useQuery({
    queryKey: ["ingredients"],
    queryFn: () => getIngredients({ isActive: true }),
    enabled: isOpen,
    staleTime: 120_000,
  });

  const { data: locationsData } = useQuery({
    queryKey: ["locations", form.storeId],
    queryFn: () => getLocations({ type: "STORE" }),
    enabled: isOpen && !!form.storeId,
    staleTime: 60_000,
  });

  const stores = storesData?.data?.data || [];
  const ingredients = ingredientsData?.data?.data || [];
  const locations = locationsData?.data?.data || [];

  // Filter locations by selected store
  const filteredLocations = useMemo(() => {
    return form.storeId
      ? locations.filter((loc) => loc.store?.toString() === form.storeId)
      : [];
  }, [locations, form.storeId]);

  // Selected ingredient auto-populates unit
  const selectedIngredient = useMemo(() => {
    return ingredients.find((i) => i._id === form.ingredientId);
  }, [ingredients, form.ingredientId]);

  // Initialize form when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setForm({
        storeId: initialData.store?._id || initialData.store?.toString() || "",
        locationId:
          initialData.location?._id || initialData.location?.toString() || "",
        ingredientId:
          initialData.ingredient?._id ||
          initialData.ingredient?.toString() ||
          "",
        minQuantity: initialData.minQuantity ?? "",
        reorderPoint: initialData.reorderPoint ?? "",
        idealQuantity: initialData.idealQuantity ?? "",
        maxQuantity: initialData.maxQuantity ?? "",
        unit: initialData.unit || "",
        priority: initialData.priority || "medium",
        isActive: initialData.isActive !== false,
      });
    } else {
      setForm({
        ...INITIAL_FORM,
        storeId: isMasterAdmin ? "" : userStoreId || "",
      });
    }
    setErrors({});
  }, [isOpen, initialData, isMasterAdmin, userStoreId]);

  // Auto-populate unit when ingredient changes (on create)
  useEffect(() => {
    if (selectedIngredient && !initialData) {
      setForm((prev) => ({
        ...prev,
        unit: selectedIngredient.baseUnit || prev.unit,
      }));
    }
  }, [selectedIngredient, initialData]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateForm(form);
    setErrors(validation);

    if (Object.keys(validation).length > 0) return;

    onSave({
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

  if (!isOpen) return null;

  const isEdit = !!initialData;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 overflow-y-auto py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="bg-[#1a1a1a] rounded-xl shadow-lg w-full max-w-2xl mx-4 border border-[#333]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333]">
          <h2 className="text-lg text-[#f5f5f5] font-semibold">
            {isEdit ? "Editar Politica de Estoque" : "Criar Politica de Estoque"}
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-[#ababab] hover:text-[#f5f5f5] transition-colors disabled:opacity-50"
          >
            <MdClose className="text-xl" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-5">
          {/* Store */}
          <div>
            <label className="block text-[#ababab] text-xs font-medium mb-1 uppercase tracking-wide">
              Loja
            </label>
            {isMasterAdmin ? (
              <select
                value={form.storeId}
                onChange={(e) => handleChange("storeId", e.target.value)}
                disabled={isLoading || isEdit}
                className={`w-full bg-[#111] text-[#f5f5f5] text-sm px-4 py-2.5 rounded-lg outline-none border ${
                  errors.storeId ? "border-[#ff6b6b]" : "border-[#333]"
                } focus:border-[#555] disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <option value="">Selecione uma loja</option>
                {stores.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={stores.find((s) => s._id === userStoreId)?.name || "Minha Loja"}
                disabled
                className="w-full bg-[#111] text-[#ababab] text-sm px-4 py-2.5 rounded-lg outline-none border border-[#333] cursor-not-allowed"
              />
            )}
            {errors.storeId && (
              <p className="text-[#ff6b6b] text-xs mt-1">{errors.storeId}</p>
            )}
          </div>

          {/* Row: Location + Ingredient */}
          <div className="grid grid-cols-2 gap-4">
            {/* Location */}
            <div>
              <label className="block text-[#ababab] text-xs font-medium mb-1 uppercase tracking-wide">
                Localizacao
              </label>
              <select
                value={form.locationId}
                onChange={(e) => handleChange("locationId", e.target.value)}
                disabled={isLoading || !form.storeId}
                className={`w-full bg-[#111] text-[#f5f5f5] text-sm px-4 py-2.5 rounded-lg outline-none border ${
                  errors.locationId ? "border-[#ff6b6b]" : "border-[#333]"
                } focus:border-[#555] disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <option value="">Selecione</option>
                {filteredLocations.map((loc) => (
                  <option key={loc._id} value={loc._id}>
                    {loc.name}
                  </option>
                ))}
              </select>
              {errors.locationId && (
                <p className="text-[#ff6b6b] text-xs mt-1">
                  {errors.locationId}
                </p>
              )}
            </div>

            {/* Ingredient */}
            <div>
              <label className="block text-[#ababab] text-xs font-medium mb-1 uppercase tracking-wide">
                Ingrediente
              </label>
              <select
                value={form.ingredientId}
                onChange={(e) => handleChange("ingredientId", e.target.value)}
                disabled={isLoading || isEdit}
                className={`w-full bg-[#111] text-[#f5f5f5] text-sm px-4 py-2.5 rounded-lg outline-none border ${
                  errors.ingredientId ? "border-[#ff6b6b]" : "border-[#333]"
                } focus:border-[#555] disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <option value="">Selecione</option>
                {ingredients.map((ing) => (
                  <option key={ing._id} value={ing._id}>
                    {ing.name} ({ing.baseUnit})
                  </option>
                ))}
              </select>
              {errors.ingredientId && (
                <p className="text-[#ff6b6b] text-xs mt-1">
                  {errors.ingredientId}
                </p>
              )}
            </div>
          </div>

          {/* Row: Quantities */}
          <div>
            <label className="block text-[#ababab] text-xs font-medium mb-2 uppercase tracking-wide">
              Quantidades
            </label>
            <div className="grid grid-cols-4 gap-3">
              {[
                {
                  field: "minQuantity",
                  label: "Minimo",
                  placeholder: "0",
                },
                {
                  field: "reorderPoint",
                  label: "Ressuprimento",
                  placeholder: "0",
                },
                {
                  field: "idealQuantity",
                  label: "Ideal",
                  placeholder: "0",
                },
                {
                  field: "maxQuantity",
                  label: "Maximo",
                  placeholder: "0",
                },
              ].map(({ field, label, placeholder }) => (
                <div key={field}>
                  <input
                    type="number"
                    placeholder={placeholder}
                    min="0"
                    step="any"
                    value={form[field]}
                    onChange={(e) => handleChange(field, e.target.value)}
                    disabled={isLoading}
                    className={`w-full bg-[#111] text-[#f5f5f5] text-sm px-3 py-2.5 rounded-lg outline-none border ${
                      errors[field] ? "border-[#ff6b6b]" : "border-[#333]"
                    } focus:border-[#555] disabled:opacity-50`}
                  />
                  <p className="text-[#666] text-xs mt-1">{label}</p>
                  {errors[field] && (
                    <p className="text-[#ff6b6b] text-xs mt-0.5">
                      {errors[field]}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {/* Hierarchical hint */}
            {!errors.minQuantity &&
              !errors.reorderPoint &&
              !errors.idealQuantity &&
              !errors.maxQuantity && (
                <p className="text-[#555] text-xs mt-1">
                  Minimo &le; Ressuprimento &le; Ideal &le; Maximo
                </p>
              )}
          </div>

          {/* Row: Unit + Priority */}
          <div className="grid grid-cols-2 gap-4">
            {/* Unit */}
            <div>
              <label className="block text-[#ababab] text-xs font-medium mb-1 uppercase tracking-wide">
                Unidade
              </label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => handleChange("unit", e.target.value)}
                disabled={isLoading}
                placeholder="g, kg, L, un"
                className={`w-full bg-[#111] text-[#f5f5f5] text-sm px-4 py-2.5 rounded-lg outline-none border ${
                  errors.unit ? "border-[#ff6b6b]" : "border-[#333]"
                } focus:border-[#555] disabled:opacity-50`}
              />
              {errors.unit && (
                <p className="text-[#ff6b6b] text-xs mt-1">{errors.unit}</p>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-[#ababab] text-xs font-medium mb-1 uppercase tracking-wide">
                Prioridade
              </label>
              <select
                value={form.priority}
                onChange={(e) => handleChange("priority", e.target.value)}
                disabled={isLoading}
                className="w-full bg-[#111] text-[#f5f5f5] text-sm px-4 py-2.5 rounded-lg outline-none border border-[#333] focus:border-[#555] disabled:opacity-50"
              >
                <option value="low">Baixa</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </div>
          </div>

          {/* Active checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => handleChange("isActive", e.target.checked)}
              disabled={isLoading || isEdit}
              className="w-4 h-4 rounded bg-[#111] border-[#333] text-[#2ed573] focus:ring-0 cursor-pointer disabled:opacity-50"
            />
            <span className="text-[#f5f5f5] text-sm">Ativo</span>
          </label>

          {/* Summary / error block */}
          {selectedIngredient && (
            <div className="bg-[#1f1f1f] rounded-lg p-3 text-xs text-[#ababab] space-y-0.5">
              <p>
                Ingrediente:{" "}
                <span className="text-[#f5f5f5]">
                  {selectedIngredient.name}
                </span>
              </p>
              <p>
                Categoria:{" "}
                <span className="text-[#f5f5f5]">
                  {selectedIngredient.category}
                </span>
              </p>
              <p>
                Unidade base:{" "}
                <span className="text-[#f5f5f5]">
                  {selectedIngredient.baseUnit}
                </span>
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t border-[#333]">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="bg-[#262626] hover:bg-[#333] text-[#ababab] px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="bg-[#1a3a1a] hover:bg-[#2a5a2a] text-[#2ed573] px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading && (
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              )}
              {isEdit ? "Atualizar" : "Criar"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default PolicyFormModal;
