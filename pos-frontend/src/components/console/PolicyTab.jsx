import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStockPolicies } from "../../https";
import usePolicyActions from "../../hooks/usePolicyActions";
import { useCapabilities } from "../../hooks/useCapabilities";
import PolicyFormModal from "./PolicyFormModal";
import LoadingState from "./LoadingState";
import ErrorState from "./ErrorState";
import EmptyState from "./EmptyState";
import {
  MdAdd,
  MdEdit,
  MdDelete,
  MdCheck,
  MdClose as MdCloseIcon,
} from "react-icons/md";

const priorityConfig = {
  high: { label: "Alta", bg: "bg-[#4a1a1a]", text: "text-[#ff6b6b]" },
  medium: { label: "Media", bg: "bg-[#4a4a1a]", text: "text-[#feca57]" },
  low: { label: "Baixa", bg: "bg-[#1a2a4a]", text: "text-[#54a0ff]" },
};

const PolicyTab = () => {
  const { can } = useCapabilities();
  const canAdjust = can("inventory", "adjust");

  const [priorityFilter, setPriorityFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);

  const {
    isLoading: isActionsLoading,
    createPolicy,
    updatePolicy,
    deletePolicy,
  } = usePolicyActions();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["stockPolicies"],
    queryFn: () => getStockPolicies({ limit: 200 }),
    staleTime: 60_000,
  });

  if (isLoading) return <LoadingState rows={6} />;
  if (isError)
    return (
      <ErrorState
        message="Falha ao carregar politicas de estoque."
        onRetry={refetch}
      />
    );

  const policies = data?.data?.data || [];

  const filtered = useMemo(() => {
    return policies.filter((p) => {
      const matchPriority =
        priorityFilter === "all" || p.priority === priorityFilter;
      const matchActive =
        activeFilter === "all" ||
        (activeFilter === "active" && p.isActive) ||
        (activeFilter === "inactive" && !p.isActive);
      const name = p.ingredient?.name?.toLowerCase() || "";
      const matchSearch = name.includes(search.toLowerCase());
      return matchPriority && matchActive && matchSearch;
    });
  }, [policies, priorityFilter, activeFilter, search]);

  const handleOpenCreate = () => {
    setEditingPolicy(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (policy) => {
    setEditingPolicy(policy);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingPolicy(null);
  };

  const handleSave = async (formData) => {
    try {
      if (editingPolicy) {
        await updatePolicy({
          policyId: editingPolicy._id,
          data: formData,
        });
      } else {
        await createPolicy(formData);
      }
      handleCloseModal();
    } catch {
      // Error handled by hook via snackbar
    }
  };

  const handleDelete = async (policy) => {
    if (!window.confirm(`Desativar politica para "${policy.ingredient?.name || policy.ingredient}"?`)) {
      return;
    }
    try {
      await deletePolicy(policy._id);
    } catch {
      // Error handled by hook via snackbar
    }
  };

  if (policies.length === 0 && search === "" && priorityFilter === "all" && activeFilter === "all") {
    return (
      <div className="space-y-4">
        {canAdjust && (
          <div className="flex justify-end">
            <button
              onClick={handleOpenCreate}
              className="bg-[#1a3a1a] hover:bg-[#2a5a2a] text-[#2ed573] px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <MdAdd className="text-lg" />
              Criar Politica
            </button>
          </div>
        )}
        <EmptyState message="Nenhuma politica de estoque cadastrada. Crie a primeira politica para comecar." />
        <PolicyFormModal
          isOpen={modalOpen}
          onClose={handleCloseModal}
          onSave={handleSave}
          initialData={null}
          isLoading={isActionsLoading}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar: filters + create button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Priority filter */}
          {[
            { value: "all", label: "Todas" },
            { value: "high", label: "Alta" },
            { value: "medium", label: "Media" },
            { value: "low", label: "Baixa" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setPriorityFilter(tab.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                priorityFilter === tab.value
                  ? "bg-[#333] text-[#f5f5f5]"
                  : "bg-[#1a1a1a] text-[#ababab] hover:bg-[#262626]"
              }`}
            >
              {tab.label}
            </button>
          ))}

          <span className="text-[#555] mx-1">|</span>

          {/* Active filter */}
          {[
            { value: "all", label: "Todas" },
            { value: "active", label: "Ativas" },
            { value: "inactive", label: "Inativas" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                activeFilter === tab.value
                  ? "bg-[#333] text-[#f5f5f5]"
                  : "bg-[#1a1a1a] text-[#ababab] hover:bg-[#262626]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {canAdjust && (
          <button
            onClick={handleOpenCreate}
            className="shrink-0 bg-[#1a3a1a] hover:bg-[#2a5a2a] text-[#2ed573] px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <MdAdd className="text-lg" />
            Criar Politica
          </button>
        )}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar por ingrediente..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-[#1a1a1a] text-[#f5f5f5] text-sm px-4 py-2 rounded-lg outline-none placeholder-[#666]"
      />

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState message="Nenhuma politica encontrada com este filtro." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-[#ababab] text-xs uppercase border-b border-[#333]">
                <th className="py-3 pr-3">Loja</th>
                <th className="py-3 px-3">Localizacao</th>
                <th className="py-3 px-3">Ingrediente</th>
                <th className="py-3 px-3 text-right">Min</th>
                <th className="py-3 px-3 text-right">Reorder</th>
                <th className="py-3 px-3 text-right">Ideal</th>
                <th className="py-3 px-3 text-right">Max</th>
                <th className="py-3 px-3">Unidade</th>
                <th className="py-3 px-3">Prioridade</th>
                <th className="py-3 px-3">Ativo</th>
                <th className="py-3 pl-3">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {filtered.map((p) => {
                const pConfig = priorityConfig[p.priority] || priorityConfig.medium;
                return (
                  <tr key={p._id} className="text-[#f5f5f5] hover:bg-[#1a1a1a] transition-colors">
                    <td className="py-3 pr-3 text-[#ababab]">
                      {p.store?.name || "-"}
                    </td>
                    <td className="py-3 px-3 text-[#ababab]">
                      {p.location?.name || "-"}
                    </td>
                    <td className="py-3 px-3 font-medium">
                      {p.ingredient?.name || "-"}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {p.minQuantity}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {p.reorderPoint}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {p.idealQuantity}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {p.maxQuantity}
                    </td>
                    <td className="py-3 px-3 text-[#ababab]">
                      {p.unit}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${pConfig.bg} ${pConfig.text}`}
                      >
                        {pConfig.label}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {p.isActive ? (
                        <MdCheck className="text-[#2ed573] text-lg" />
                      ) : (
                        <MdCloseIcon className="text-[#666] text-lg" />
                      )}
                    </td>
                    <td className="py-3 pl-3">
                      {canAdjust ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            disabled={isActionsLoading}
                            className="p-1.5 rounded text-[#ababab] hover:text-[#f5f5f5] hover:bg-[#262626] transition-colors disabled:opacity-50"
                            title="Editar"
                          >
                            <MdEdit className="text-lg" />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            disabled={isActionsLoading || !p.isActive}
                            className="p-1.5 rounded text-[#ff6b6b] hover:bg-[#4a1a1a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Desativar"
                          >
                            <MdDelete className="text-lg" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[#555] text-xs italic">
                          Sem permissao
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Count footer */}
      <p className="text-[#555] text-xs text-right">
        {filtered.length} de {policies.length} politicas
      </p>

      {/* Modal */}
      <PolicyFormModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        initialData={editingPolicy}
        isLoading={isActionsLoading}
      />
    </div>
  );
};

export default PolicyTab;
