"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usersService } from "@/services/api/users";
import { rolesService } from "@/services/api/roles";

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    _id?: string; name: string; email: string; phone: string; password: string; role: string;
  } | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersService.getAll().then((r) => r.data.data),
  });

  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesService.getAll().then((r) => r.data.data),
  });

  const mutation = useMutation({
    mutationFn: (vars: { method: "post" | "put"; id?: string; data: Record<string, unknown> }) => {
      if (vars.method === "post") return usersService.create(vars.data as { name: string; email: string; phone: string; password: string; role?: string });
      return usersService.update(vars.id!, vars.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuário salvo com sucesso");
      setEditing(null);
    },
    onError: () => toast.error("Erro ao salvar usuário"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuário excluído");
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao excluir usuário"),
  });

  const columns = [
    { key: "name", header: "Nome" },
    { key: "email", header: "E-mail" },
    { key: "phone", header: "Telefone" },
    {
      key: "role",
      header: "Perfil",
      cell: (row: unknown) => {
        const r = (row as Record<string, unknown>).role;
        return typeof r === "string" ? r : (r as { name?: string })?.name || "—";
      },
    },
    {
      key: "isActive",
      header: "Status",
      cell: (row: unknown) => (
        <StatusBadge status={((row as Record<string, unknown>).isActive as boolean) !== false ? "active" : "inactive"} />
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Usuarios</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie usuarios e permissoes</p>
        </div>
        <Button onClick={() => setEditing({ name: "", email: "", phone: "", password: "", role: "" })}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuario
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={users || []}
        loading={isLoading}
        searchKey="name"
        searchPlaceholder="Pesquisar usuários..."
        emptyMessage="Nenhum usuário encontrado."
        onEdit={(id) => {
          const u = (users || []).find((x: { _id: string }) => x._id === id);
          if (u) {
            const role = u.role;
            setEditing({
              _id: u._id,
              name: u.name,
              email: u.email,
              phone: String(u.phone || ""),
              password: "",
              role: typeof role === "string" ? role : (role as { _id?: string })?._id || "",
            });
          }
        }}
        onDelete={(id) => setDeleteId(id)}
      />

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?._id ? "Editar Usuario" : "Novo Usuario"}</DialogTitle>
            <DialogDescription>Preencha os dados do usuario</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-5 py-2">
            <div className="col-span-2 space-y-2">
              <Label>Nome</Label>
              <Input value={editing?.name || ""} onChange={(e) => setEditing((p) => p ? { ...p, name: e.target.value } : null)} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={editing?.email || ""} onChange={(e) => setEditing((p) => p ? { ...p, email: e.target.value } : null)} placeholder="usuario@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={editing?.phone || ""} onChange={(e) => setEditing((p) => p ? { ...p, phone: e.target.value } : null)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label>Senha {editing?._id ? "(vazio = manter)" : ""}</Label>
              <Input type="password" value={editing?.password || ""} onChange={(e) => setEditing((p) => p ? { ...p, password: e.target.value } : null)} placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={editing?.role || ""} onValueChange={(v) => setEditing((p) => p ? { ...p, role: v || "" } : null)}>
                <SelectTrigger>
                  {editing?.role ? (
                    <span>{(roles || []).find((r: { _id: string; name: string }) => r._id === editing.role)?.name || editing.role}</span>
                  ) : (
                    <SelectValue placeholder="Selecione" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {(roles || []).map((r: { _id: string; name: string }) => (
                    <SelectItem key={r._id} value={r._id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={mutation.isPending}>Cancelar</Button>
            <Button
              disabled={mutation.isPending || !editing?.name || !editing?.email}
              onClick={() => {
                if (!editing) return;
                const { password, ...rest } = editing;
                const data: Record<string, unknown> = { ...rest };
                if (password) data.password = password;
                mutation.mutate({
                  method: editing._id ? "put" : "post",
                  id: editing._id,
                  data,
                });
              }}
            >
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Excluir Usuário"
        description="Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita."
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        confirmLabel="Excluir"
        variant="destructive"
      />
    </div>
  );
}
