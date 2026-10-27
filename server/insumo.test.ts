import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { publish } from "./lib/events";
import { aplicarMovimiento, armarKardex } from "./lib/inventario";

vi.mock("./db", () => ({
  getEmpleadoById: vi.fn(),
  getInsumosByEmpresa: vi.fn().mockResolvedValue([]),
  getInsumoById: vi.fn(),
  buscarInsumoPorCodigo: vi.fn(),
  findInsumoDuplicado: vi.fn().mockResolvedValue(undefined),
  createInsumo: vi.fn().mockResolvedValue(7),
  updateInsumo: vi.fn().mockResolvedValue(undefined),
  desactivarInsumo: vi.fn().mockResolvedValue(undefined),
  getKardexRows: vi.fn(),
  runInTransaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})),
}));
vi.mock("./lib/events", () => ({ publish: vi.fn() }));
vi.mock("./lib/inventario", async importOriginal => ({
  ...(await importOriginal<typeof import("./lib/inventario")>()),
  aplicarMovimiento: vi.fn(),
}));

const caller = () =>
  appRouter.createCaller({
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  });

const emp = (userRole: string, empresaId = 1) => ({ id: 3, empresaId, userRole });
const insumo = (o: object = {}) => ({
  id: 7, empresaId: 1, nombre: "Arroz", codigo: "ARR", codigoBarras: "775", unidad: "KG",
  stock: "5.000", stockMinimo: "2.000", costoPromedio: "3.0000", activo: true, ...o,
});
const nuevo = { empresaId: 1, nombre: "Arroz", codigo: "ARR", codigoBarras: "775", unidad: "KG" as const, stockMinimo: 2, empleadoId: 3 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getEmpleadoById).mockResolvedValue(emp("CAJERO") as any);
  vi.mocked(db.findInsumoDuplicado).mockResolvedValue(undefined);
  vi.mocked(db.getInsumoById).mockResolvedValue(insumo() as any);
  vi.mocked(aplicarMovimiento).mockResolvedValue({ saldoDespues: "15.000", bajo: false, agotado: false, nombre: "Arroz" });
});

