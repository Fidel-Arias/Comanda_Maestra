import { and, eq, sql } from "drizzle-orm";
import type { getDb } from "../db";
import { insumos, movimientosInventario } from "../../drizzle/schema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
/** Parametro del callback de `db.transaction(async tx => ...)`. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type TipoMovimiento = "ENTRADA" | "SALIDA" | "AJUSTE";
export type MotivoMovimiento = "COMPRA" | "CONSUMO_PEDIDO" | "ANULACION" | "MERMA" | "AJUSTE_MANUAL" | "INICIAL";

const round = (n: number, d: number) => Number(n.toFixed(d));
const r3 = (n: number) => round(n, 3);
const r4 = (n: number) => round(n, 4);

export function calcularSaldo(saldo: number, tipo: TipoMovimiento, cantidad: number): number {
  if (tipo === "AJUSTE") return r3(cantidad);
  return r3(tipo === "ENTRADA" ? saldo + cantidad : saldo - cantidad);
}

export function costoPromedio(
  stockActual: number,
  costoActual: number,
  entrada: { cantidad: number; costoUnitario: number },
): number {
  if (stockActual <= 0) return r4(entrada.costoUnitario);
  const total = stockActual + entrada.cantidad;
  if (total <= 0) return r4(entrada.costoUnitario);
  return r4((stockActual * costoActual + entrada.cantidad * entrada.costoUnitario) / total);
}

export function consumoPorPlato(
  receta: { insumoId: number; cantidad: number }[],
  cantidadPlatos: number,
): { insumoId: number; cantidad: number }[] {
  return receta.map(r => ({ insumoId: r.insumoId, cantidad: r3(r.cantidad * cantidadPlatos) }));
}

export type MovimientoInput = {
  empresaId: number;
  insumoId: number;
  tipo: TipoMovimiento;
  motivo: MotivoMovimiento;
  cantidad: number;
  costoUnitario?: number;
  referenciaTipo?: string;
  referenciaId?: number;
  empleadoId?: number;
};

/**
 * Aplica un movimiento dentro de una transaccion. Actualizacion atomica de stock;
 * no publica eventos SSE (el llamador publica tras el commit).
 */
export async function aplicarMovimiento(
  tx: Tx,
  m: MovimientoInput,
): Promise<{ saldoDespues: string; bajo: boolean; agotado: boolean; nombre: string }> {
  const cantidad = r3(m.cantidad);
  const nuevoStock =
    m.tipo === "AJUSTE"
      ? sql`${cantidad.toFixed(3)}::numeric`
      : m.tipo === "ENTRADA"
        ? sql`${insumos.stock} + ${cantidad.toFixed(3)}::numeric`
        : sql`${insumos.stock} - ${cantidad.toFixed(3)}::numeric`;

  const [row] = await tx
    .update(insumos)
    .set({ stock: nuevoStock })
    .where(and(eq(insumos.id, m.insumoId), eq(insumos.empresaId, m.empresaId)))
    .returning({
      stock: insumos.stock,
      stockMinimo: insumos.stockMinimo,
      costoPromedio: insumos.costoPromedio,
      nombre: insumos.nombre,
    });
  if (!row) throw new Error(`Insumo ${m.insumoId} no existe para la empresa ${m.empresaId}`);

  // La fila queda bloqueada por el UPDATE hasta el commit, asi que recalcular el costo es seguro.
  if (m.tipo === "ENTRADA" && m.motivo === "COMPRA" && m.costoUnitario !== undefined) {
    const stockAntes = r3(Number(row.stock) - cantidad);
    const nuevoCosto = costoPromedio(stockAntes, Number(row.costoPromedio), {
      cantidad,
      costoUnitario: m.costoUnitario,
    });
    await tx
      .update(insumos)
      .set({ costoPromedio: nuevoCosto.toFixed(4) })
      .where(and(eq(insumos.id, m.insumoId), eq(insumos.empresaId, m.empresaId)));
  }

  await tx.insert(movimientosInventario).values({
    empresaId: m.empresaId,
    insumoId: m.insumoId,
    tipo: m.tipo,
    motivo: m.motivo,
    cantidad: cantidad.toFixed(3),
    saldoDespues: row.stock,
    costoUnitario: m.costoUnitario !== undefined ? r4(m.costoUnitario).toFixed(4) : null,
    referenciaTipo: m.referenciaTipo ?? null,
    referenciaId: m.referenciaId ?? null,
    empleadoId: m.empleadoId ?? null,
  });

  const saldo = Number(row.stock);
  return {
    saldoDespues: row.stock,
    bajo: saldo <= Number(row.stockMinimo),
    agotado: saldo <= 0,
    nombre: row.nombre,
  };
}
