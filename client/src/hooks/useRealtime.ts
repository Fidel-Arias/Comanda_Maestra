import { useEffect, useRef } from "react";
import type { RealtimeEvent } from "../../../server/lib/events";

export function useRealtime(
  empresaId: number | undefined,
  onEvent: (e: RealtimeEvent) => void
): void {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!empresaId) return;
    const es = new EventSource(`/api/events?empresaId=${empresaId}`);
    es.onmessage = msg => {
      try {
        handler.current(JSON.parse(msg.data) as RealtimeEvent);
      } catch {
        // ignore malformed payloads
      }
    };
    return () => es.close();
  }, [empresaId]);
}
