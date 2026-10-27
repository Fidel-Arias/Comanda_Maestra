import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import * as nubefact from "./lib/nubefact";
import { toPublicEmpresa } from "./lib/empresa";

vi.mock("./db", () => ({
  getClienteByDocumento: vi.fn(),
  createCliente: vi.fn(),
  getClientesByEmpresa: vi.fn(),
  getEmpresaById: vi.fn(),
  getEmpresas: vi.fn(),
  updateEmpresa: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./lib/nubefact", () => ({
  consultarEntidad: vi.fn(),
}));
vi.mock("./lib/events", () => ({ publish: vi.fn() }));

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as unknown as TrpcContext;
const caller = () => appRouter.createCaller(ctx);

const empresaRow = {
  id: 1, nombre: "Demo", ruc: "20123456789", razonSocial: null, direccion: null,
  telefono: null, email: null, logoUrl: null, activa: true,
  impuestoPorcentaje: "10.50", moneda: "PEN", apisNetPeToken: "SECRET",
  createdAt: new Date(), updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getEmpresaById).mockResolvedValue(empresaRow as any);
});

describe("cliente.buscarPorDocumento", () => {
  it("devuelve de BD sin llamar a la API", async () => {
    const cli = { id: 5, empresaId: 1, nombre: "Ana", dni: "12345678" };
    vi.mocked(db.getClienteByDocumento).mockResolvedValue(cli as any);
    const r = await caller().cliente.buscarPorDocumento({ empresaId: 1, numero: " 12345678 " });
    expect(r).toEqual({ cliente: cli, origen: "BD" });
    expect(db.getClienteByDocumento).toHaveBeenCalledWith(1, "12345678");
    expect(nubefact.consultarEntidad).not.toHaveBeenCalled();
  });

  it("consulta API y crea cliente EMPRESA con ruc; usa token de la empresa", async () => {
    vi.mocked(db.getClienteByDocumento).mockResolvedValue(undefined as any);
    vi.mocked(nubefact.consultarEntidad).mockResolvedValue({
      tipo_de_documento: "6", numero_de_documento: "20123456789", razon_social: "ACME SAC", direccion: "Av 1",
    } as any);
    vi.mocked(db.createCliente).mockImplementation(async (d: any) => ({ id: 9, ...d }) as any);
    const r = await caller().cliente.buscarPorDocumento({ empresaId: 1, numero: "20123456789" });
    expect(r.origen).toBe("API");
    expect(nubefact.consultarEntidad).toHaveBeenCalledWith("20123456789", "SECRET");
    expect(db.createCliente).toHaveBeenCalledTimes(1);
    expect(db.createCliente).toHaveBeenCalledWith(expect.objectContaining({
      empresaId: 1, nombre: "ACME SAC", ruc: "20123456789", direccion: "Av 1", tipoCliente: "EMPRESA",
    }));
  });

  it("DNI crea PERSONA con dni", async () => {
    vi.mocked(db.getClienteByDocumento).mockResolvedValue(undefined as any);
    vi.mocked(nubefact.consultarEntidad).mockResolvedValue({ tipo_de_documento: "1", numero_de_documento: "12345678", razon_social: "JUAN PEREZ" } as any);
    vi.mocked(db.createCliente).mockImplementation(async (d: any) => ({ id: 9, ...d }) as any);
    await caller().cliente.buscarPorDocumento({ empresaId: 1, numero: "12345678" });
    expect(db.createCliente).toHaveBeenCalledWith(expect.objectContaining({ dni: "12345678", tipoCliente: "PERSONA" }));
  });

  it("empresa sin token pasa undefined (fallback a .env)", async () => {
    vi.mocked(db.getEmpresaById).mockResolvedValue({ ...empresaRow, apisNetPeToken: null } as any);
    vi.mocked(db.getClienteByDocumento).mockResolvedValue(undefined as any);
    vi.mocked(nubefact.consultarEntidad).mockResolvedValue({ tipo_de_documento: "1", numero_de_documento: "12345678", razon_social: "X" } as any);
    vi.mocked(db.createCliente).mockImplementation(async (d: any) => ({ id: 9, ...d }) as any);
    await caller().cliente.buscarPorDocumento({ empresaId: 1, numero: "12345678" });
    expect(nubefact.consultarEntidad).toHaveBeenCalledWith("12345678", undefined);
  });

  it("propaga error de la API y no crea cliente", async () => {
    vi.mocked(db.getClienteByDocumento).mockResolvedValue(undefined as any);
    vi.mocked(nubefact.consultarEntidad).mockRejectedValue(new Error("No se encontraron datos."));
    await expect(caller().cliente.buscarPorDocumento({ empresaId: 1, numero: "12345678" }))
      .rejects.toThrow("No se encontraron datos.");
    expect(db.createCliente).not.toHaveBeenCalled();
  });

  it("documento inválido falla sin tocar BD", async () => {
    await expect(caller().cliente.buscarPorDocumento({ empresaId: 1, numero: "123" })).rejects.toThrow(/Documento inválido/);
    expect(db.getClienteByDocumento).not.toHaveBeenCalled();
  });
});

