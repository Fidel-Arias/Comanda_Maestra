import { describe, expect, it } from "vitest";
import { normalizarDocumento } from "./lib/documento";

describe("normalizarDocumento", () => {
  it("8 dígitos es DNI", () => {
    expect(normalizarDocumento("12345678")).toEqual({ tipo: "DNI", numero: "12345678" });
  });
  it("quita espacios y detecta RUC", () => {
    expect(normalizarDocumento(" 20 123456789 ")).toEqual({ tipo: "RUC", numero: "20123456789" });
  });
  it("acepta prefijos 10, 15 y 17", () => {
    for (const p of ["10", "15", "17"]) {
      expect(normalizarDocumento(`${p}123456789`).tipo).toBe("RUC");
    }
  });
  it.each(["1234567", "abc12345", "30123456789", ""])("rechaza %j", (raw) => {
    expect(() => normalizarDocumento(raw)).toThrow(/Documento inválido/);
  });
});
