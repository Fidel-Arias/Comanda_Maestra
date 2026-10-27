import { describe, expect, it, vi } from "vitest";

const select = vi.fn(() => ({ from: () => ({ where: async () => [{ productoId: 1, insumoId: 2, cantidad: "1.000" }] }) }));
vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: () => ({ select }) }));
vi.mock("postgres", () => ({ default: () => ({}) }));

describe("getRecetasByProductos", () => {
  it("lista vacia -> [] sin consultar; con ids consulta", async () => {
    process.env.DATABASE_URL = "postgres://x/y";
    const { getRecetasByProductos } = await import("./db");
    expect(await getRecetasByProductos([], 1)).toEqual([]);
    expect(select).not.toHaveBeenCalled();
    expect(await getRecetasByProductos([1], 1)).toHaveLength(1);
    expect(select).toHaveBeenCalledTimes(1);
  });
});
