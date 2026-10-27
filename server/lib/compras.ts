/** Subtotal en centimos: cantidad (3 dec) x costo (4 dec) en enteros, redondeo half-up a 2 decimales. */
export function subtotalCents(cantidad: number, costoUnitario: number): number {
  const p = Math.round(cantidad * 1000) * Math.round(costoUnitario * 10000);
  return Math.floor((p + 50000) / 100000);
}

export const centsToStr = (c: number) => (c / 100).toFixed(2);
const toCents = (s: string) => Math.round(Number(s) * 100);

export type GastoRow = { fecha: string; insumoId: number; nombre: string; subtotal: string };

export function agregarGastos(rows: GastoRow[]) {
  const dia = new Map<string, number>();
  const ins = new Map<number, { nombre: string; c: number }>();
  let total = 0;
  for (const r of rows) {
    const c = toCents(r.subtotal);
    total += c;
    dia.set(r.fecha, (dia.get(r.fecha) ?? 0) + c);
    const i = ins.get(r.insumoId) ?? { nombre: r.nombre, c: 0 };
    i.c += c;
    ins.set(r.insumoId, i);
  }
  return {
    total: centsToStr(total),
    porDia: Array.from(dia).sort(([a], [b]) => a.localeCompare(b)).map(([fecha, c]) => ({ fecha, total: centsToStr(c) })),
    porInsumo: Array.from(ins).map(([insumoId, v]) => ({ insumoId, nombre: v.nombre, total: centsToStr(v.c) })).sort((a, b) => toCents(b.total) - toCents(a.total)),
  };
}
