import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { publish, throttle } from "./lib/events";
import { porcionesDisponibles } from "./lib/inventario";

vi.mock("./db", () => ({
  runInTransaction: vi.fn(),
  addItemPedido: vi.fn(),
  deleteItem: vi.fn(),
  getItemParaActualizar: vi.fn(),
  updateItemCantidad: vi.fn(),
  cancelarPedido: vi.fn(),
  deletePedido: vi.fn(),
  ajustarStockInsumo: vi.fn(),
  insertMovimientoInventario: vi.fn(),
  getMovimientosItems: vi.fn(),
  getRecetasByProductos: vi.fn(),
  getInsumoById: vi.fn(),
  getInsumosByEmpresa: vi.fn(),
  getProductosByEmpresa: vi.fn(),
  getPedidoById: vi.fn(),
  getItemContext: vi.fn(),
  getMesaById: vi.fn(),
  getProductoById: vi.fn(),
  getCategoriaById: vi.fn(),
  updateProductoStock: vi.fn(),
  updatePedidoEstado: vi.fn(),
}));
vi.mock("./lib/events", async importOriginal => ({
  ...(await importOriginal<typeof import("./lib/events")>()),
  publish: vi.fn(),
}));

// ---- Base de datos en memoria. La transaccion falsa descarta todo lo escrito si el callback lanza. ----
type Insumo = { id: number; empresaId: number; nombre: string; stock: number; stockMinimo: number; activo: boolean };
type Item = { id: number; pedidoId: number; productoId: number; cantidad: number; estado: string };
type Mov = { insumoId: number; tipo: string; motivo: string; cantidad: string; referenciaTipo: string | null; referenciaId: number | null; empleadoId: number | null };
type Store = { insumos: Insumo[]; items: Item[]; movs: Mov[]; estadoPedido: string; nextId: number };

let s: Store;
let recetas: { productoId: number; insumoId: number; cantidad: string }[];
let enTx = false;
let rollbacks = 0;
const TX = { fake: "tx" };
const soloEnTx = (tx: unknown) => {
  if (tx !== TX || !enTx) throw new Error("escritura fuera de la transaccion");
};
const r3 = (n: number) => Number(n.toFixed(3));
const insumo = (id: number, stock: number, o: Partial<Insumo> = {}): Insumo =>
  ({ id, empresaId: 1, nombre: `Insumo${id}`, stock, stockMinimo: 1, activo: true, ...o });
const stock = (id: number) => s.insumos.find(i => i.id === id)!.stock;

const caller = () =>
  appRouter.createCaller({
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  });
const add = (productoId: number, cantidad: number) =>
  caller().itemPedido.add({ pedidoId: 9, productoId, cantidad, precioUnitario: "10.00", subtotal: (10 * cantidad).toFixed(2) });
