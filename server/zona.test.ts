import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { validarMesaEnZona } from "@shared/zonas";

vi.mock("./db", () => ({
  getZonaById: vi.fn(),
  getZonasByEmpresa: vi.fn().mockResolvedValue([]),
  getMesasByZona: vi.fn(),
  createZona: vi.fn().mockResolvedValue(5),
  updateZona: vi.fn().mockResolvedValue(undefined),
  deleteZona: vi.fn().mockResolvedValue(undefined),
  getMesaById: vi.fn(),
  createMesa: vi.fn().mockResolvedValue(10),
  updateMesa: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./lib/events", () => ({ publish: vi.fn() }));

const caller = () =>
  appRouter.createCaller({
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  });

const zona = { id: 1, empresaId: 1, nombre: "Terraza", tipo: "TERRAZA", maxMesas: 2, maxSillas: 8, activa: true };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getZonaById).mockResolvedValue(zona as any);
  vi.mocked(db.getMesasByZona).mockResolvedValue([]);
});

describe("validarMesaEnZona", () => {
  const z = { maxMesas: 2, maxSillas: 8 };
  it("rechaza alta con zona llena de mesas", () => {
    expect(validarMesaEnZona(z, [{ id: 1, sillas: 2 }, { id: 2, sillas: 2 }], { sillas: 2 })).toMatch(/mesas/i);
  });
  it("rechaza alta que excede sillas (6+4>8)", () => {
    expect(validarMesaEnZona(z, [{ id: 1, sillas: 6 }], { sillas: 4 })).toMatch(/sillas/i);
  });
  it("acepta editar la misma mesa de 6 a 8 sillas", () => {
    expect(validarMesaEnZona(z, [{ id: 1, sillas: 6 }], { id: 1, sillas: 8 })).toBeNull();
  });
  it("rechaza sillas 0", () => {
    expect(validarMesaEnZona(z, [], { sillas: 0 })).toMatch(/sillas/i);
  });
  it("acepta alta dentro de límites", () => {
    expect(validarMesaEnZona(z, [{ id: 1, sillas: 4 }], { sillas: 4 })).toBeNull();
  });
});

describe("zona router", () => {
  it("delete con mesas falla", async () => {
    vi.mocked(db.getMesasByZona).mockResolvedValue([{ id: 1, sillas: 4 }]);
    await expect(caller().zona.delete({ id: 1, empresaId: 1 })).rejects.toThrow(/mesas/i);
    expect(db.deleteZona).not.toHaveBeenCalled();
  });
  it("delete sin mesas funciona", async () => {
    await caller().zona.delete({ id: 1, empresaId: 1 });
    expect(db.deleteZona).toHaveBeenCalledWith(1, 1);
  });
  it("update rechaza bajar maxMesas por debajo de lo usado", async () => {
    vi.mocked(db.getMesasByZona).mockResolvedValue([{ id: 1, sillas: 2 }, { id: 2, sillas: 2 }]);
    await expect(caller().zona.update({ id: 1, empresaId: 1, maxMesas: 1 })).rejects.toThrow(/mesas/i);
    expect(db.updateZona).not.toHaveBeenCalled();
  });
  it("update rechaza bajar maxSillas por debajo de lo usado", async () => {
    vi.mocked(db.getMesasByZona).mockResolvedValue([{ id: 1, sillas: 6 }]);
    await expect(caller().zona.update({ id: 1, empresaId: 1, maxSillas: 4 })).rejects.toThrow(/sillas/i);
  });
  it("update válido", async () => {
    vi.mocked(db.getMesasByZona).mockResolvedValue([{ id: 1, sillas: 6 }]);
    await caller().zona.update({ id: 1, empresaId: 1, maxSillas: 6 });
    expect(db.updateZona).toHaveBeenCalled();
  });
});

