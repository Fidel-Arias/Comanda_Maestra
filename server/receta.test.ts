import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

vi.mock("./db", () => ({
  getEmpleadoById: vi.fn(),
  getProductoById: vi.fn(),
  getInsumoById: vi.fn(),
  getRecetaByProducto: vi.fn(),
  deleteRecetaProducto: vi.fn().mockResolvedValue(undefined),
  insertRecetaItems: vi.fn().mockResolvedValue(undefined),
  runInTransaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})),
}));

const caller = () =>
  appRouter.createCaller({
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  });

const base = { empresaId: 1, empleadoId: 3, productoId: 5 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getEmpleadoById).mockResolvedValue({ id: 3, empresaId: 1, userRole: "CAJERO" } as any);
  vi.mocked(db.getProductoById).mockResolvedValue({ id: 5, empresaId: 1 } as any);
  vi.mocked(db.getInsumoById).mockImplementation(async (id: number) => ({ id, empresaId: 1, nombre: "Arroz", activo: true }) as any);
});

const noWrites = () => {
  expect(db.runInTransaction).not.toHaveBeenCalled();
  expect(db.deleteRecetaProducto).not.toHaveBeenCalled();
  expect(db.insertRecetaItems).not.toHaveBeenCalled();
};

describe("receta.save", () => {
  it("reemplaza: borra y luego inserta con 3 decimales", async () => {
    await caller().receta.save({ ...base, items: [{ insumoId: 7, cantidad: 0.25 }, { insumoId: 8, cantidad: 1.23456 }] });
    expect(db.deleteRecetaProducto).toHaveBeenCalledWith({}, 5, 1);
    expect(db.insertRecetaItems).toHaveBeenCalledWith({}, [
      { empresaId: 1, productoId: 5, insumoId: 7, cantidad: "0.250" },
      { empresaId: 1, productoId: 5, insumoId: 8, cantidad: "1.235" },
    ]);
  });

  it("insumo repetido -> error sin escrituras", async () => {
    await expect(caller().receta.save({ ...base, items: [{ insumoId: 7, cantidad: 1 }, { insumoId: 7, cantidad: 2 }] })).rejects.toThrow(/repetido/i);
    noWrites();
  });

  it("items [] borra la receta y no inserta", async () => {
    await caller().receta.save({ ...base, items: [] });
    expect(db.deleteRecetaProducto).toHaveBeenCalledWith({}, 5, 1);
    expect(db.insertRecetaItems).not.toHaveBeenCalled();
  });

  it("MOZO -> FORBIDDEN sin escrituras", async () => {
    vi.mocked(db.getEmpleadoById).mockResolvedValue({ id: 3, empresaId: 1, userRole: "MOZO" } as any);
    await expect(caller().receta.save({ ...base, items: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    noWrites();
  });

  it("producto de otra empresa -> NOT_FOUND sin escrituras", async () => {
    vi.mocked(db.getProductoById).mockResolvedValue({ id: 5, empresaId: 2 } as any);
    await expect(caller().receta.save({ ...base, items: [] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    noWrites();
  });

  it("insumo de otra empresa (no encontrado) -> NOT_FOUND sin escrituras", async () => {
    vi.mocked(db.getInsumoById).mockResolvedValue(undefined as any);
    await expect(caller().receta.save({ ...base, items: [{ insumoId: 7, cantidad: 1 }] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    noWrites();
  });

  it("insumo inactivo -> BAD_REQUEST", async () => {
    vi.mocked(db.getInsumoById).mockResolvedValue({ id: 7, empresaId: 1, nombre: "X", activo: false } as any);
    await expect(caller().receta.save({ ...base, items: [{ insumoId: 7, cantidad: 1 }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    noWrites();
  });

  it.each([0, -1, 0.0004, NaN, Infinity])("cantidad %s rechazada", async c => {
    await expect(caller().receta.save({ ...base, items: [{ insumoId: 7, cantidad: c }] })).rejects.toThrow();
    noWrites();
  });
});

describe("receta.getByProducto", () => {
  it("devuelve nombre y unidad", async () => {
    const rows = [{ insumoId: 7, nombre: "Arroz", unidad: "KG", cantidad: "0.250" }];
    vi.mocked(db.getRecetaByProducto).mockResolvedValue(rows as any);
    expect(await caller().receta.getByProducto({ empresaId: 1, productoId: 5 })).toEqual(rows);
    expect(db.getRecetaByProducto).toHaveBeenCalledWith(5, 1);
  });
});
