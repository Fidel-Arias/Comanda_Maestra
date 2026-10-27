import { describe, it, expect } from "vitest";
import { publish, subscribe, type RealtimeEvent } from "./lib/events";

const ev: RealtimeEvent = { type: "comanda_nueva", area: "COCINA", pedidoId: 1 };

describe("realtime events", () => {
  it("delivers only to subscribers of the same empresa", () => {
    const a: RealtimeEvent[] = [];
    const b: RealtimeEvent[] = [];
    const ua = subscribe(1, e => a.push(e));
    const ub = subscribe(2, e => b.push(e));
    publish(1, ev);
    expect(a).toEqual([ev]);
    expect(b).toEqual([]);
    ua();
    ub();
  });

  it("stops delivering after unsubscribe", () => {
    const a: RealtimeEvent[] = [];
    const un = subscribe(1, e => a.push(e));
    un();
    publish(1, ev);
    expect(a).toEqual([]);
  });

  it("delivers the same event to two subscribers", () => {
    const a: RealtimeEvent[] = [];
    const b: RealtimeEvent[] = [];
    const ua = subscribe(1, e => a.push(e));
    const ub = subscribe(1, e => b.push(e));
    publish(1, ev);
    expect(a).toEqual([ev]);
    expect(b).toEqual([ev]);
    ua();
    ub();
  });
});
