import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { resumen } from "../test/fabricas";
import { expectLenguajeLlano } from "../test/lenguaje";
import { ResumenEvaluacion } from "./ResumenEvaluacion";

const RESUMEN = resumen({ risk_high: 3, risk_medium: 1, no_alerts: 12, not_analyzed: 2, insufficient_evidence: 1, unavailable: 1 });

describe("ResumenEvaluacion", () => {
  it("muestra las siete tarjetas en orden fijo, con su número y su nombre accesible", () => {
    render(<ResumenEvaluacion resumen={RESUMEN} filtros={{}} onFiltrar={() => {}} />);
    const nombres = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(nombres).toEqual([
      "3 Riesgo alto, 3 sesiones",
      "1 Riesgo medio, 1 sesión",
      "0 Riesgo bajo, 0 sesiones",
      "12 Sin alertas, 12 sesiones",
      "2 Sin analizar, 2 sesiones",
      "1 No se pudo analizar, 1 sesión",
      "1 Análisis no disponible, 1 sesión",
    ]);
    expect(screen.getByRole("heading", { name: "Resumen de la evaluación" })).toBeInTheDocument();
  });

  it("el nombre accesible de cada tarjeta empieza por lo que se lee en ella (WCAG 2.5.3)", () => {
    render(<ResumenEvaluacion resumen={RESUMEN} filtros={{}} onFiltrar={() => {}} />);
    for (const tarjeta of screen.getAllByRole("button")) {
      // Lo visible, en el orden en que se lee: el número y la palabra (el medidor no tiene texto).
      const visible = [...tarjeta.querySelectorAll(".resumen__numero, .rotulo-nivel__nivel, .resumen__rotulo")]
        .map((e) => e.textContent!.trim())
        .join(" ");
      expect(visible).toMatch(/^\d+ \S/);
      expect(tarjeta.getAttribute("aria-label")!.startsWith(visible)).toBe(true);
    }
  });

  it("los niveles llevan el tono de las alertas y el rótulo de nivel de todo el panel; los estados, sin medidor", () => {
    const { container } = render(<ResumenEvaluacion resumen={RESUMEN} filtros={{}} onFiltrar={() => {}} />);
    for (const nivel of ["high", "medium", "low"]) {
      const tarjeta = container.querySelector(`.resumen__tarjeta[data-nivel="${nivel}"]`)!;
      expect(tarjeta.querySelector(".medidor")).toHaveAttribute("aria-hidden", "true");
      expect(tarjeta).toHaveAttribute("data-nivel", nivel);
      expect(tarjeta.querySelector(".rotulo-nivel")).toHaveAttribute("data-nivel", nivel);
    }
    expect(screen.getByRole("heading", { name: "Resumen de la evaluación" })).toHaveClass("lamina__titulo");
    expect(container.querySelectorAll(".resumen__tarjeta--estado[data-nivel]")).toHaveLength(0);
    expect(container.querySelectorAll(".resumen__tarjeta--estado .medidor")).toHaveLength(0);
  });

  it("un nivel sin sesiones pesa menos, pero conserva el medidor, la palabra y el botón (V6)", () => {
    render(<ResumenEvaluacion resumen={{ ...RESUMEN, risk_high: 0, risk_low: 2 }} filtros={{}} onFiltrar={() => {}} />);
    const cero = screen.getByRole("button", { name: "0 Riesgo alto, 0 sesiones" });
    expect(cero).toHaveClass("resumen__tarjeta--cero");
    expect(cero).toHaveAttribute("aria-pressed", "false");
    expect(cero.querySelector(".medidor")).not.toBeNull();
    expect(cero).toHaveTextContent("Riesgo alto");
    for (const nombre of [/^\d+ Riesgo medio,/, /^\d+ Riesgo bajo,/]) {
      expect(screen.getByRole("button", { name: nombre })).not.toHaveClass("resumen__tarjeta--cero");
    }
  });

  it("no es una región viva y no muestra nombres, índice ni promedios", () => {
    const { container } = render(<ResumenEvaluacion resumen={RESUMEN} filtros={{}} onFiltrar={() => {}} />);
    expect(container.querySelector("[aria-live], [role='status']")).toBeNull();
    expect(container.textContent).not.toMatch(/índice|integridad|promedio|%/i);
    expectLenguajeLlano(container);
  });

  it("una tarjeta de nivel deja solo su filtro y no toca el orden", () => {
    const onFiltrar = vi.fn();
    render(<ResumenEvaluacion resumen={RESUMEN} filtros={{ estado: "open", q: "ana", orden: "risk_level" }} onFiltrar={onFiltrar} />);
    fireEvent.click(screen.getByRole("button", { name: "3 Riesgo alto, 3 sesiones" }));
    const parciales = onFiltrar.mock.lastCall?.[0];
    expect(parciales).toStrictEqual({ nivel: "high", estado: undefined, analisis: undefined, q: undefined });
    expect("orden" in parciales).toBe(false);
  });

  it("una tarjeta de estado filtra por el estado del análisis", () => {
    const onFiltrar = vi.fn();
    render(<ResumenEvaluacion resumen={RESUMEN} filtros={{}} onFiltrar={onFiltrar} />);
    fireEvent.click(screen.getByRole("button", { name: "2 Sin analizar, 2 sesiones" }));
    expect(onFiltrar).toHaveBeenLastCalledWith({ nivel: undefined, estado: undefined, analisis: "not_analyzed", q: undefined });
  });

  it("la tarjeta del filtro vigente queda marcada aunque haya otros filtros, y tocarla borra solo su filtro", () => {
    const onFiltrar = vi.fn();
    render(<ResumenEvaluacion resumen={RESUMEN} filtros={{ nivel: "medium", q: "ana" }} onFiltrar={onFiltrar} />);
    const medio = screen.getByRole("button", { name: "1 Riesgo medio, 1 sesión" });
    expect(medio).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "3 Riesgo alto, 3 sesiones" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(medio);
    expect(onFiltrar.mock.lastCall?.[0]).toStrictEqual({ nivel: undefined });
  });

  it("la tarjeta de estado elegida queda marcada con un estado de sesión al lado, y tocarla borra solo el análisis", () => {
    const onFiltrar = vi.fn();
    render(<ResumenEvaluacion resumen={RESUMEN} filtros={{ analisis: "unavailable", estado: "finished" }} onFiltrar={onFiltrar} />);
    const tarjeta = screen.getByRole("button", { name: "1 Análisis no disponible, 1 sesión" });
    expect(tarjeta).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(tarjeta);
    expect(onFiltrar.mock.lastCall?.[0]).toStrictEqual({ analisis: undefined });
  });
});
