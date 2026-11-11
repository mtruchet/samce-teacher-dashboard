import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ResumenDeEvaluacion } from "../services/sesionesService";
import { ResumenEvaluacion } from "./ResumenEvaluacion";

const RESUMEN: ResumenDeEvaluacion = {
  total: 20, risk_high: 3, risk_medium: 1, risk_low: 0, no_alerts: 12, not_analyzed: 2, insufficient_evidence: 1, unavailable: 1,
};

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

  it("los niveles llevan el color de semáforo, el medidor oculto y el rótulo; los estados, sin medidor", () => {
    const { container } = render(<ResumenEvaluacion resumen={RESUMEN} filtros={{}} onFiltrar={() => {}} />);
    for (const nivel of ["high", "medium", "low"]) {
      const tarjeta = container.querySelector(`.resumen__tarjeta--${nivel}`)!;
      expect(tarjeta.querySelector(".medidor")).toHaveAttribute("aria-hidden", "true");
    }
    expect(container.querySelectorAll(".resumen__tarjeta--estado .medidor")).toHaveLength(0);
  });

  it("no es una región viva y no muestra nombres, índice ni promedios", () => {
    const { container } = render(<ResumenEvaluacion resumen={RESUMEN} filtros={{}} onFiltrar={() => {}} />);
    expect(container.querySelector("[aria-live], [role='status']")).toBeNull();
    expect(container.textContent).not.toMatch(/índice|integridad|promedio|%/i);
  });

  it("una tarjeta de nivel deja solo su filtro y conserva el orden", () => {
    const onFiltrar = vi.fn();
    render(<ResumenEvaluacion resumen={RESUMEN} filtros={{ estado: "open", q: "ana", orden: "risk_level" }} onFiltrar={onFiltrar} />);
    fireEvent.click(screen.getByRole("button", { name: "Riesgo alto: 3 sesiones" }));
    expect(onFiltrar).toHaveBeenLastCalledWith({ nivel: "high", estado: undefined, analisis: undefined, q: undefined });
  });

  it("una tarjeta de estado filtra por el estado del análisis", () => {
    const onFiltrar = vi.fn();
    render(<ResumenEvaluacion resumen={RESUMEN} filtros={{}} onFiltrar={onFiltrar} />);
    fireEvent.click(screen.getByRole("button", { name: "Sin analizar: 2 sesiones" }));
    expect(onFiltrar).toHaveBeenLastCalledWith({ nivel: undefined, estado: undefined, analisis: "not_analyzed", q: undefined });
  });

  it("la tarjeta del filtro vigente queda marcada, y tocarla de nuevo vuelve a la evaluación completa", () => {
    const onFiltrar = vi.fn();
    render(<ResumenEvaluacion resumen={RESUMEN} filtros={{ nivel: "medium" }} onFiltrar={onFiltrar} />);
    const medio = screen.getByRole("button", { name: "Riesgo medio: 1 sesión" });
    expect(medio).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Riesgo alto: 3 sesiones" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(medio);
    expect(onFiltrar).toHaveBeenLastCalledWith({ nivel: undefined, estado: undefined, analisis: undefined, q: undefined });
  });
});
