import { useCallback, useRef, useState } from "react";

export type NotificationKind = "nuevo" | "listo";

export interface UseNotificationSoundReturn {
  enabled: boolean;
  enable: () => void;
  play: (kind: NotificationKind) => void;
}

const STORAGE_KEY = "sonido_activo";

function writePreference(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // storage unavailable (private mode, blocked): preference is simply not kept
  }
}

// Each entry is [frequency Hz, start offset s, duration s]
const PATTERNS: Record<NotificationKind, Array<[number, number, number]>> = {
  // dos pitidos agudos
  nuevo: [
    [1760, 0, 0.12],
    [1760, 0.18, 0.12],
  ],
  // campanilla ascendente de tres notas
  listo: [
    [523.25, 0, 0.3],
    [659.25, 0.12, 0.3],
    [783.99, 0.24, 0.45],
  ],
};

export function useNotificationSound(): UseNotificationSoundReturn {
  // enabled means: a context exists and is running (never seeded from storage,
  // since a fresh page load always starts the context suspended).
  const [enabled, setEnabled] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  const enable = useCallback(() => {
    try {
      let ctx = ctxRef.current;
      if (!ctx) {
        const created = new AudioContext();
        ctx = created;
        ctxRef.current = created;
        created.onstatechange = () => setEnabled(created.state === "running");
      }
      const sync = () => setEnabled(ctx.state === "running");
      sync();
      if (ctx.state === "suspended") {
        void ctx.resume().then(sync, () => {});
      }
    } catch {
      // Web Audio not available: sound stays silent
    }
    writePreference();
  }, []);

  const play = useCallback(
    (kind: NotificationKind) => {
      if (!enabled) return;
      try {
        const ctx = ctxRef.current;
        if (!ctx) return;
        if (ctx.state === "suspended") {
          void ctx.resume().catch(() => {});
        }
        const now = ctx.currentTime;
        for (const [freq, offset, dur] of PATTERNS[kind]) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.2, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + dur);
        }
      } catch {
        // never let audio errors reach the UI
      }
    },
    [enabled]
  );

  return { enabled, enable, play };
}
