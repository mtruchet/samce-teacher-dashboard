import { describe, expect, it } from "vitest";
import { conHuecos } from "./huecos";
import { evento } from "./test/fabricas";

const a = (seq: number, received_at: string) => evento(seq, "mouse_enter", {}, { received_at });

describe("conHuecos", () => {
  it("sin eventos no devuelve nada", () => {
    expect(conHuecos([])).toEqual([]);
  });

  it("marca un silencio de un minuto o más, con las dos horas de las puntas", () => {
    const entradas = conHuecos([a(1, "2026-09-21T14:00:00Z"), a(2, "2026-09-21T14:01:00Z")]);
    expect(entradas.map((e) => e.clase)).toEqual(["evento", "hueco", "evento"]);
    expect(entradas[1]).toMatchObject({ desde: "2026-09-21T14:00:00Z", hasta: "2026-09-21T14:01:00Z" });
  });

  it("no marca nada por debajo del minuto", () => {
    const entradas = conHuecos([a(1, "2026-09-21T14:00:00Z"), a(2, "2026-09-21T14:00:59Z")]);
    expect(entradas.map((e) => e.clase)).toEqual(["evento", "evento"]);
  });

  it("con una hora inválida no inventa un silencio", () => {
    const entradas = conHuecos([a(1, "no es una hora"), a(2, "2026-09-21T14:05:00Z")]);
    expect(entradas.map((e) => e.clase)).toEqual(["evento", "evento"]);
  });

  it("cada entrada tiene una clave distinta", () => {
    const entradas = conHuecos([a(1, "2026-09-21T14:00:00Z"), a(2, "2026-09-21T14:05:00Z"), a(3, "2026-09-21T14:10:00Z")]);
    const claves = entradas.map((e) => e.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });
});
