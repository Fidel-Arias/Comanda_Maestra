import type { Empresa } from "../../drizzle/schema";

export type EmpresaPublica = Omit<Empresa, "apisNetPeToken"> & { tieneApiKey: boolean };

/** Quita secretos de la empresa antes de enviarla al cliente. */
export function toPublicEmpresa(e: Empresa): EmpresaPublica {
  const { apisNetPeToken, ...rest } = e;
  return { ...rest, tieneApiKey: !!apisNetPeToken };
}
