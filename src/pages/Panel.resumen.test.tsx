import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sesionesService from "../services/sesionesService";
import { conAnalisis, esperar, pagina, resumen, simularSesiones } from "../test/fabricas";
import { expectLenguajeLlano } from "../test/lenguaje";
import { EXAMEN, direccion, ingresar, montar, rindiendo, ultimoPedido } from "../test/panel";

/**
 * El resumen de la evaluación dentro del panel (HU03_T03): cada tarjeta es un camino al mismo filtro que la
 * barra, se refleja con el selector y deja a la vista «N de M sesiones» y «Quitar filtros».
 */

const RESUMEN = resumen({ risk_high: 1, no_alerts: 1 });
const resultado = () => document.querySelector(".control__resultado");

describe("HU03_T03 (pendiente 10): el resumen de la evaluación en el panel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ingresar();
    vi.spyOn(sesionesService, "traerExamenes").mockResolvedValue([EXAMEN]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("va en la misma lámina que la barra de filtros, y una tarjeta de nivel filtra y se refleja en el selector", async () => {
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([rindiendo], 2, RESUMEN));
    montar("/panel?examen=1");
    await esperar();
    const control = document.querySelector(".lamina.control")!;
    expect(control).toContainElement(screen.getByRole("heading", { name: "Resumen de la evaluación" }));
    expect(control).toContainElement(screen.getByLabelText("Nivel de riesgo"));

    fireEvent.click(screen.getByRole("button", { name: "Riesgo alto: 1 sesión" }));
    await esperar();
    expect(ultimoPedido()).toEqual(expect.objectContaining({ nivel: "high" }));
    expect(screen.getByLabelText("Nivel de riesgo")).toHaveValue("high");
    expect(screen.getByRole("button", { name: "Riesgo alto: 1 sesión" })).toHaveAttribute("aria-pressed", "true");
  });

  it("elegir un nivel en el selector marca su tarjeta", async () => {
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([rindiendo], 2, RESUMEN));
    montar("/panel?examen=1");
    await esperar();
    fireEvent.change(screen.getByLabelText("Nivel de riesgo"), { target: { value: "medium" } });
    await esperar();
    expect(screen.getByRole("button", { name: "Riesgo medio: 0 sesiones" })).toHaveAttribute("aria-pressed", "true");
  });

  it("una tarjeta de estado pide por el estado del análisis y muestra «N de M sesiones»", async () => {
    const traer = vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([rindiendo], 1, RESUMEN));
    montar("/panel?examen=1");
    await esperar();
    fireEvent.click(screen.getByRole("button", { name: "Sin alertas: 1 sesión" }));
    await esperar();
    expect(traer).toHaveBeenLastCalledWith(1, 50, expect.objectContaining({ analisis: "no_alerts", nivel: undefined }));
    expect(direccion().get("analisis")).toBe("no_alerts");
    expect(resultado()).toHaveTextContent("1 de 2 sesiones");
    // El selector de nivel dice «Todos»: el estado del análisis no es un nivel.
    expect(screen.getByLabelText("Nivel de riesgo")).toHaveValue("");
  });

  it("M sale del resumen de la misma respuesta, no de los recuentos de la ficha del examen, y lleva el punto de los miles", async () => {
    // La ficha del examen cuenta otra cosa (un pedido anterior): M tiene que coincidir con las tarjetas de arriba.
    const grande = resumen({ total: 1245, risk_high: 1000, no_alerts: 245 });
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([rindiendo], 1000, grande));
    montar("/panel?examen=1&nivel=high");
    await esperar();
    expect(resultado()).toHaveTextContent("1.000 de 1.245 sesiones");
    expect(screen.getByRole("button", { name: "Riesgo alto: 1.000 sesiones" })).toBeInTheDocument();
  });

  it("con «Sin alertas» elegido, elegir «Riesgo alto» en la barra pide solo el nivel", async () => {
    const traer = vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([rindiendo], 1, RESUMEN));
    montar("/panel?examen=1&analisis=no_alerts");
    await esperar();
    fireEvent.change(screen.getByLabelText("Nivel de riesgo"), { target: { value: "high" } });
    await esperar();
    expect(traer).toHaveBeenLastCalledWith(1, 50, expect.objectContaining({ nivel: "high", analisis: undefined }));
    expect(direccion().get("analisis")).toBeNull();
    expect(screen.getByRole("button", { name: "Sin alertas: 1 sesión" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Riesgo alto: 1 sesión" })).toHaveAttribute("aria-pressed", "true");
    // Nunca salen los dos juntos en un pedido.
    for (const [, , filtros] of traer.mock.calls) expect(Boolean(filtros?.nivel && filtros?.analisis)).toBe(false);
  });

  it("tocar una tarjeta sin marcar deja solo su filtro, así la cifra coincide con la tarjeta", async () => {
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([rindiendo], 1, RESUMEN));
    montar("/panel?examen=1&estado=open&q=bru&orden=risk_level");
    await esperar();
    fireEvent.click(screen.getByRole("button", { name: "Riesgo alto: 1 sesión" }));
    await esperar();
    expect(direccion().toString()).toBe("examen=1&nivel=high&orden=risk_level");
  });

  it("tocar la tarjeta marcada borra solo su filtro", async () => {
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([rindiendo], 1, RESUMEN));
    montar("/panel?examen=1&nivel=high&q=bru&orden=risk_level");
    await esperar();
    const alto = screen.getByRole("button", { name: "Riesgo alto: 1 sesión" });
    // Marcada aunque haya también una búsqueda: el selector y la tarjeta dicen lo mismo.
    expect(alto).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(alto);
    await esperar();
    expect(direccion().toString()).toBe("examen=1&q=bru&orden=risk_level");

    fireEvent.click(screen.getByRole("button", { name: "Sin alertas: 1 sesión" }));
    await esperar();
    fireEvent.click(screen.getByRole("button", { name: "Sin alertas: 1 sesión" }));
    await esperar();
    expect(direccion().toString()).toBe("examen=1&orden=risk_level");
  });

  it("«Quitar filtros» está a la vista con una tarjeta elegida, y la borra", async () => {
    const traer = vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([rindiendo], 1, RESUMEN));
    montar("/panel?examen=1&analisis=not_analyzed");
    await esperar();
    expect(screen.getAllByRole("button", { name: "Quitar filtros" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Quitar filtros" }));
    await esperar();
    expect(direccion().get("analisis")).toBeNull();
    expect(traer).toHaveBeenLastCalledWith(1, 50, expect.objectContaining({ analisis: undefined }));
    expect(screen.queryByRole("button", { name: "Quitar filtros" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sin analizar: 0 sesiones" })).toHaveAttribute("aria-pressed", "false");
  });

  it("una vuelta con otros números no cambia ninguna región viva", async () => {
    const traer = vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([rindiendo], 1, RESUMEN));
    montar("/panel?examen=1&nivel=high");
    await esperar();
    const antes = screen.getAllByRole("status").map((r) => [r, r.innerHTML] as const);

    traer.mockResolvedValue(pagina([rindiendo], 1, resumen({ risk_high: 4, risk_low: 2, no_alerts: 9 })));
    await esperar(sesionesService.CADENCIA_MS);
    expect(screen.getByRole("button", { name: "Riesgo alto: 4 sesiones" })).toBeInTheDocument();
    const despues = screen.getAllByRole("status");
    expect(despues).toHaveLength(antes.length);
    for (const [region, contenido] of antes) expect(region.innerHTML).toBe(contenido);
  });

  it("con un backend sin el resumen no se dibuja, y la barra sigue en su lámina", async () => {
    simularSesiones([rindiendo]);
    montar("/panel?examen=1");
    await esperar();
    expect(screen.queryByRole("heading", { name: "Resumen de la evaluación" })).toBeNull();
    expect(document.querySelector(".lamina.control")).toContainElement(screen.getByLabelText("Nivel de riesgo"));
  });

  it("los textos del resumen y de la barra están en lenguaje llano", async () => {
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(
      pagina([{ ...rindiendo, ...conAnalisis("high") }], 1, resumen({ risk_high: 1, risk_medium: 2, risk_low: 3, not_analyzed: 1 }))
    );
    montar("/panel?examen=1&nivel=high");
    await esperar();
    expectLenguajeLlano(document.querySelector(".control")!);
  });
});
