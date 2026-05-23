"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { ErrorState } from "@/components/shared/ErrorState";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rolesService } from "@/services/api/roles";

const modules = ["orders", "tables", "products", "inventory", "payments", "users", "devices", "reports", "settings"];
const actions = ["create", "read", "update", "delete"];

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    _id?: string; name: string; description: string; permissions: Record<string, string[]>;
  } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesService.getAll().then((r) => r.data.data),
  });

  const mutation = useMutation({
    mutationFn: (vars: { method: "post" | "put"; id?: string; data: Record<string, unknown> }) => {
      if (vars.method === "post") return rolesService.create(vars.data);
      return rolesService.update(vars.id!, vars.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Perfil salvo com sucesso");
      setEditing(null);
    },
    onError: () => toast.error("Erro ao salvar perfil"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rolesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Perfil excluído");
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao excluir perfil"),
  });

  const columns = [
    { key: "name", header: "Nome" },
    { key: "description", header: "Descrição" },
    {
      key: "isSystem",
      header: "Tipo",
      cell: (row: unknown) => (
        <StatusBadge
          status={((row as Record<string, unknown>).isSystem as boolean) ? "inactive" : "active"}
          label={((row as Record<string, unknown>).isSystem as boolean) ? "Sistema" : "Customizado"}
        />
      ),
    },
    {
      key: "isActive",
      header: "Status",
      cell: (row: unknown) => (
        <StatusBadge status={((row as Record<string, unknown>).isActive as boolean) ? "active" : "inactive"} />
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Perfis de Acesso</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie perfis e controle de acesso</p>
        </div>
        <Button onClick={() => setEditing({ name: "", description: "", permissions: {} })}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Perfil
        </Button>
      </div>

      {isError ? (
        <ErrorState
          message="Falha ao carregar perfis de acesso"
          description="Verifique se o servidor backend está rodando e tente novamente."
          onRetry={refetch}
        />
      ) : (
      <DataTable
        columns={columns}
        data={data || []}
        loading={isLoading}
        searchKey="name"
        searchPlaceholder="Pesquisar perfis..."
        emptyMessage="Nenhum perfil encontrado."
        onEdit={(id) => {
          const r = (data || []).find((x: { _id: string }) => x._id === id);
          if (r) setEditing({ _id: r._id, name: r.name, description: r.description || "", permissions: (r.permissions as Record<string, string[]>) || {} });
        }}
        onDelete={(id) => setDeleteId(id)}
      />
      )}

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?._id ? "Editar Perfil" : "Novo Perfil"}</DialogTitle>
            <DialogDescription>Preencha os dados e permissoes do perfil</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editing?.name || ""} onChange={(e) => setEditing((p) => p ? { ...p, name: e.target.value } : null)} placeholder="Nome do perfil" />
              </div>
              <div className="space-y-2">
                <Label>Descricao</Label>
                <Input value={editing?.description || ""} onChange={(e) => setEditing((p) => p ? { ...p, description: e.target.value } : null)} placeholder="Descricao do perfil" />
              </div>
            </div>
            <div>
              <Label className="text-sm">Permissoes</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {modules.map((mod) => (
                  <div key={mod} className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
                    <span className="text-sm text-foreground/80 capitalize w-24">{mod}</span>
                    <div className="flex gap-2">
                      {actions.map((act) => (
                        <label key={act} className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(editing?.permissions[mod] || []).includes(act)}
                            onChange={(e) => {
                              setEditing((p) => {
                                if (!p) return null;
                                const perms = { ...p.permissions };
                                const acts = new Set(perms[mod] || []);
                                if (e.target.checked) acts.add(act); else acts.delete(act);
                                perms[mod] = Array.from(acts);
                                return { ...p, permissions: perms };
                              });
                            }}
                            className="accent-brand"
                          />
                          {act}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={mutation.isPending}>Cancelar</Button>
            <Button disabled={mutation.isPending || !editing?.name} onClick={() => { if (!editing) return; mutation.mutate({ method: editing._id ? "put" : "post", id: editing._id, data: { name: editing.name, description: editing.description, permissions: editing.permissions } }) }}>
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Excluir Perfil"
        description="Tem certeza que deseja excluir este perfil? Usuários vinculados perderão as permissões."
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        confirmLabel="Excluir"
        variant="destructive"
      />
    </div>
  );
}
