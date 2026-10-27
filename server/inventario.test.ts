import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { aplicarMovimiento, calcularSaldo, consumoPorPlato, costoPromedio, type Tx } from "./lib/inventario";

describe("calcularSaldo", () => {
  it("ENTRADA suma, SALIDA resta, AJUSTE fija", () => {
    expect(calcularSaldo(3, "ENTRADA", 2)).toBe(5);
    expect(calcularSaldo(3, "SALIDA", 2)).toBe(1);
    expect(calcularSaldo(3, "AJUSTE", 7)).toBe(7);
  });
  it("salida mayor al saldo da negativo sin lanzar", () => {
    expect(calcularSaldo(3, "SALIDA", 5)).toBe(-2);
  });
  it("evita deriva de flotantes", () => {
    expect(calcularSaldo(0.1, "ENTRADA", 0.2)).toBe(0.3);
  });
});

describe("costoPromedio", () => {
  it("promedio ponderado", () => {
    expect(costoPromedio(10, 3, { cantidad: 10, costoUnitario: 5 })).toBe(4);
  });
  it("stock <= 0 devuelve el costo de la entrada", () => {
    expect(costoPromedio(0, 3, { cantidad: 10, costoUnitario: 5 })).toBe(5);
    expect(costoPromedio(-2, 3, { cantidad: 10, costoUnitario: 5 })).toBe(5);
  });
  it("redondea a 4 decimales", () => {
    expect(costoPromedio(1, 1, { cantidad: 2, costoUnitario: 2 })).toBe(1.6667);
  });
});

describe("consumoPorPlato", () => {
  it("multiplica receta por platos", () => {
    expect(consumoPorPlato([{ insumoId: 1, cantidad: 0.25 }, { insumoId: 2, cantidad: 2 }], 3)).toEqual([
      { insumoId: 1, cantidad: 0.75 },
      { insumoId: 2, cantidad: 6 },
    ]);
  });
  it("sin deriva de flotantes", () => {
    expect(consumoPorPlato([{ insumoId: 1, cantidad: 0.1 }], 3)[0].cantidad).toBe(0.3);
  });
});

function fakeTx(row: { stock: string; stockMinimo: string; costoPromedio: string; nombre: string } | null) {
  const calls: { op: string; values?: any }[] = [];
  const tx: any = {
    update: () => ({
      set: (values: any) => {
        calls.push({ op: "update", values });
        return {
          where: () => {
            const p: any = Promise.resolve(undefined);
            p.returning = async () => (row ? [row] : []);
            return p;
          },
        };
      },
    }),
    insert: () => ({
      values: async (values: any) => {
        calls.push({ op: "insert", values });
      },
    }),
  };
  return { tx: tx as Tx, calls };
}
const base = { empresaId: 1, insumoId: 9 };

