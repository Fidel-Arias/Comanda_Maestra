import { and, eq, sql } from "drizzle-orm";
import type { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import * as dbModule from "../db";
import { insumos, movimientosInventario, type Empleado } from "../../drizzle/schema";

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
  if (!Number.isFinite(m.cantidad) || m.cantidad < 0 || (m.tipo !== "AJUSTE" && r3(m.cantidad) === 0)) {
    throw new Error(`Cantidad invalida para movimiento de inventario: ${m.cantidad}`);
  }
  if (m.costoUnitario !== undefined && (!Number.isFinite(m.costoUnitario) || m.costoUnitario < 0)) {
    throw new Error(`Costo unitario invalido: ${m.costoUnitario}`);
  }
  // Nota: para AJUSTE, `cantidad` guarda el saldo OBJETIVO (no el delta); `saldoDespues` es el saldo autoritativo.
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

const ROLES_INVENTARIO = ["CAJERO", "DUENO", "ADMIN"];

/** Solo CAJERO/DUENO/ADMIN de la misma empresa pueden modificar inventario. */
export async function exigirRolInventario(empleadoId: number, empresaId: number): Promise<Empleado> {
  const empleado = await dbModule.getEmpleadoById(empleadoId);
  if (!empleado || empleado.empresaId !== empresaId || !ROLES_INVENTARIO.includes(empleado.userRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No tienes permiso para modificar el inventario" });
  }
  return empleado;
}

export type MovimientoKardex = {
  createdAt: Date;
  tipo: TipoMovimiento;
  motivo: MotivoMovimiento;
  cantidad: string;
  saldoDespues: string;
  costoUnitario: string | null;
  referenciaTipo: string | null;
  referenciaId: number | null;
};

export type FilaKardex = {
  fecha: Date;
  tipo: TipoMovimiento;
  motivo: MotivoMovimiento;
  entrada: string;
  salida: string;
  saldo: string;
  costoUnitario: string | null;
  referencia: string | null;
};

/** Kardex fisico. Entrada/salida se derivan de la diferencia de saldos (AJUSTE guarda el saldo objetivo en `cantidad`). */
export function armarKardex(
  saldoInicial: number,
  movs: MovimientoKardex[],
): { saldoInicial: string; filas: FilaKardex[] } {
  let previo = saldoInicial;
  const filas = movs.map(m => {
    const saldo = Number(m.saldoDespues);
    const delta = r3(saldo - previo);
    previo = saldo;
    return {
      fecha: m.createdAt,
      tipo: m.tipo,
      motivo: m.motivo,
      entrada: (delta > 0 ? delta : 0).toFixed(3),
      salida: (delta < 0 ? -delta : 0).toFixed(3),
      saldo: saldo.toFixed(3),
      costoUnitario: m.costoUnitario,
      referencia: m.referenciaTipo ? `${m.referenciaTipo}${m.referenciaId != null ? ` #${m.referenciaId}` : ""}` : null,
    };
  });
  return { saldoInicial: r3(saldoInicial).toFixed(3), filas };
}

// ============================================
// CONSUMO POR PEDIDO (Task 10)
// ============================================

export class StockInsuficienteError extends Error {
  constructor(public insumoId: number, public nombre: string) {
    super(`Sin stock de ${nombre}`);
  }
}

export type InsumoTocado = { insumoId: number; stock: string; bajo: boolean; agotado: boolean; nombre: string };

const REF_ITEM = "ITEM_PEDIDO";

async function mover(
  tx: Tx,
  empresaId: number,
  insumoId: number,
  cantidad: number,
  salida: boolean,
  referenciaId: number,
  empleadoId: number | null,
): Promise<InsumoTocado | undefined> {
  const row = await dbModule.ajustarStockInsumo(tx, empresaId, insumoId, salida ? -cantidad : cantidad);
  if (!row) return undefined;
  await dbModule.insertMovimientoInventario(tx, {
    empresaId,
    insumoId,
    tipo: salida ? "SALIDA" : "ENTRADA",
    motivo: salida ? "CONSUMO_PEDIDO" : "ANULACION",
    cantidad: cantidad.toFixed(3),
    saldoDespues: row.stock,
    referenciaTipo: REF_ITEM,
    referenciaId,
    empleadoId,
  });
  const saldo = Number(row.stock);
  return { insumoId, stock: row.stock, bajo: saldo <= Number(row.stockMinimo), agotado: salida && saldo <= 0, nombre: row.nombre };
}

async function recetaDe(productoId: number, empresaId: number) {
  const rows = await dbModule.getRecetasByProductos([productoId], empresaId);
  return rows.map(r => ({ insumoId: r.insumoId, cantidad: Number(r.cantidad) }));
}

/**
 * Descuenta la receta x cantidad dentro de `tx`, insumo por insumo en orden de id (evita deadlocks).
 * El UPDATE es condicional (stock >= n): si falta stock lanza StockInsuficienteError y el llamador
 * debe dejar que la transaccion haga rollback completo.
 */
export async function descontarInsumosItem(
  tx: Tx,
  p: { empresaId: number; itemId: number; productoId: number; cantidad: number; empleadoId: number | null },
): Promise<InsumoTocado[]> {
  const consumo = consumoPorPlato(await recetaDe(p.productoId, p.empresaId), p.cantidad)
    .filter(c => c.cantidad > 0)
    .sort((a, b) => a.insumoId - b.insumoId);
  const tocados: InsumoTocado[] = [];
  for (const c of consumo) {
    const t = await mover(tx, p.empresaId, c.insumoId, c.cantidad, true, p.itemId, p.empleadoId);
    if (!t) {
      const ins = await dbModule.getInsumoById(c.insumoId, p.empresaId);
      throw new StockInsuficienteError(c.insumoId, ins?.nombre ?? `insumo #${c.insumoId}`);
    }
    tocados.push(t);
  }
  return tocados;
}

/**
 * Repone (ENTRADA/ANULACION) lo pendiente de cada item: SALIDAs registradas menos ENTRADAs ya hechas
 * con la misma referencia, asi nunca se repone dos veces. Con `cantidad` repone solo receta x cantidad
 * (tope: lo pendiente). Aplica todo en orden global de insumoId.
 * El llamador debe tener bloqueadas las filas de los items (DELETE / FOR UPDATE) para serializar.
 */
export async function reponerInsumosItems(
  tx: Tx,
  empresaId: number,
  items: { itemId: number; productoId: number; cantidad?: number }[],
): Promise<InsumoTocado[]> {
  if (items.length === 0) return [];
  const movs = await dbModule.getMovimientosItems(tx, empresaId, items.map(i => i.itemId));
  const ops: { itemId: number; insumoId: number; cantidad: number }[] = [];
  for (const it of items) {
    const pendiente = new Map<number, number>();
    for (const m of movs) {
      if (m.referenciaId !== it.itemId) continue;
      const signo = m.tipo === "SALIDA" ? 1 : m.tipo === "ENTRADA" ? -1 : 0;
      pendiente.set(m.insumoId, (pendiente.get(m.insumoId) ?? 0) + signo * Number(m.cantidad));
    }
    const objetivo = it.cantidad === undefined
      ? Array.from(pendiente, ([insumoId, cantidad]) => ({ insumoId, cantidad }))
      : consumoPorPlato(await recetaDe(it.productoId, empresaId), it.cantidad)
          .map(c => ({ insumoId: c.insumoId, cantidad: Math.min(c.cantidad, pendiente.get(c.insumoId) ?? 0) }));
    for (const o of objetivo) {
      const cantidad = r3(o.cantidad);
      if (cantidad > 0) ops.push({ itemId: it.itemId, insumoId: o.insumoId, cantidad });
    }
  }
  ops.sort((a, b) => a.insumoId - b.insumoId);
  const tocados: InsumoTocado[] = [];
  for (const op of ops) {
    const t = await mover(tx, empresaId, op.insumoId, op.cantidad, false, op.itemId, null);
    if (!t) throw new Error(`Insumo ${op.insumoId} no existe para la empresa ${empresaId}`);
    tocados.push(t);
  }
  return tocados;
}

/** Porciones que alcanzan con el stock actual; null si no hay receta. Insumo ausente (inactivo) = 0. */
export function porcionesDisponibles(
  receta: { insumoId: number; cantidad: number }[],
  stocks: Map<number, number>,
): number | null {
  if (receta.length === 0) return null;
  // El epsilon evita que 0.6 / 0.2 = 2.9999... cuente como 2.
  const min = Math.min(...receta.map(r => Math.floor((stocks.get(r.insumoId) ?? 0) / r.cantidad + 1e-9)));
  return Math.max(0, min);
}
