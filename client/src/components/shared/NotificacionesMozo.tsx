import { toast } from "sonner";
import { usePOS } from "@/features/auth/contexts/POSContext";
import { useRealtime } from "@/hooks/useRealtime";
import { useNotificationSound } from "@/hooks/useNotificationSound";

/** Avisa al mozo dueño del pedido cuando cocina o bar lo marcan listo, desde cualquier pantalla. */
export function NotificacionesMozo() {
  const { empleado, empresa } = usePOS();
  const { play } = useNotificationSound();

  useRealtime(empleado?.rol === "MOZO" ? empresa?.id : undefined, e => {
    if (e.type === "item_listo" && e.mozoId === empleado?.id) {
      play("listo");
      toast.info(`Mesa ${e.mesaNumero}: pedido listo para recoger`);
    }
  });

  return null;
}