const publicados = () => vi.mocked(publish).mock.calls.map(c => c[1]);
const deTipo = (type: string) => publicados().filter(e => e.type === type);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  s = { insumos: [insumo(1, 10), insumo(2, 10)], items: [], movs: [], estadoPedido: "PENDIENTE", nextId: 100 };
  recetas = [];
  rollbacks = 0;
  const m = vi.mocked;
  m(db.runInTransaction).mockImplementation(async (fn: any) => {
    const snap = structuredClone(s);
    enTx = true;
    try {
      return await fn(TX);
    } catch (e) {
      s = snap;
      rollbacks++;
      throw e;
    } finally {
      enTx = false;
    }
  });
  m(db.addItemPedido).mockImplementation(async (tx: any, data: any) => {
    soloEnTx(tx);
    const id = s.nextId++;
    s.items.push({ id, estado: "PENDIENTE", pedidoId: data.pedidoId, productoId: data.productoId, cantidad: data.cantidad });
    return id;
  });
  m(db.deleteItem).mockImplementation(async (tx: any, id: number) => {
    soloEnTx(tx);
    const it = s.items.find(i => i.id === id);
    s.items = s.items.filter(i => i.id !== id);
    return it as any;
  });
  m(db.getItemParaActualizar).mockImplementation(async (tx: any, id: number) => {
    soloEnTx(tx);
    const it = s.items.find(i => i.id === id);
    return (it && { ...it }) as any;
  });
  m(db.updateItemCantidad).mockImplementation(async (tx: any, id: number, cantidad: number) => {
    soloEnTx(tx);
    s.items.find(i => i.id === id)!.cantidad = cantidad;
  });
  m(db.cancelarPedido).mockImplementation(async (tx: any, id: number) => {
    soloEnTx(tx);
    s.estadoPedido = "CANCELADO";
    return { empresaId: 1, items: s.items.filter(i => i.pedidoId === id) } as any;
  });
  m(db.deletePedido).mockImplementation(async (tx: any, id: number) => {
    soloEnTx(tx);
    const items = s.items.filter(i => i.pedidoId === id);
    s.items = s.items.filter(i => i.pedidoId !== id);
    return { empresaId: 1, items } as any;
  });
  m(db.ajustarStockInsumo).mockImplementation(async (tx: any, empresaId: number, insumoId: number, delta: number) => {
    soloEnTx(tx);
    const i = s.insumos.find(x => x.id === insumoId && x.empresaId === empresaId);
    if (!i || (delta < 0 && (!i.activo || i.stock < -delta))) return undefined;
    i.stock = r3(i.stock + delta);
    return { stock: i.stock.toFixed(3), stockMinimo: i.stockMinimo.toFixed(3), nombre: i.nombre };
  });
  m(db.insertMovimientoInventario).mockImplementation(async (tx: any, row: any) => {
    soloEnTx(tx);
    s.movs.push(row);
  });
  m(db.getMovimientosItems).mockImplementation(async (tx: any, _empresaId: number, ids: number[]) => {
    soloEnTx(tx);
    return s.movs.filter(x => x.referenciaTipo === "ITEM_PEDIDO" && ids.includes(x.referenciaId!)) as any;
  });
  m(db.getRecetasByProductos).mockImplementation(async (ids: number[]) => recetas.filter(r => ids.includes(r.productoId)));
  m(db.getInsumoById).mockImplementation(async (id: number) => s.insumos.find(i => i.id === id) as any);
  m(db.getInsumosByEmpresa).mockImplementation(async () =>
    s.insumos.filter(i => i.activo).map(i => ({ ...i, stock: i.stock.toFixed(3) })) as any);
  m(db.getProductosByEmpresa).mockResolvedValue([{ id: 5 }, { id: 6 }, { id: 7 }] as any);
  m(db.getPedidoById).mockResolvedValue({ id: 9, empresaId: 1, mesaId: 4, mozoId: 3 } as any);
  m(db.getItemContext).mockResolvedValue({ empresaId: 1, mozoId: 3, mesaNumero: 12 });
  m(db.getMesaById).mockResolvedValue({ id: 4, numero: 12 } as any);
  m(db.getProductoById).mockResolvedValue({ id: 5, categoriaId: 2 } as any);
  m(db.getCategoriaById).mockResolvedValue({ id: 2, area: "COCINA" } as any);
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("itemPedido.add: descuento con bloqueo", () => {
  it("stock 0 -> PRECONDITION_FAILED, nada se persiste, publica insumo_agotado y no insumo_stock", async () => {
    s.insumos = [insumo(1, 0, { nombre: "Pollo" })];
    recetas = [{ productoId: 5, insumoId: 1, cantidad: "1" }];
    await expect(add(5, 1)).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "Sin stock de Pollo" });
    expect(rollbacks).toBe(1);
    expect(s.items).toEqual([]);
    expect(s.movs).toEqual([]);
    expect(deTipo("insumo_stock")).toEqual([]);
    expect(deTipo("comanda_nueva")).toEqual([]);
    expect(publish).toHaveBeenCalledWith(1, { type: "insumo_agotado", insumoId: 1, nombre: "Pollo", mesaNumero: 12 });
    expect(db.updateProductoStock).not.toHaveBeenCalled();
  });

  it("stock 5: pedir 6 se rechaza; pedir 5 exacto se acepta y deja 0 (avisa agotado)", async () => {
    s.insumos = [insumo(1, 5)];
    recetas = [{ productoId: 5, insumoId: 1, cantidad: "1" }];
    await expect(add(5, 6)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(stock(1)).toBe(5);
    vi.mocked(publish).mockClear();

    await expect(add(5, 5)).resolves.toMatchObject({ success: true });
    expect(stock(1)).toBe(0);
    expect(s.items).toHaveLength(1);
    expect(publicados()).toEqual(expect.arrayContaining([
      { type: "insumo_stock", insumoId: 1, stock: "0.000", bajo: true },
      { type: "insumo_agotado", insumoId: 1, nombre: "Insumo1", mesaNumero: 12 },
    ]));
  });

  it("receta [{1,0.2},{2,1}] x 3 -> salidas 0.6 y 3 en orden de insumoId, tras el commit publica stock y comanda", async () => {
    recetas = [{ productoId: 5, insumoId: 2, cantidad: "1" }, { productoId: 5, insumoId: 1, cantidad: "0.2" }];
    const r = await add(5, 3);
    expect(s.movs).toEqual([
      { empresaId: 1, insumoId: 1, tipo: "SALIDA", motivo: "CONSUMO_PEDIDO", cantidad: "0.600", saldoDespues: "9.400", referenciaTipo: "ITEM_PEDIDO", referenciaId: r.itemId, empleadoId: 3 },
      { empresaId: 1, insumoId: 2, tipo: "SALIDA", motivo: "CONSUMO_PEDIDO", cantidad: "3.000", saldoDespues: "7.000", referenciaTipo: "ITEM_PEDIDO", referenciaId: r.itemId, empleadoId: 3 },
    ]);
    expect(vi.mocked(db.ajustarStockInsumo).mock.calls.map(c => c[2])).toEqual([1, 2]);
    expect(deTipo("insumo_stock")).toEqual([
      { type: "insumo_stock", insumoId: 1, stock: "9.400", bajo: false },
      { type: "insumo_stock", insumoId: 2, stock: "7.000", bajo: false },
    ]);
    expect(deTipo("insumo_agotado")).toEqual([]);
    expect(deTipo("comanda_nueva")).toEqual([{ type: "comanda_nueva", area: "COCINA", pedidoId: 9 }]);
    expect(db.updateProductoStock).toHaveBeenCalledWith(5, 3);
  });

  it("producto sin receta -> sin movimientos ni bloqueo", async () => {
    s.insumos = [insumo(1, 0)];
    await expect(add(6, 4)).resolves.toMatchObject({ success: true });
    expect(s.items).toHaveLength(1);
    expect(s.movs).toEqual([]);
    expect(db.ajustarStockInsumo).not.toHaveBeenCalled();
  });

  it("falla el segundo insumo -> se revierte el descuento del primero y el item", async () => {
    s.insumos = [insumo(1, 10), insumo(2, 1, { nombre: "Limon" })];
    recetas = [{ productoId: 5, insumoId: 1, cantidad: "1" }, { productoId: 5, insumoId: 2, cantidad: "1" }];
    await expect(add(5, 2)).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "Sin stock de Limon" });
    expect(vi.mocked(db.ajustarStockInsumo).mock.calls.map(c => c[2])).toEqual([1, 2]);
    expect(stock(1)).toBe(10);
    expect(s.items).toEqual([]);
    expect(s.movs).toEqual([]);
    expect(deTipo("insumo_agotado")).toEqual([{ type: "insumo_agotado", insumoId: 2, nombre: "Limon", mesaNumero: 12 }]);
  });

  it("insumo desactivado bloquea igual que sin stock", async () => {
    s.insumos = [insumo(1, 50, { activo: false, nombre: "Viejo" })];
    recetas = [{ productoId: 5, insumoId: 1, cantidad: "1" }];
    await expect(add(5, 1)).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "Sin stock de Viejo" });
  });

  it("un fallo de publish nunca hace fallar el pedido", async () => {
    vi.mocked(publish).mockImplementation(() => { throw new Error("sse"); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    recetas = [{ productoId: 5, insumoId: 1, cantidad: "1" }];
    await expect(add(5, 1)).resolves.toMatchObject({ success: true });
    s.insumos = [insumo(1, 0)];
    await expect(add(5, 1)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    vi.mocked(publish).mockReset();
  });
});

describe("reposicion al eliminar/cancelar", () => {
  beforeEach(() => {
    recetas = [{ productoId: 5, insumoId: 1, cantidad: "0.2" }, { productoId: 5, insumoId: 2, cantidad: "1" }];
  });

  it("delete repone lo mismo una sola vez", async () => {
    const { itemId } = await add(5, 3);
    vi.mocked(publish).mockClear();
    await caller().itemPedido.delete({ id: itemId });
    expect([stock(1), stock(2)]).toEqual([10, 10]);
    expect(s.movs.filter(x => x.tipo === "ENTRADA")).toEqual([
      expect.objectContaining({ insumoId: 1, motivo: "ANULACION", cantidad: "0.600", referenciaTipo: "ITEM_PEDIDO", referenciaId: itemId }),
      expect.objectContaining({ insumoId: 2, motivo: "ANULACION", cantidad: "3.000", referenciaTipo: "ITEM_PEDIDO", referenciaId: itemId }),
    ]);
    expect(deTipo("insumo_stock")).toEqual([
      { type: "insumo_stock", insumoId: 1, stock: "10.000", bajo: false },
      { type: "insumo_stock", insumoId: 2, stock: "10.000", bajo: false },
    ]);
    await caller().itemPedido.delete({ id: itemId });
    await caller().pedido.updateEstado({ id: 9, estado: "CANCELADO" });
    expect(s.movs).toHaveLength(4);
    expect([stock(1), stock(2)]).toEqual([10, 10]);
  });

  it("cancelar repone todos los items no cancelados una sola vez", async () => {
    await add(5, 1);
    await add(5, 2);
    const { itemId: yaCancelado } = await add(5, 4);
    s.items.find(i => i.id === yaCancelado)!.estado = "CANCELADO";
    expect([stock(1), stock(2)]).toEqual([8.6, 3]);

    await caller().pedido.updateEstado({ id: 9, estado: "CANCELADO" });
    expect([stock(1), stock(2)]).toEqual([9.2, 6]);
    expect(s.estadoPedido).toBe("CANCELADO");
    const entradas = s.movs.filter(x => x.tipo === "ENTRADA").length;
    expect(entradas).toBe(4);
    // Insumos procesados en orden global de insumoId (evita deadlocks)
    expect(vi.mocked(db.ajustarStockInsumo).mock.calls.filter(c => c[3] > 0).map(c => c[2])).toEqual([1, 1, 2, 2]);

    await caller().pedido.updateEstado({ id: 9, estado: "CANCELADO" });
    expect(s.movs.filter(x => x.tipo === "ENTRADA")).toHaveLength(entradas);
    expect([stock(1), stock(2)]).toEqual([9.2, 6]);
  });

  it("anular (pedido.delete) repone el stock de sus items", async () => {
    await add(5, 3);
    await caller().pedido.delete({ id: 9 });
    expect([stock(1), stock(2)]).toEqual([10, 10]);
    expect(s.items).toEqual([]);
  });

  it("updateEstado distinto de CANCELADO no toca inventario", async () => {
    await caller().pedido.updateEstado({ id: 9, estado: "PREPARANDO" });
    expect(db.updatePedidoEstado).toHaveBeenCalledWith(9, "PREPARANDO");
    expect(db.runInTransaction).not.toHaveBeenCalled();
  });
});

describe("itemPedido.updateCantidad aplica solo la diferencia", () => {
  beforeEach(() => {
    recetas = [{ productoId: 5, insumoId: 1, cantidad: "1" }];
  });

  it("sube 3->5 descuenta 2; baja 5->2 repone 3", async () => {
    const { itemId } = await add(5, 3);
    await caller().itemPedido.updateCantidad({ id: itemId, cantidad: 5, subtotal: "50.00" });
    expect(stock(1)).toBe(5);
    expect(s.movs.at(-1)).toMatchObject({ tipo: "SALIDA", motivo: "CONSUMO_PEDIDO", cantidad: "2.000", referenciaId: itemId });
    await caller().itemPedido.updateCantidad({ id: itemId, cantidad: 2, subtotal: "20.00" });
    expect(stock(1)).toBe(8);
    expect(s.movs.at(-1)).toMatchObject({ tipo: "ENTRADA", motivo: "ANULACION", cantidad: "3.000", referenciaId: itemId });
    expect(s.items[0].cantidad).toBe(2);
    await caller().itemPedido.delete({ id: itemId });
    expect(stock(1)).toBe(10);
  });

  it("subir sin stock suficiente -> PRECONDITION_FAILED y la cantidad no cambia", async () => {
    s.insumos = [insumo(1, 4, { nombre: "Pan" })];
    const { itemId } = await add(5, 3);
    vi.mocked(publish).mockClear();
    await expect(caller().itemPedido.updateCantidad({ id: itemId, cantidad: 5, subtotal: "50.00" }))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "Sin stock de Pan" });
    expect(s.items[0].cantidad).toBe(3);
    expect(stock(1)).toBe(1);
    expect(deTipo("insumo_agotado")).toHaveLength(1);
  });

  it("item anterior al inventario (sin salidas registradas): bajar no repone nada", async () => {
    s.items.push({ id: 50, pedidoId: 9, productoId: 5, cantidad: 4, estado: "PENDIENTE" });
    await caller().itemPedido.updateCantidad({ id: 50, cantidad: 1, subtotal: "10.00" });
    expect(stock(1)).toBe(10);
    expect(s.movs).toEqual([]);
  });
});

