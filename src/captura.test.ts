import { describe, expect, it } from "vitest";
import { avisoDeCaptura } from "./captura";

describe("avisoDeCaptura", () => {
  it("no marca nada cuando la captura estuvo bien, o el backend no informó nada", () => {
    expect(avisoDeCaptura({ state: "ok" })).toBeNull();
    expect(avisoDeCaptura(undefined)).toBeNull();
  });

  it("una sesión sin ningún evento dice 'Captura incompleta' y qué pudo pasar, sin acusar ni pedir nada", () => {
    const aviso = avisoDeCaptura({ state: "none" })!;
    expect(aviso.corto).toBe("Captura incompleta");
    expect(aviso.detalle).toContain("No quedó registrada ninguna actividad");
    expect(aviso.detalle).toContain("falla técnica");
    expect(aviso.detalle).not.toContain("Conviene");
  });

  it("un silencio largo dice entre qué horas no hubo señales y cuántos minutos", () => {
    const aviso = avisoDeCaptura({ state: "gap", gap_minutes: 15, last_event_at: "2026-09-24T13:32:00Z" })!;
    expect(aviso.corto).toBe("Sin eventos recibidos");
    expect(aviso.detalle).toMatch(/No se recibieron eventos entre las \d{2}:\d{2} y las \d{2}:\d{2} mientras el examen seguía en curso \(15 minutos\)/);
  });

  it("un silencio sin hora de la última señal igual dice cuánto duró", () => {
    expect(avisoDeCaptura({ state: "gap", gap_minutes: 12 })!.detalle).toContain("durante 12 minutos");
  });

  it("JavaScript apagado y captura que no arrancó se explican por separado", () => {
    expect(avisoDeCaptura({ state: "js_disabled" })!.detalle).toContain("JavaScript desactivado");
    expect(avisoDeCaptura({ state: "no_start" })!.detalle).toContain("no llegó a arrancar");
  });

  it("ningún texto habla de riesgo, sospecha ni trampa", () => {
    for (const state of ["none", "gap", "js_disabled", "no_start"] as const) {
      const { corto, detalle } = avisoDeCaptura({ state, gap_minutes: 10 })!;
      expect(`${corto} ${detalle}`).not.toMatch(/riesgo|sospech|trampa|fraude|alerta/i);
    }
  });

  // Ninguno de los cuatro puede insinuar que el alumno lo hizo a propósito: el
  // dato no dice quién apagó nada. Y los cuatro ofrecen la otra explicación,
  // porque el más comprometedor —JavaScript apagado— se había quedado sin ella.
  it("ninguno insinúa intención, y los cuatro ofrecen una explicación que no es el alumno", () => {
    for (const state of ["none", "gap", "js_disabled", "no_start"] as const) {
      const { corto, detalle } = avisoDeCaptura({ state, gap_minutes: 10 })!;
      expect(`${corto} ${detalle}`).not.toMatch(/a propósito|deliberad|intencional|adrede/i);
      expect(detalle).toMatch(/falla técnica/);
    }
  });
});