describe("aplicarMovimiento", () => {
  it("ENTRADA/COMPRA recalcula costoPromedio e inserta movimiento", async () => {
    // saldo despues 20, antes 10 a costo 3; entra 10 a 5 -> 4
    const { tx, calls } = fakeTx({ stock: "20.000", stockMinimo: "5.000", costoPromedio: "3.0000", nombre: "Arroz" });
    const r = await aplicarMovimiento(tx, { ...base, tipo: "ENTRADA", motivo: "COMPRA", cantidad: 10, costoUnitario: 5 });
    expect(r).toEqual({ saldoDespues: "20.000", bajo: false, agotado: false, nombre: "Arroz" });
    expect(calls.filter(c => c.op === "update")).toHaveLength(2);
    expect(calls.find(c => c.op === "update" && "costoPromedio" in c.values)!.values.costoPromedio).toBe("4.0000");
    const ins = calls.find(c => c.op === "insert")!.values;
    expect(ins).toMatchObject({ empresaId: 1, insumoId: 9, tipo: "ENTRADA", motivo: "COMPRA", cantidad: "10.000", saldoDespues: "20.000" });
  });

  it("SALIDA no toca el costo y marca bajo", async () => {
    const { tx, calls } = fakeTx({ stock: "5.000", stockMinimo: "5.000", costoPromedio: "3.0000", nombre: "Sal" });
    const r = await aplicarMovimiento(tx, { ...base, tipo: "SALIDA", motivo: "CONSUMO_PEDIDO", cantidad: 2, referenciaTipo: "PEDIDO", referenciaId: 4 });
    expect(r.bajo).toBe(true);
    expect(r.agotado).toBe(false);
    expect(calls.filter(c => c.op === "update")).toHaveLength(1);
    expect(calls.find(c => c.op === "insert")!.values).toMatchObject({ referenciaTipo: "PEDIDO", referenciaId: 4, saldoDespues: "5.000" });
  });

  it("saldo negativo marca agotado", async () => {
    const { tx } = fakeTx({ stock: "-1.000", stockMinimo: "0.000", costoPromedio: "0.0000", nombre: "X" });
    const r = await aplicarMovimiento(tx, { ...base, tipo: "SALIDA", motivo: "MERMA", cantidad: 3 });
    expect(r).toMatchObject({ saldoDespues: "-1.000", bajo: true, agotado: true });
  });

  it("AJUSTE fija el stock", async () => {
    const { tx, calls } = fakeTx({ stock: "7.000", stockMinimo: "1.000", costoPromedio: "3.0000", nombre: "X" });
    const r = await aplicarMovimiento(tx, { ...base, tipo: "AJUSTE", motivo: "AJUSTE_MANUAL", cantidad: 7 });
    expect(r.saldoDespues).toBe("7.000");
    const upd = calls.find(c => c.op === "update")!;
    expect(upd.values).toHaveProperty("stock");
    expect(calls.filter(c => c.op === "update")).toHaveLength(1);
  });

  it("lanza si el insumo no existe para la empresa", async () => {
    const { tx } = fakeTx(null);
    await expect(aplicarMovimiento(tx, { ...base, tipo: "SALIDA", motivo: "MERMA", cantidad: 1 })).rejects.toThrow(/insumo/i);
  });

  const render = (v: any) => new PgDialect().sqlToQuery(v);

  it("renderiza el SQL correcto de stock por tipo", async () => {
    const row = { stock: "1.000", stockMinimo: "0", costoPromedio: "0", nombre: "X" };
    const run = async (tipo: any, motivo: any) => {
      const { tx, calls } = fakeTx(row);
      await aplicarMovimiento(tx, { ...base, tipo, motivo, cantidad: 2 });
      return render(calls.find(c => c.op === "update")!.values.stock);
    };
    const ent = await run("ENTRADA", "MERMA");
    expect(ent.sql).toMatch(/"stock" \+ /);
    expect(ent.params).toContain("2.000");
    const sal = await run("SALIDA", "MERMA");
    expect(sal.sql).toMatch(/"stock" - /);
    expect(sal.params).toContain("2.000");
    const aj = await run("AJUSTE", "AJUSTE_MANUAL");
    expect(aj.sql).not.toContain("stock");
    expect(aj.params).toContain("2.000");
  });

  it("ENTRADA/COMPRA sin costoUnitario no toca el costo", async () => {
    const { tx, calls } = fakeTx({ stock: "5.000", stockMinimo: "0", costoPromedio: "3.0000", nombre: "X" });
    await aplicarMovimiento(tx, { ...base, tipo: "ENTRADA", motivo: "COMPRA", cantidad: 2 });
    expect(calls.filter(c => c.op === "update")).toHaveLength(1);
  });

  it("ENTRADA con motivo distinto de COMPRA no toca el costo", async () => {
    const { tx, calls } = fakeTx({ stock: "5.000", stockMinimo: "0", costoPromedio: "3.0000", nombre: "X" });
    await aplicarMovimiento(tx, { ...base, tipo: "ENTRADA", motivo: "ANULACION", cantidad: 2, costoUnitario: 9 });
    expect(calls.filter(c => c.op === "update")).toHaveLength(1);
  });

  describe("validacion de entradas", () => {
    const row = { stock: "1.000", stockMinimo: "0", costoPromedio: "0", nombre: "X" };
    const casos: [string, any][] = [
      ["NaN", { tipo: "ENTRADA", motivo: "COMPRA", cantidad: NaN }],
      ["negativa", { tipo: "SALIDA", motivo: "MERMA", cantidad: -2 }],
      ["redondea a cero", { tipo: "SALIDA", motivo: "MERMA", cantidad: 0.0001 }],
      ["costoUnitario NaN", { tipo: "ENTRADA", motivo: "COMPRA", cantidad: 1, costoUnitario: NaN }],
      ["costoUnitario negativo", { tipo: "ENTRADA", motivo: "COMPRA", cantidad: 1, costoUnitario: -1 }],
    ];
    for (const [nombre, m] of casos) {
      it(`rechaza ${nombre} sin tocar la tx`, async () => {
        const { tx, calls } = fakeTx(row);
        await expect(aplicarMovimiento(tx, { ...base, ...m })).rejects.toThrow();
        expect(calls).toHaveLength(0);
      });
    }
  });
});
