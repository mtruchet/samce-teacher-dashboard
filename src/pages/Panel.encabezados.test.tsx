import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sesionesService from "../services/sesionesService";
import {
  alerta, analisis, conAnalisis, entradaDelHistorial, esperar, evento, metricasDelCierre, pagina, resumen,
} from "../test/fabricas";
import { EXAMEN, entregadaHaceRato, ingresar, montar, rindiendo } from "../test/panel";

/**
 * La jerarquía de encabezados de cada vista del panel: un solo h1 y ningún salto de más de un nivel (de un h2
 * a un h4, por ejemplo), que es lo que un lector de pantalla usa para recorrer la página por títulos. En el
 * detalle, h2 para «Análisis de la sesión» y «Registro de eventos», y h3 para sus apartados.
 */

/** Los niveles de los encabezados, en el orden del documento. */
function niveles(): number[] {
  return Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((h) => Number(h.tagName[1]));
}

function esperarJerarquia() {
  const n = niveles();
  expect(n.filter((x) => x === 1), `encabezados: ${n.join(" ")}`).toHaveLength(1);
  expect(n[0], `encabezados: ${n.join(" ")}`).toBe(1);
  n.forEach((nivel, i) => {
    if (i > 0) expect(nivel - n[i - 1], `encabezados: ${n.join(" ")}`).toBeLessThanOrEqual(1);
  });
}

describe("Los encabezados de cada vista", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ingresar();
    vi.spyOn(sesionesService, "traerExamenes").mockResolvedValue([EXAMEN]);
    const cerrada = { ...entregadaHaceRato(), ...conAnalisis("high", ["model", "event"]), attempt_number: 1, attempts_total: 1 };
    const abierta = { ...rindiendo, ...conAnalisis(null), attempt_number: 1, attempts_total: 1 };
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(
      pagina([cerrada, abierta], 2, resumen({ risk_high: 1, no_alerts: 1 }))
    );
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([
      evento(1, "paste", { length: 300, question: 3 }),
      evento(2, "visibility_change", { state: "hidden" }),
    ]);
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({
        alerts: [alerta({ level: "high" }), alerta({ origin: "event", level: "medium", explanation: "Pegó un texto largo." })],
        alert_history: [entradaDelHistorial({ carried_over: true }), entradaDelHistorial({ level: "high", recorded_at: "2026-10-23T14:20:00.000Z" })],
        metrics: metricasDelCierre(),
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("la lista: un solo h1 y sin saltos", async () => {
    montar("/panel?examen=1");
    await esperar();
    expect(document.querySelector(".lista")).not.toBeNull();
    esperarJerarquia();
  });

  it("la lista filtrada: un solo h1 y sin saltos", async () => {
    montar("/panel?examen=1&nivel=high");
    await esperar();
    expect(document.querySelector(".control__resultado")).not.toBeNull();
    esperarJerarquia();
  });

  it("el detalle: un solo h1, h2 para el análisis y el registro, h3 para sus apartados", async () => {
    montar("/panel?examen=1&sesion=5");
    await esperar();
    await esperar();
    expect(document.querySelectorAll(".metricas__metrica")).toHaveLength(6);
    esperarJerarquia();
    const h2 = Array.from(document.querySelectorAll("h2")).map((h) => h.textContent);
    expect(h2).toEqual(expect.arrayContaining(["Análisis de la sesión", "Registro de eventos"]));
    const h3 = Array.from(document.querySelectorAll("h3")).map((h) => h.textContent);
    expect(h3).toEqual(
      expect.arrayContaining(["Cómo cambió el riesgo", "Historial de alertas", "Métricas de la sesión", "Momentos para revisar"])
    );
  });
});
