import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EstadoDelAnalisis } from "../services/sesionesService";
import { sesionNumerada } from "../test/fabricas";
import { IndicadorSesion } from "./IndicadorSesion";

describe("IndicadorSesion", () => {
  it.each([
    ["low", "Riesgo bajo", 1],
    ["medium", "Riesgo medio", 2],
    ["high", "Riesgo alto", 3],
  ] as const)("con alertas %s dice «%s» y llena %i segmentos del medidor", (nivel, rotulo, llenos) => {
    const { container } = render(
      <IndicadorSesion
        sesion={sesionNumerada({ risk_level: nivel, alerts_count: 1, alert_origins: ["event"], analysis_state: "analyzed" })}
      />
    );
    expect(screen.getByText(rotulo)).toBeInTheDocument();
    expect(container.querySelectorAll(".medidor__segmento--lleno")).toHaveLength(llenos);
    expect(container.querySelector(".medidor")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(`.indicador--${nivel}`)).not.toBeNull();
  });

  it("dice la cantidad y el origen de las alertas", () => {
    const { rerender } = render(
      <IndicadorSesion
        sesion={sesionNumerada({ risk_level: "low", alerts_count: 1, alert_origins: ["event"], analysis_state: "analyzed" })}
      />
    );
    expect(screen.getByText("1 alerta: en un momento de la sesión")).toBeInTheDocument();
    rerender(
      <IndicadorSesion
        sesion={sesionNumerada({ risk_level: "high", alerts_count: 2, alert_origins: ["model", "event"], analysis_state: "analyzed" })}
      />
    );
    expect(screen.getByText("2 alertas: en toda la sesión y en un momento de la sesión")).toBeInTheDocument();
  });

  it.each([
    ["analyzed", "Sin alertas"],
    ["not_analyzed", "Sin analizar"],
    ["insufficient_evidence", "No se pudo analizar"],
    ["unavailable", "Análisis no disponible"],
  ] as Array<[EstadoDelAnalisis, string]>)("sin alertas y %s dice «%s», nunca «Riesgo bajo»", (estado, texto) => {
    const { container } = render(
      <IndicadorSesion sesion={sesionNumerada({ risk_level: null, alerts_count: 0, alert_origins: [], analysis_state: estado })} />
    );
    expect(screen.getByText(texto)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Riesgo|evidencia/);
    expect(container.querySelector(".medidor")).toBeNull();
  });

  it("con alertas y un último análisis sin evidencia muestra el nivel y el estado aparte", () => {
    render(
      <IndicadorSesion
        sesion={sesionNumerada({ risk_level: "medium", alerts_count: 1, alert_origins: ["model"], analysis_state: "insufficient_evidence" })}
      />
    );
    expect(screen.getByText("Riesgo medio")).toBeInTheDocument();
    expect(screen.getByText("Último análisis: no se pudo analizar")).toBeInTheDocument();
  });

  it("con alertas y analizada no agrega el renglón del estado", () => {
    const { container } = render(
      <IndicadorSesion
        sesion={sesionNumerada({ risk_level: "high", alerts_count: 1, alert_origins: ["model"], analysis_state: "analyzed" })}
      />
    );
    expect(container.querySelector(".indicador__estado")).toBeNull();
  });

  it("sin los campos (un backend viejo) no dibuja nada", () => {
    const { container } = render(<IndicadorSesion sesion={sesionNumerada()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("nunca muestra el índice, un número de 0 a 100 ni un porcentaje", () => {
    const { container } = render(
      <IndicadorSesion
        sesion={sesionNumerada({ risk_level: "high", alerts_count: 2, alert_origins: ["model", "event"], analysis_state: "unavailable" })}
      />
    );
    expect(container.textContent).not.toMatch(/índice|integridad|%|\d{2,3}/i);
  });
});
