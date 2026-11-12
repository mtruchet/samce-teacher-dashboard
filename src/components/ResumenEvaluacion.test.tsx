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
      "Riesgo alto: 3 sesiones",
      "Riesgo medio: 1 sesión",
      "Riesgo bajo: 0 sesiones",
      "Sin alertas: 12 sesiones",
      "Sin analizar: 2 sesiones",
      "No se pudo analizar: 1 sesión",
      "Análisis no disponible: 1 sesión",
    ]);
    expect(screen.getByRole("heading", { name: "Resumen de la evaluación" })).toBeInTheDocument();
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

  it("no es una región viva y no muestra nombres, índice ni promedios", () => {
    const { container } = render(<ResumenEvaluacion resumen={RESUMEN} filtros={{}} onFiltrar={() => {}} />);
    expect(container.querySelector("[aria-live], [role='status']")).toBeNull();
    expect(container.textContent).not.toMatch(/índice|integridad|promedio|%/i);
    expectLenguajeLlano(container);
  });

  it("una tarjeta de nivel deja solo su filtro y no toca el orden", () => {
    const onFiltrar = vi.fn();
    render(<ResumenEvaluacion resumen={RESUMEN} filtros={{ estado: "open", q: "ana", orden: "risk_level" }} onFiltrar={onFiltrar} />);
    fireEvent.click(screen.getByRole("button", { name: "Riesgo alto: 3 sesiones" }));
    const parciales = onFiltrar.mock.lastCall?.[0];
    expect(parciales).toStrictEqual({ nivel: "high", estado: undefined, analisis: undefined, q: undefined });
    expect("orden" in parciales).toBe(false);
  });

  it("una tarjeta de estado filtra por el estado del análisis", () => {
    const onFiltrar = vi.fn();
    render(<ResumenEvaluacion resumen={RESUMEN} filtros={{}} onFiltrar={onFiltrar} />);
    fireEvent.click(screen.getByRole("button", { name: "Sin analizar: 2 sesiones" }));
    expect(onFiltrar).toHaveBeenLastCalledWith({ nivel: undefined, estado: undefined, analisis: "not_analyzed", q: undefined });
  });

  it("la tarjeta del filtro vigente queda marcada aunque haya otros filtros, y tocarla borra solo su filtro", () => {
    const onFiltrar = vi.fn();
    render(<ResumenEvaluacion resumen={RESUMEN} filtros={{ nivel: "medium", q: "ana" }} onFiltrar={onFiltrar} />);
    const medio = screen.getByRole("button", { name: "Riesgo medio: 1 sesión" });
    expect(medio).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Riesgo alto: 3 sesiones" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(medio);
    expect(onFiltrar.mock.lastCall?.[0]).toStrictEqual({ nivel: undefined });
  });

  it("la tarjeta de estado elegida queda marcada con un estado de sesión al lado, y tocarla borra solo el análisis", () => {
    const onFiltrar = vi.fn();
    render(<ResumenEvaluacion resumen={RESUMEN} filtros={{ analisis: "unavailable", estado: "finished" }} onFiltrar={onFiltrar} />);
    const tarjeta = screen.getByRole("button", { name: "Análisis no disponible: 1 sesión" });
    expect(tarjeta).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(tarjeta);
    expect(onFiltrar.mock.lastCall?.[0]).toStrictEqual({ analisis: undefined });
  });
});
