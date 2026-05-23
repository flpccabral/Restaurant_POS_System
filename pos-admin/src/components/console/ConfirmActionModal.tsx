"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Loader2, XCircle } from "lucide-react";

interface ConfirmActionDetails {
  ingredient?: string;
  quantity?: number;
  unit?: string;
  origin?: string;
  destination?: string;
  currentBalance?: number;
  justification?: string;
  risks?: string;
}

interface ConfirmActionConfig {
  title: string;
  confirmLabel: string;
  description: string;
  icon: React.ReactNode;
  destructive?: boolean;
}

const actionConfigs: Record<string, ConfirmActionConfig> = {
  resolve: {
    title: "Resolver Alerta",
    confirmLabel: "Resolver",
    description: "Marcar o alerta como resolvido. O sistema parara de exibir este alerta a menos que a condicao ocorra novamente.",
    icon: <CheckCircle className="h-6 w-6 text-success" />,
  },
  dismiss: {
    title: "Ignorar Alerta",
    confirmLabel: "Ignorar",
    description: "Ignorar o alerta. Ele sera ocultado da lista de alertas ativos.",
    icon: <XCircle className="h-6 w-6 text-muted-foreground" />,
    destructive: true,
  },
  central_to_store: {
    title: "Transferencia Central → Loja",
    confirmLabel: "Executar Transferencia",
    description: "Transferir estoque do almoxarifado central para a loja. Esta acao nao pode ser desfeita automaticamente.",
    icon: <AlertTriangle className="h-6 w-6 text-warning" />,
  },
  inter_store_transfer: {
    title: "Transferencia entre Lojas",
    confirmLabel: "Executar Transferencia",
    description: "Transferir estoque entre lojas. Verifique se as lojas sao compativeis antes de prosseguir.",
    icon: <AlertTriangle className="h-6 w-6 text-warning" />,
  },
  purchase_needed: {
    title: "Registrar Compra",
    confirmLabel: "Registrar",
    description: "Registrar uma nota de compra. Nenhum pedido de compra real sera criado — apenas um registro.",
    icon: <CheckCircle className="h-6 w-6 text-info" />,
  },
};

interface ConfirmActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  actionType?: string | null;
  details?: ConfirmActionDetails | null;
  isLoading?: boolean;
}

export function ConfirmActionModal({
  open,
  onOpenChange,
  onConfirm,
  actionType,
  details,
  isLoading = false,
}: ConfirmActionModalProps) {
  const config = actionType
    ? actionConfigs[actionType] ?? {
        title: "Confirmar Acao",
        confirmLabel: "Confirmar",
        description: "Tem certeza que deseja executar esta acao?",
        icon: <AlertTriangle className="h-6 w-6 text-warning" />,
      }
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {config?.icon && (
              <div className="shrink-0">{config.icon}</div>
            )}
            <div>
              <DialogTitle>{config?.title ?? "Confirmar Acao"}</DialogTitle>
              <DialogDescription>{config?.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {details && (
          <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
            {details.ingredient && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ingrediente</span>
                <span className="font-medium text-foreground">{details.ingredient}</span>
              </div>
            )}
            {details.quantity != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quantidade</span>
                <span className="font-medium text-foreground">
                  {details.quantity}{details.unit ?? ""}
                </span>
              </div>
            )}
            {details.origin && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Origem</span>
                <span className="font-medium text-foreground">{details.origin}</span>
              </div>
            )}
            {details.destination && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Destino</span>
                <span className="font-medium text-foreground">{details.destination}</span>
              </div>
            )}
            {details.currentBalance != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo Atual</span>
                <span className="font-medium text-foreground">
                  {details.currentBalance}{details.unit ?? ""}
                </span>
              </div>
            )}
            {details.justification && (
              <div className="pt-2 border-t border-border">
                <span className="text-muted-foreground text-xs">Justificativa</span>
                <p className="text-foreground text-sm mt-1">{details.justification}</p>
              </div>
            )}
            {details.risks && (
              <div className="pt-2 border-t border-border">
                <span className="text-critical text-xs font-medium">Riscos</span>
                <p className="text-critical text-sm mt-1">{details.risks}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            variant={config?.destructive ? "destructive" : "default"}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {config?.confirmLabel ?? "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
