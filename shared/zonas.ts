export interface ZonaLimites {
  maxMesas: number;
  maxSillas: number;
}

export interface MesaEnZona {
  id: number;
  sillas: number;
}

/**
 * Valida el alta/edición de una mesa dentro de una zona.
 * Devuelve un mensaje de error o null si es válida.
 */
export function validarMesaEnZona(
  zona: ZonaLimites,
  mesasActuales: MesaEnZona[],
  nueva: { id?: number; sillas: number }
): string | null {
  if (!Number.isInteger(nueva.sillas) || nueva.sillas < 1) {
    return "El número de sillas debe ser al menos 1";
  }
  const otras = mesasActuales.filter((m) => m.id !== nueva.id);
  if (otras.length + 1 > zona.maxMesas) {
    return `La zona solo admite ${zona.maxMesas} mesas`;
  }
  const sillas = otras.reduce((s, m) => s + m.sillas, 0) + nueva.sillas;
  if (sillas > zona.maxSillas) {
    return `La zona solo admite ${zona.maxSillas} sillas (quedarían ${sillas})`;
  }
  return null;
}