describe("roles", () => {
  it.each([
    ["create", () => caller().insumo.create(nuevo)],
    ["registrarIngreso", () => caller().insumo.registrarIngreso({ empresaId: 1, insumoId: 7, cantidad: 10, empleadoId: 3 })],
    ["registrarMerma", () => caller().insumo.registrarMerma({ empresaId: 1, insumoId: 7, cantidad: 1, motivo: "MERMA", empleadoId: 3 })],
    ["ajustar", () => caller().insumo.ajustar({ empresaId: 1, insumoId: 7, nuevoSaldo: 3, empleadoId: 3 })],
    ["update", () => caller().insumo.update({ id: 7, empresaId: 1, nombre: "X", empleadoId: 3 })],
    ["delete", () => caller().insumo.delete({ id: 7, empresaId: 1, empleadoId: 3 })],
  ])("%s con MOZO -> FORBIDDEN", async (_n, run) => {
    vi.mocked(db.getEmpleadoById).mockResolvedValue(emp("MOZO") as any);
    await expect(run()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.createInsumo).not.toHaveBeenCalled();
    expect(db.updateInsumo).not.toHaveBeenCalled();
    expect(db.desactivarInsumo).not.toHaveBeenCalled();
    expect(aplicarMovimiento).not.toHaveBeenCalled();
  });

  it.each([
    ["create", () => caller().insumo.create(nuevo)],
    ["update", () => caller().insumo.update({ id: 7, empresaId: 1, nombre: "X", empleadoId: 3 })],
    ["delete", () => caller().insumo.delete({ id: 7, empresaId: 1, empleadoId: 3 })],
    ["registrarIngreso", () => caller().insumo.registrarIngreso({ empresaId: 1, insumoId: 7, cantidad: 10, empleadoId: 3 })],
  ])("%s con empleado de otra empresa -> FORBIDDEN", async (_n, run) => {
    vi.mocked(db.getEmpleadoById).mockResolvedValue(emp("DUENO", 2) as any);
    await expect(run()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.createInsumo).not.toHaveBeenCalled();
    expect(db.updateInsumo).not.toHaveBeenCalled();
    expect(db.desactivarInsumo).not.toHaveBeenCalled();
    expect(aplicarMovimiento).not.toHaveBeenCalled();
  });

  it("empleado de otra empresa -> FORBIDDEN", async () => {
    vi.mocked(db.getEmpleadoById).mockResolvedValue(emp("DUENO", 2) as any);
    await expect(caller().insumo.ajustar({ empresaId: 1, insumoId: 7, nuevoSaldo: 3, empleadoId: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("empleado inexistente -> FORBIDDEN", async () => {
    vi.mocked(db.getEmpleadoById).mockResolvedValue(undefined);
    await expect(caller().insumo.create(nuevo)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it.each(["CAJERO", "DUENO", "ADMIN"])("%s puede ingresar y crear", async rol => {
    vi.mocked(db.getEmpleadoById).mockResolvedValue(emp(rol) as any);
    await expect(caller().insumo.registrarIngreso({ empresaId: 1, insumoId: 7, cantidad: 10, empleadoId: 3 })).resolves.toBeTruthy();
    await expect(caller().insumo.create(nuevo)).resolves.toMatchObject({ insumoId: 7 });
  });
});

describe("create", () => {
  it("rechaza codigo o codigoBarras duplicado", async () => {
    vi.mocked(db.findInsumoDuplicado).mockResolvedValue(insumo() as any);
    await expect(caller().insumo.create(nuevo)).rejects.toThrow(/c[oó]digo/i);
    expect(db.createInsumo).not.toHaveBeenCalled();
  });
});

describe("movimientos", () => {
  it("registrarIngreso usa ENTRADA/AJUSTE_MANUAL y publica insumo_stock", async () => {
    await caller().insumo.registrarIngreso({ empresaId: 1, insumoId: 7, cantidad: 10, costoUnitario: 2, empleadoId: 3 });
    expect(aplicarMovimiento).toHaveBeenCalledWith({}, expect.objectContaining({
      empresaId: 1, insumoId: 7, tipo: "ENTRADA", motivo: "AJUSTE_MANUAL", cantidad: 10, empleadoId: 3,
    }));
    expect(publish).toHaveBeenCalledWith(1, { type: "insumo_stock", insumoId: 7, stock: "15.000", bajo: false });
  });

  it("registrarMerma usa SALIDA/MERMA", async () => {
    await caller().insumo.registrarMerma({ empresaId: 1, insumoId: 7, cantidad: 1, motivo: "MERMA", empleadoId: 3 });
    expect(aplicarMovimiento).toHaveBeenCalledWith({}, expect.objectContaining({ tipo: "SALIDA", motivo: "MERMA", cantidad: 1 }));
  });

  it("ajustar usa AJUSTE con el saldo objetivo", async () => {
    await caller().insumo.ajustar({ empresaId: 1, insumoId: 7, nuevoSaldo: 3, empleadoId: 3 });
    expect(aplicarMovimiento).toHaveBeenCalledWith({}, expect.objectContaining({ tipo: "AJUSTE", motivo: "AJUSTE_MANUAL", cantidad: 3 }));
  });

  it("un fallo de publish no rompe la mutacion", async () => {
    vi.mocked(publish).mockImplementationOnce(() => { throw new Error("sse"); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(caller().insumo.ajustar({ empresaId: 1, insumoId: 7, nuevoSaldo: 3, empleadoId: 3 })).resolves.toBeTruthy();
  });
});

describe("lecturas", () => {
  it("listAgotados devuelve solo stock <= 0 activos", async () => {
    vi.mocked(db.getInsumosByEmpresa).mockResolvedValue([
      insumo({ id: 1, nombre: "A", stock: "0.000" }),
      insumo({ id: 2, nombre: "B", stock: "-1.000" }),
      insumo({ id: 3, nombre: "C", stock: "0.500" }),
      insumo({ id: 4, nombre: "D", stock: "0.000", activo: false }),
    ] as any);
    expect(await caller().insumo.listAgotados({ empresaId: 1 })).toEqual([
      { id: 1, nombre: "A", stock: "0.000" },
      { id: 2, nombre: "B", stock: "-1.000" },
    ]);
  });

  it("buscarPorCodigo devuelve el insumo o null", async () => {
    vi.mocked(db.buscarInsumoPorCodigo).mockResolvedValueOnce(insumo() as any);
    expect(await caller().insumo.buscarPorCodigo({ empresaId: 1, codigo: "775" })).toMatchObject({ id: 7 });
    vi.mocked(db.buscarInsumoPorCodigo).mockResolvedValueOnce(undefined);
    expect(await caller().insumo.buscarPorCodigo({ empresaId: 1, codigo: "zzz" })).toBeNull();
  });

  it("kardex arma filas y saldo inicial desde db", async () => {
    vi.mocked(db.getKardexRows).mockResolvedValue({
      saldoInicial: 10,
      movs: [{ createdAt: new Date("2026-02-02"), tipo: "SALIDA", motivo: "MERMA", cantidad: "4.000", saldoDespues: "6.000", costoUnitario: null, referenciaTipo: null, referenciaId: null }],
    } as any);
    const r = await caller().insumo.kardex({ empresaId: 1, insumoId: 7, desde: new Date("2026-02-01"), hasta: new Date("2026-02-28") });
    expect(r.saldoInicial).toBe("10.000");
    expect(r.filas[0]).toMatchObject({ entrada: "0.000", salida: "4.000", saldo: "6.000" });
  });
});

describe("insumo desactivado", () => {
  it("rechaza movimientos", async () => {
    vi.mocked(db.getInsumoById).mockResolvedValue(insumo({ activo: false }) as any);
    await expect(caller().insumo.registrarIngreso({ empresaId: 1, insumoId: 7, cantidad: 1, empleadoId: 3 })).rejects.toThrow(/desactivado/);
    expect(aplicarMovimiento).not.toHaveBeenCalled();
  });
});

describe("armarKardex", () => {
  it("rango vacio: filas [] y saldoInicial conservado", () => {
    expect(armarKardex(12, [])).toEqual({ saldoInicial: "12.000", filas: [] });
  });
  const mov = (tipo: string, cantidad: string, saldoDespues: string, extra: object = {}) => ({
    createdAt: new Date("2026-02-01"), tipo, motivo: "COMPRA", cantidad, saldoDespues,
    costoUnitario: null, referenciaTipo: null, referenciaId: null, ...extra,
  });
  it("3 movimientos: saldos 10, 6, 8", () => {
    const k = armarKardex(0, [mov("ENTRADA", "10", "10"), mov("SALIDA", "4", "6"), mov("ENTRADA", "2", "8")] as any);
    expect(k.saldoInicial).toBe("0.000");
    expect(k.filas.map(f => f.saldo)).toEqual(["10.000", "6.000", "8.000"]);
    expect(k.filas.map(f => [f.entrada, f.salida])).toEqual([["10.000", "0.000"], ["0.000", "4.000"], ["2.000", "0.000"]]);
  });
  it("saldo inicial al filtrar desde el segundo", () => {
    const k = armarKardex(10, [mov("SALIDA", "4", "6"), mov("ENTRADA", "2", "8")] as any);
    expect(k.saldoInicial).toBe("10.000");
    expect(k.filas.map(f => f.saldo)).toEqual(["6.000", "8.000"]);
  });
  it("AJUSTE deriva entrada/salida de la diferencia, no de cantidad", () => {
    const k = armarKardex(8, [
      mov("AJUSTE", "5", "5", { motivo: "AJUSTE_MANUAL" }),
      mov("AJUSTE", "9", "9", { motivo: "AJUSTE_MANUAL" }),
    ] as any);
    expect(k.filas.map(f => [f.entrada, f.salida])).toEqual([["0.000", "3.000"], ["4.000", "0.000"]]);
  });
  it("referencia y costo", () => {
    const k = armarKardex(0, [mov("ENTRADA", "1", "1", { costoUnitario: "2.5000", referenciaTipo: "COMPRA", referenciaId: 9 })] as any);
    expect(k.filas[0]).toMatchObject({ costoUnitario: "2.5000", referencia: "COMPRA #9" });
  });
});