describe("porcionesDisponibles", () => {
  const st = new Map([[1, 10], [2, 0.6], [3, -2]]);
  it("min(floor(stock/cantidad)) sobre los insumos", () => {
    expect(porcionesDisponibles([{ insumoId: 1, cantidad: 3 }], st)).toBe(3);
    expect(porcionesDisponibles([{ insumoId: 1, cantidad: 3 }, { insumoId: 2, cantidad: 0.2 }], st)).toBe(3);
    expect(porcionesDisponibles([{ insumoId: 1, cantidad: 1 }, { insumoId: 2, cantidad: 0.25 }], st)).toBe(2);
  });
  it("null sin receta; 0 con stock negativo o insumo ausente (inactivo)", () => {
    expect(porcionesDisponibles([], st)).toBeNull();
    expect(porcionesDisponibles([{ insumoId: 3, cantidad: 1 }], st)).toBe(0);
    expect(porcionesDisponibles([{ insumoId: 99, cantidad: 1 }], st)).toBe(0);
  });
});

describe("insumo.disponibilidadPorPlato", () => {
  it("por producto: null sin receta, inactivos cuentan como 0", async () => {
    s.insumos = [insumo(1, 10), insumo(2, 50, { activo: false })];
    recetas = [
      { productoId: 5, insumoId: 1, cantidad: "3" },
      { productoId: 7, insumoId: 1, cantidad: "1" },
      { productoId: 7, insumoId: 2, cantidad: "1" },
    ];
    expect(await caller().insumo.disponibilidadPorPlato({ empresaId: 1 })).toEqual([
      { productoId: 5, porcionesDisponibles: 3 },
      { productoId: 6, porcionesDisponibles: null },
      { productoId: 7, porcionesDisponibles: 0 },
    ]);
  });
});

