import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { publish } from "./lib/events";

// Mock the database module
vi.mock("./db", () => ({
  getEmpresas: vi.fn().mockResolvedValue([
    { id: 1, nombre: "Restaurante Demo", ruc: "20123456789" }
  ]),
  getEmpleadosByEmpresa: vi.fn().mockResolvedValue([
    { id: 1, empresaId: 1, nombre: "Carlos", apellido: "Rodríguez", pin: "1234", userRole: "MOZO" },
    { id: 2, empresaId: 1, nombre: "Juan", apellido: "López", pin: "3456", userRole: "CAJERO" }
  ]),
  getEmpleadoByPin: vi.fn().mockImplementation((empresaId: number, pin: string) => {
    if (pin === "1234") {
      return Promise.resolve({ id: 1, empresaId: 1, nombre: "Carlos", apellido: "Rodríguez", pin: "1234", userRole: "MOZO" });
    }
    return Promise.resolve(undefined);
  }),
  getMesasByEmpresa: vi.fn().mockResolvedValue([
    { id: 1, empresaId: 1, numero: 1, capacidad: 4, tableStatus: "DISPONIBLE" },
    { id: 2, empresaId: 1, numero: 2, capacidad: 4, tableStatus: "OCUPADA" }
  ]),
  getCategoriasByEmpresa: vi.fn().mockResolvedValue([
    { id: 1, empresaId: 1, nombre: "Entradas" },
    { id: 2, empresaId: 1, nombre: "Platos Fuertes" }
  ]),
  getProductosByEmpresa: vi.fn().mockResolvedValue([
    { id: 1, empresaId: 1, categoriaId: 1, nombre: "Ceviche", precio: "35.00", stock: 50 }
  ]),
  getVentasTotales: vi.fn().mockResolvedValue({ total: "1500.00", count: 25 }),
  getProductosMasVendidos: vi.fn().mockResolvedValue([
    { productoId: 1, nombre: "Ceviche", cantidadVendida: 50, totalVendido: "1750.00" }
  ]),
  getRendimientoMozos: vi.fn().mockResolvedValue([
    { mozoId: 1, nombre: "Carlos", apellido: "Rodríguez", totalPedidos: 15, mesasAtendidas: 10, totalVentas: "800.00", ticketPromedio: "53.33" }
  ]),
  getPedidosActivos: vi.fn().mockResolvedValue([]),
  getVentasPorHora: vi.fn().mockResolvedValue([]),
  getVentasPorCategoria: vi.fn().mockResolvedValue([]),
  addItemPedido: vi.fn().mockResolvedValue(77),
  updateProductoStock: vi.fn().mockResolvedValue(undefined),
  getPedidoById: vi.fn().mockResolvedValue({ id: 9, empresaId: 1, mesaId: 1, mozoId: 1 }),
  getProductoById: vi.fn().mockResolvedValue({ id: 1, categoriaId: 2 }),
  getCategoriaById: vi.fn().mockResolvedValue({ id: 2, area: "BAR" }),
  updateItemEstado: vi.fn().mockResolvedValue(undefined),
  getItemContext: vi.fn().mockResolvedValue({ empresaId: 1, mozoId: 1, mesaNumero: 3 }),
}));

vi.mock("./lib/events", () => ({
  publish: vi.fn(),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("POS System - Empresas", () => {
  it("should list all empresas", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const empresas = await caller.empresa.list();
    
    expect(empresas).toBeDefined();
    expect(Array.isArray(empresas)).toBe(true);
    expect(empresas.length).toBeGreaterThan(0);
    expect(empresas[0]).toHaveProperty("nombre");
  });
});

describe("POS System - Empleados", () => {
  it("should list empleados by empresa", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const empleados = await caller.empleado.listByEmpresa({ empresaId: 1 });
    
    expect(empleados).toBeDefined();
    expect(Array.isArray(empleados)).toBe(true);
  });

  it("should authenticate empleado with correct PIN", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.empleado.loginByPin({ empresaId: 1, pin: "1234" });
    
    expect(result.success).toBe(true);
    expect(result.empleado).toBeDefined();
    expect(result.empleado?.nombre).toBe("Carlos");
  });

  it("should reject empleado with incorrect PIN", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.empleado.loginByPin({ empresaId: 1, pin: "9999" });
    
    expect(result.success).toBe(false);
    expect(result.empleado).toBeUndefined();
  });
});

describe("POS System - Mesas", () => {
  it("should list mesas by empresa", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const mesas = await caller.mesa.listByEmpresa({ empresaId: 1 });
    
    expect(mesas).toBeDefined();
    expect(Array.isArray(mesas)).toBe(true);
  });
});

describe("POS System - Categorías", () => {
  it("should list categorias by empresa", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const categorias = await caller.categoria.listByEmpresa({ empresaId: 1 });
    
    expect(categorias).toBeDefined();
    expect(Array.isArray(categorias)).toBe(true);
  });
});

describe("POS System - Productos", () => {
  it("should list productos by empresa", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const productos = await caller.producto.listByEmpresa({ empresaId: 1 });
    
    expect(productos).toBeDefined();
    expect(Array.isArray(productos)).toBe(true);
  });
});

describe("POS System - Analytics", () => {
  it("should get ventas totales", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const ventas = await caller.analytics.ventasTotales({ empresaId: 1 });
    
    expect(ventas).toBeDefined();
    expect(ventas).toHaveProperty("total");
    expect(ventas).toHaveProperty("count");
  });

  it("should get productos mas vendidos", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const productos = await caller.analytics.productosMasVendidos({ empresaId: 1, limit: 5 });
    
    expect(productos).toBeDefined();
    expect(Array.isArray(productos)).toBe(true);
  });

  it("should get rendimiento mozos", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const rendimiento = await caller.analytics.rendimientoMozos({ empresaId: 1 });
    
    expect(rendimiento).toBeDefined();
    expect(Array.isArray(rendimiento)).toBe(true);
  });
});

describe("Realtime notifications", () => {
  beforeEach(() => {
    vi.mocked(publish).mockClear();
  });

  it("publishes item_listo when an item becomes LISTO", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await caller.itemPedido.updateStatus({ id: 5, estado: "LISTO" });
    expect(publish).toHaveBeenCalledWith(1, { type: "item_listo", mozoId: 1, itemId: 5, mesaNumero: 3 });
  });

  it("does not publish for PREPARANDO", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await caller.itemPedido.updateStatus({ id: 5, estado: "PREPARANDO" });
    expect(publish).not.toHaveBeenCalled();
  });

  it("publishes comanda_nueva with the category area on add", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await caller.itemPedido.add({
      pedidoId: 9, productoId: 1, cantidad: 1, precioUnitario: "10.00", subtotal: "10.00",
    });
    expect(publish).toHaveBeenCalledWith(1, { type: "comanda_nueva", area: "BAR", pedidoId: 9 });
  });

  it("still succeeds when publishing context lookup fails", async () => {
    vi.mocked(db.getItemContext).mockRejectedValueOnce(new Error("boom"));
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.itemPedido.updateStatus({ id: 5, estado: "LISTO" })).resolves.toEqual({ success: true });
    expect(publish).not.toHaveBeenCalled();
  });
});
