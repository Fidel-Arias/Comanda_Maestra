import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { publish } from "./lib/events";
import { aplicarMovimiento } from "./lib/inventario";
import { subtotalCents } from "./lib/compras";

vi.mock("./db", () => ({
  getEmpleadoById: vi.fn(),
  getInsumoById: vi.fn(),
  insertCompra: vi.fn().mockResolvedValue(99),
  insertCompraItems: vi.fn().mockResolvedValue(undefined),
  getComprasByEmpresa: vi.fn(),
  getCompraById: vi.fn(),
  getGastoRows: vi.fn(),
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

const insumo = (o: object = {}) => ({ id: 7, empresaId: 1, nombre: "Arroz", activo: true, ...o });
const base = { empresaId: 1, empleadoId: 3, fecha: "2026-10-27" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getEmpleadoById).mockResolvedValue({ id: 3, empresaId: 1, userRole: "CAJERO" } as any);
  vi.mocked(db.getInsumoById).mockImplementation(async (id: number) => insumo({ id }) as any);
  vi.mocked(aplicarMovimiento).mockResolvedValue({ saldoDespues: "15.000", bajo: false, agotado: false, nombre: "Arroz" });
});

describe("subtotalCents", () => {
  it.each([
    [3, 0.1, 30],
    [1, 0.005, 1],
    [0.333, 0.3333, 11],
    [1.005, 1, 101],
    [2, 19.99, 3998],
  ])("%s x %s = %s centimos", (c, k, esperado) => expect(subtotalCents(c, k)).toBe(esperado));
});

describe("compra.create", () => {
  it("2 items: aplica 2 movimientos ENTRADA/COMPRA ordenados por insumoId y guarda total del servidor", async () => {
    const r = await caller().compra.create({
      ...base,
      proveedor: "Prov",
      items: [{ insumoId: 9, cantidad: 3, costoUnitario: 0.1 }, { insumoId: 7, cantidad: 2, costoUnitario: 1.005 }],
    });
    expect(r).toMatchObject({ success: true, compraId: 99, total: "2.31" });
    expect(db.insertCompra).toHaveBeenCalledWith({}, expect.objectContaining({ empresaId: 1, empleadoId: 3, total: "2.31", fecha: "2026-10-27" }));
    expect(db.insertCompraItems).toHaveBeenCalledWith({}, [
      { compraId: 99, insumoId: 7, cantidad: "2.000", costoUnitario: "1.0050", subtotal: "2.01" },
      { compraId: 99, insumoId: 9, cantidad: "3.000", costoUnitario: "0.1000", subtotal: "0.30" },
    ]);
    expect(aplicarMovimiento).toHaveBeenCalledTimes(2);
    expect(vi.mocked(aplicarMovimiento).mock.calls.map(c => c[1].insumoId)).toEqual([7, 9]);
    expect(aplicarMovimiento).toHaveBeenCalledWith({}, expect.objectContaining({
      empresaId: 1, tipo: "ENTRADA", motivo: "COMPRA", referenciaTipo: "COMPRA", referenciaId: 99,
      empleadoId: 3, cantidad: 2, costoUnitario: 1.005,
    }));
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith(1, { type: "insumo_stock", insumoId: 7, stock: "15.000", bajo: false });
  });

  it("ignora un total enviado por el cliente", async () => {
    await caller().compra.create({ ...base, items: [{ insumoId: 7, cantidad: 1, costoUnitario: 2 }], total: 1 } as any);
    expect(db.insertCompra).toHaveBeenCalledWith({}, expect.objectContaining({ total: "2.00" }));
  });

  it("items vacios -> error", async () => {
    await expect(caller().compra.create({ ...base, items: [] })).rejects.toThrow();
    expect(db.insertCompra).not.toHaveBeenCalled();
  });

  it.each([0, -1])("cantidad %s -> error", async cantidad => {
    await expect(caller().compra.create({ ...base, items: [{ insumoId: 7, cantidad, costoUnitario: 1 }] })).rejects.toThrow();
    expect(aplicarMovimiento).not.toHaveBeenCalled();
  });

  it("insumoId duplicado -> BAD_REQUEST", async () => {
    await expect(caller().compra.create({
      ...base, items: [{ insumoId: 7, cantidad: 1, costoUnitario: 1 }, { insumoId: 7, cantidad: 2, costoUnitario: 1 }],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.insertCompra).not.toHaveBeenCalled();
  });

  it("MOZO -> FORBIDDEN", async () => {
    vi.mocked(db.getEmpleadoById).mockResolvedValue({ id: 3, empresaId: 1, userRole: "MOZO" } as any);
    await expect(caller().compra.create({ ...base, items: [{ insumoId: 7, cantidad: 1, costoUnitario: 1 }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.insertCompra).not.toHaveBeenCalled();
  });

  it("insumo desactivado o inexistente -> error sin escribir", async () => {
    vi.mocked(db.getInsumoById).mockResolvedValueOnce(insumo({ activo: false }) as any);
    await expect(caller().compra.create({ ...base, items: [{ insumoId: 7, cantidad: 1, costoUnitario: 1 }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    vi.mocked(db.getInsumoById).mockResolvedValueOnce(undefined);
    await expect(caller().compra.create({ ...base, items: [{ insumoId: 7, cantidad: 1, costoUnitario: 1 }] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.insertCompra).not.toHaveBeenCalled();
  });

  it("un fallo de publish no rompe la compra", async () => {
    vi.mocked(publish).mockImplementation(() => { throw new Error("sse"); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(caller().compra.create({ ...base, items: [{ insumoId: 7, cantidad: 1, costoUnitario: 1 }] })).resolves.toMatchObject({ success: true });
    vi.mocked(publish).mockReset();
  });
});

describe("compra.gastos", () => {
  it("agrega por dia e insumo", async () => {
    vi.mocked(db.getGastoRows).mockResolvedValue([
      { fecha: "2026-10-01", insumoId: 7, nombre: "Arroz", subtotal: "0.10" },
      { fecha: "2026-10-01", insumoId: 9, nombre: "Sal", subtotal: "0.20" },
      { fecha: "2026-10-02", insumoId: 7, nombre: "Arroz", subtotal: "10.05" },
    ]);
    const r = await caller().compra.gastos({ empresaId: 1, desde: "2026-10-01", hasta: "2026-10-31" });
    expect(r).toEqual({
      total: "10.35",
      porDia: [{ fecha: "2026-10-01", total: "0.30" }, { fecha: "2026-10-02", total: "10.05" }],
      porInsumo: [{ insumoId: 7, nombre: "Arroz", total: "10.15" }, { insumoId: 9, nombre: "Sal", total: "0.20" }],
    });
    expect(db.getGastoRows).toHaveBeenCalledWith(1, "2026-10-01", "2026-10-31");
  });
});