describe("mesa router con zona", () => {
  it("create fuera de límite de sillas falla en servidor", async () => {
    vi.mocked(db.getMesasByZona).mockResolvedValue([{ id: 1, sillas: 6 }]);
    await expect(
      caller().mesa.create({ empresaId: 1, numero: 3, zonaId: 1, sillas: 4 })
    ).rejects.toThrow(/sillas/i);
    expect(db.createMesa).not.toHaveBeenCalled();
  });
  it("create fuera de límite de mesas falla", async () => {
    vi.mocked(db.getMesasByZona).mockResolvedValue([{ id: 1, sillas: 1 }, { id: 2, sillas: 1 }]);
    await expect(
      caller().mesa.create({ empresaId: 1, numero: 3, zonaId: 1, sillas: 1 })
    ).rejects.toThrow(/mesas/i);
  });
  it("create válido sincroniza capacidad = sillas", async () => {
    await caller().mesa.create({ empresaId: 1, numero: 3, zonaId: 1, sillas: 4 });
    expect(db.createMesa).toHaveBeenCalledWith(expect.objectContaining({ zonaId: 1, sillas: 4, capacidad: 4 }));
  });
  it("create sin zona no valida y funciona", async () => {
    await caller().mesa.create({ empresaId: 1, numero: 3, sillas: 12 });
    expect(db.getZonaById).not.toHaveBeenCalled();
    expect(db.createMesa).toHaveBeenCalledWith(expect.objectContaining({ capacidad: 12, sillas: 12 }));
  });
  it("update de mesa propia 6->8 sola en zona funciona", async () => {
    vi.mocked(db.getMesaById).mockResolvedValue({ id: 1, empresaId: 1, zonaId: 1, sillas: 6, capacidad: 6 } as any);
    vi.mocked(db.getMesasByZona).mockResolvedValue([{ id: 1, sillas: 6 }]);
    await caller().mesa.update({ id: 1, sillas: 8 });
    expect(db.updateMesa).toHaveBeenCalledWith(1, expect.objectContaining({ sillas: 8, capacidad: 8 }));
  });
  it("update excediendo falla", async () => {
    vi.mocked(db.getMesaById).mockResolvedValue({ id: 1, empresaId: 1, zonaId: 1, sillas: 6, capacidad: 6 } as any);
    vi.mocked(db.getMesasByZona).mockResolvedValue([{ id: 1, sillas: 6 }]);
    await expect(caller().mesa.update({ id: 1, sillas: 9 })).rejects.toThrow(/sillas/i);
  });
});

describe("aislamiento por empresa y casos extra", () => {
  const otra = { ...zona, empresaId: 2 };
  it("zona.update de otra empresa -> NOT_FOUND sin escribir", async () => {
    vi.mocked(db.getZonaById).mockResolvedValue(otra as any);
    await expect(caller().zona.update({ id: 1, empresaId: 1, maxMesas: 5 })).rejects.toThrow(/no encontrada/i);
    expect(db.updateZona).not.toHaveBeenCalled();
  });
  it("zona.delete de otra empresa -> NOT_FOUND sin escribir", async () => {
    vi.mocked(db.getZonaById).mockResolvedValue(otra as any);
    await expect(caller().zona.delete({ id: 1, empresaId: 1 })).rejects.toThrow(/no encontrada/i);
    expect(db.deleteZona).not.toHaveBeenCalled();
  });
  it("zona inexistente -> NOT_FOUND", async () => {
    vi.mocked(db.getZonaById).mockResolvedValue(null as any);
    await expect(caller().zona.delete({ id: 9, empresaId: 1 })).rejects.toThrow(/no encontrada/i);
  });
  it("mesa.create con zona de otra empresa -> NOT_FOUND", async () => {
    vi.mocked(db.getZonaById).mockResolvedValue(otra as any);
    await expect(caller().mesa.create({ empresaId: 1, numero: 1, zonaId: 1, sillas: 2 })).rejects.toThrow(/no encontrada/i);
    expect(db.createMesa).not.toHaveBeenCalled();
  });
  it("mover mesa valida solo la zona destino", async () => {
    vi.mocked(db.getMesaById).mockResolvedValue({ id: 1, empresaId: 1, zonaId: 7, sillas: 4, capacidad: 4 } as any);
    vi.mocked(db.getMesasByZona).mockResolvedValue([{ id: 2, sillas: 2 }]);
    await caller().mesa.update({ id: 1, zonaId: 1 });
    expect(db.getZonaById).toHaveBeenCalledTimes(1);
    expect(db.getZonaById).toHaveBeenCalledWith(1);
    expect(db.updateMesa).toHaveBeenCalled();
  });
  it("editar mesa en zona llena de mesas sigue válido", async () => {
    vi.mocked(db.getMesaById).mockResolvedValue({ id: 1, empresaId: 1, zonaId: 1, sillas: 2, capacidad: 2 } as any);
    vi.mocked(db.getMesasByZona).mockResolvedValue([{ id: 1, sillas: 2 }, { id: 2, sillas: 2 }]);
    await caller().mesa.update({ id: 1, sillas: 3 });
    expect(db.updateMesa).toHaveBeenCalled();
  });
  it("zona.update subiendo límites funciona", async () => {
    vi.mocked(db.getMesasByZona).mockResolvedValue([{ id: 1, sillas: 6 }]);
    await caller().zona.update({ id: 1, empresaId: 1, maxMesas: 10, maxSillas: 40 });
    expect(db.updateZona).toHaveBeenCalledWith(1, 1, { maxMesas: 10, maxSillas: 40 });
  });
  it("sillas > 20 rechazado", async () => {
    await expect(caller().mesa.create({ empresaId: 1, numero: 1, sillas: 21 })).rejects.toThrow();
    await expect(caller().mesa.update({ id: 1, sillas: 21 })).rejects.toThrow();
  });
});
