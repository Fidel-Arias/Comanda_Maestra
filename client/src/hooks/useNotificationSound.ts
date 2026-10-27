import { useCallback, useSyncExternalStore } from "react";

export type NotificationKind = "nuevo" | "listo" | "alerta";

export interface UseNotificationSoundReturn {
  enabled: boolean;
  enable: () => void;
  play: (kind?: NotificationKind) => void;
}

// Archivo que sube el usuario en client/public/sounds/
const SRC = "/sounds/notification.mp3";
const GESTURES = ["pointerdown", "keydown", "touchstart"] as const;

const subscribers = new Set<() => void>();
let audio: HTMLAudioElement | null = null;
let unlocked = false;
let unlocking = false;

const getAudio = () => (audio ??= new Audio(SRC));

function unlock() {
  if (unlocked || unlocking || typeof Audio === "undefined") return;
  unlocking = true;
  const a = getAudio();
  a.muted = true;
  // El navegador solo permite audio tras un gesto: reproducir en silencio una vez lo habilita
  // para el resto de la pestaña. shortcut: si falta el mp3 se reintenta en cada clic; subir el archivo lo arregla.
  a.play()
    .then(() => {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
      unlocked = true;
      GESTURES.forEach(g => window.removeEventListener(g, unlock));
      subscribers.forEach(fn => fn());
    })
    .catch(() => {
      a.muted = false;
    })
    .finally(() => {
      unlocking = false;
    });
}

// El primer clic, tecla o toque en cualquier pantalla activa el sonido; no hace falta un botón.
if (typeof window !== "undefined") {
  GESTURES.forEach(g => window.addEventListener(g, unlock, { passive: true }));
}

const subscribe = (fn: () => void) => {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
};

export function useNotificationSound(): UseNotificationSoundReturn {
  const enabled = useSyncExternalStore(
    subscribe,
    () => unlocked,
    () => false
  );

  const play = useCallback(() => {
    if (!unlocked) return;
    const a = getAudio();
    a.currentTime = 0;
    void a.play().catch(() => {});
  }, []);

  return { enabled, enable: unlock, play };
}