describe("comanda_nueva agrupada por (pedido, area)", () => {
  it("throttle: dispara al primero, uno al final de la ventana si hubo mas, y reabre", () => {
    const fire = vi.fn();
    throttle("t:9:COCINA", fire, 5000);
    throttle("t:9:COCINA", fire, 5000);
    throttle("t:9:COCINA", fire, 5000);
    throttle("t:9:BAR", fire, 5000);
    expect(fire).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(5000);
    expect(fire).toHaveBeenCalledTimes(3);
    throttle("t:9:COCINA", fire, 5000);
    expect(fire).toHaveBeenCalledTimes(4);
    vi.advanceTimersByTime(5000);
    expect(fire).toHaveBeenCalledTimes(4);
  });

  it("un error en el disparo final no escapa del temporizador", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    throttle("t:err", () => {}, 5000);
    throttle("t:err", () => { throw new Error("x"); }, 5000);
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
  });

  it("3 items seguidos del mismo pedido -> una comanda inmediata y otra al cerrar la ventana", async () => {
    await add(6, 1);
    await add(6, 1);
    await add(6, 1);
    expect(deTipo("comanda_nueva")).toHaveLength(1);
    vi.advanceTimersByTime(5000);
    expect(deTipo("comanda_nueva")).toHaveLength(2);
  });
});