describe("billing.consultarEntidad", () => {
  it("usa el token de la empresa", async () => {
    vi.mocked(nubefact.consultarEntidad).mockResolvedValue({ razon_social: "X" } as any);
    await caller().billing.consultarEntidad({ empresaId: 1, numero: "12345678" });
    expect(nubefact.consultarEntidad).toHaveBeenCalledWith("12345678", "SECRET");
  });
});

describe("toPublicEmpresa", () => {
  it("nunca incluye apisNetPeToken y calcula tieneApiKey", () => {
    const pub = toPublicEmpresa(empresaRow as any);
    expect("apisNetPeToken" in pub).toBe(false);
    expect(JSON.stringify(pub)).not.toContain("SECRET");
    expect(pub.tieneApiKey).toBe(true);
    expect(toPublicEmpresa({ ...empresaRow, apisNetPeToken: null } as any).tieneApiKey).toBe(false);
    expect(toPublicEmpresa({ ...empresaRow, apisNetPeToken: "" } as any).tieneApiKey).toBe(false);
  });

  it("empresa.getById y empresa.list no filtran el token", async () => {
    vi.mocked(db.getEmpresas).mockResolvedValue([empresaRow] as any);
    const one = await caller().empresa.getById({ id: 1 });
    const list = await caller().empresa.list();
    expect(JSON.stringify(one)).not.toContain("SECRET");
    expect(JSON.stringify(list)).not.toContain("SECRET");
    expect(one?.tieneApiKey).toBe(true);
  });

  it("empresa.getById devuelve null/undefined si no existe", async () => {
    vi.mocked(db.getEmpresaById).mockResolvedValue(undefined as any);
    expect(await caller().empresa.getById({ id: 99 })).toBeFalsy();
  });
});

describe("configuracion.updateEmpresa", () => {
  it("cadena vacía guarda null", async () => {
    await caller().configuracion.updateEmpresa({ id: 1, apisNetPeToken: "" });
    expect(db.updateEmpresa).toHaveBeenCalledWith(1, { apisNetPeToken: null });
  });
  it("null guarda null; valor se guarda; omitido no toca la clave", async () => {
    await caller().configuracion.updateEmpresa({ id: 1, apisNetPeToken: null });
    expect(db.updateEmpresa).toHaveBeenLastCalledWith(1, { apisNetPeToken: null });
    await caller().configuracion.updateEmpresa({ id: 1, apisNetPeToken: "tok" });
    expect(db.updateEmpresa).toHaveBeenLastCalledWith(1, { apisNetPeToken: "tok" });
    await caller().configuracion.updateEmpresa({ id: 1, nombre: "N" });
    expect(db.updateEmpresa).toHaveBeenLastCalledWith(1, { nombre: "N" });
  });
});
