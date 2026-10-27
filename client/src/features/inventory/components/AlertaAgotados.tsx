import { useLocation } from "wouter";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { useRealtime } from "@/hooks/useRealtime";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { Button } from "@/components/ui/forms/button";

export const toastAgotadoId = (insumoId: number) => `agotado-${insumoId}`;

/** Alertas de insumos agotados para Caja y Dueño. El mozo no las recibe. */
export function useAlertaAgotados() {
  const [, navigate] = useLocation();
  const { empleado, empresa } = usePOS();
  const utils = trpc.useUtils();
  const { enabled, enable, play } = useNotificationSound();
  const permitido = !!empleado && ["CAJERO", "DUENO", "ADMIN"].includes(empleado.rol);

  const { data: agotados = [] } = trpc.insumo.listAgotados.useQuery(
    { empresaId: empresa?.id || 0 },
    { enabled: permitido && !!empresa?.id }
  );

  useRealtime(empresa?.id, e => {
    if (!permitido) return;
    if (e.type === "insumo_stock" || e.type === "insumo_agotado") {
      utils.insumo.listAgotados.invalidate();
      utils.insumo.listByEmpresa.invalidate();
    }
    if (e.type === "insumo_stock" && Number(e.stock) > 0) toast.dismiss(toastAgotadoId(e.insumoId));
    if (e.type === "insumo_agotado") {
      play("alerta");
      toast.error(`Insumo agotado: ${e.nombre}`, {
        id: toastAgotadoId(e.insumoId),
        description: `Insumo agotado o insuficiente: ${e.nombre}`,
        duration: Infinity,
        action: { label: "Reponer", onClick: () => navigate("/inventario") },
      });
    }
  });

  return { permitido, agotados, enabled, enable };
}

export function AlertaAgotados({ permitido, agotados, enabled, enable }: ReturnType<typeof useAlertaAgotados>) {
  const [, navigate] = useLocation();
  if (!permitido) return null;
  return (
    <>
      {!enabled && (
        <Button variant="outline" size="sm" onClick={enable} className="mb-3 print:hidden">
          Activar sonido
        </Button>
      )}
      {agotados.length > 0 && (
        <div role="alert" className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 p-3">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span className="text-sm font-medium text-red-400">Insumos agotados:</span>
          {agotados.map(a => (
            <span key={a.id} className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">{a.nombre}</span>
          ))}
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => navigate("/inventario")}>
            Reponer
          </Button>
        </div>
      )}
    </>
  );
}
