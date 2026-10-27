import type { Express } from "express";

export type RealtimeEvent =
  | { type: "comanda_nueva"; area: "COCINA" | "BAR"; pedidoId: number }
  | { type: "item_listo"; mozoId: number; itemId: number; mesaNumero: number }
  | { type: "insumo_stock"; insumoId: number; stock: string; bajo: boolean }
  | { type: "insumo_agotado"; insumoId: number; nombre: string; mesaNumero?: number };

type Listener = (e: RealtimeEvent) => void;

const channels = new Map<number, Set<Listener>>();

export function publish(empresaId: number, event: RealtimeEvent): void {
  channels.get(empresaId)?.forEach(send => send(event));
}

const ventanas = new Map<string, { pendiente?: () => void }>();

/**
 * Throttle por clave: `fire` corre ya si la clave no tiene ventana abierta; si la tiene, solo se recuerda
 * el ultimo y corre una vez al cerrar la ventana (asi el ultimo cambio nunca se pierde).
 */
export function throttle(key: string, fire: () => void, ms = 5000): void {
  const v = ventanas.get(key);
  if (v) {
    v.pendiente = fire;
    return;
  }
  ventanas.set(key, {});
  setTimeout(() => {
    const pendiente = ventanas.get(key)?.pendiente;
    ventanas.delete(key);
    try {
      pendiente?.();
    } catch (err) {
      console.error("[events] throttled publish failed:", err);
    }
  }, ms).unref?.();
  fire();
}

export function subscribe(empresaId: number, send: Listener): () => void {
  let set = channels.get(empresaId);
  if (!set) {
    set = new Set();
    channels.set(empresaId, set);
  }
  set.add(send);
  return () => {
    const s = channels.get(empresaId);
    if (!s) return;
    s.delete(send);
    if (s.size === 0) channels.delete(empresaId);
  };
}

export function registerEventsRoute(app: Express): void {
  app.get("/api/events", (req, res) => {
    const empresaId = Number(req.query.empresaId);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      res.status(400).end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(": connected\n\n");
    const unsubscribe = subscribe(empresaId, e => {
      res.write(`data: ${JSON.stringify(e)}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 25_000);
    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
