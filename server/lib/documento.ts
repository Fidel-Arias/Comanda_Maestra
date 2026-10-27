export type DocumentoNormalizado = { tipo: "DNI" | "RUC"; numero: string };

/** Normaliza un DNI (8 dígitos) o RUC (11 dígitos, prefijo 10/15/17/20). */
export function normalizarDocumento(raw: string): DocumentoNormalizado {
  const numero = (raw ?? "").replace(/\s+/g, "");
  if (/^\d{8}$/.test(numero)) return { tipo: "DNI", numero };
  if (/^(10|15|17|20)\d{9}$/.test(numero)) return { tipo: "RUC", numero };
  throw new Error(`Documento inválido: "${raw}". Use 8 dígitos (DNI) u 11 dígitos (RUC).`);
}
