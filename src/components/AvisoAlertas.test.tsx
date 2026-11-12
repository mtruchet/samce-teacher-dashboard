import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Sesion } from "../services/sesionesService";
import { conAnalisis, sesionNumerada } from "../test/fabricas";
import { choquesConLasListas } from "../test/lenguaje";
import { AvisoAlertas } from "./AvisoAlertas";

/** Una sesión del examen con su análisis coherente: con nivel, una alerta; sin nivel, ninguna. */
const sesion = (id: number, risk_level: Sesion["risk_level"], student_name = `Alumno ${id}`) =>
  sesionNumerada({ id, student_name, ...conAnalisis(risk_level ?? null) });

const region = () => screen.getByRole("status");

describe("AvisoAlertas", () => {
  it("es una región viva que solo contiene la frase y no relee la lista", () => {
    render(<AvisoAlertas sesiones={[sesion(1, null)]} clave="3" />);
    expect(region()).toHaveAttribute("aria-atomic", "false");
    expect(region()).toHaveAttribute("aria-live", "polite");
    expect(region()).toHaveTextContent("");
  });

  it("no anuncia en la primera carga", () => {
    render(<AvisoAlertas sesiones={[sesion(1, "high")]} clave="3" />);
    expect(region()).toHaveTextContent("");
  });

  it("anuncia la alerta nueva de una sesión que ya estaba, una sola vez", () => {
    const { rerender } = render(<AvisoAlertas sesiones={[sesion(1, null, "Ana Gómez")]} clave="3" />);
    rerender(<AvisoAlertas sesiones={[sesion(1, "medium", "Ana Gómez")]} clave="3" />);
    expect(region()).toHaveTextContent("Nueva alerta en la sesión de Ana Gómez: riesgo medio.");
    rerender(<AvisoAlertas sesiones={[sesion(1, "medium", "Ana Gómez")]} clave="3" />);
    expect(region()).toHaveTextContent("Nueva alerta en la sesión de Ana Gómez: riesgo medio.");
  });

  it("anuncia la subida de nivel", () => {
    const { rerender } = render(<AvisoAlertas sesiones={[sesion(1, "low", "Ana Gómez")]} clave="3" />);
    rerender(<AvisoAlertas sesiones={[sesion(1, "high", "Ana Gómez")]} clave="3" />);
    expect(region()).toHaveTextContent("Nueva alerta en la sesión de Ana Gómez: riesgo alto.");
  });

  it("las frases del anuncio pasan las listas de las rondas", () => {
    const { rerender } = render(<AvisoAlertas sesiones={[sesion(1, null, "Ana Gómez"), sesion(2, null)]} clave="3" />);
    rerender(<AvisoAlertas sesiones={[sesion(1, "high", "Ana Gómez"), sesion(2, null)]} clave="3" />);
    const una = region().textContent ?? "";
    rerender(<AvisoAlertas sesiones={[sesion(1, "high", "Ana Gómez"), sesion(2, "low")]} clave="3" />);
    rerender(<AvisoAlertas sesiones={[sesion(1, "high", "Ana Gómez"), sesion(2, "low")]} clave="4" />);
    rerender(<AvisoAlertas sesiones={[sesion(1, "high", "Ana Gómez"), sesion(2, null), sesion(3, null)]} clave="4" />);
    rerender(<AvisoAlertas sesiones={[sesion(1, "high", "Ana Gómez"), sesion(2, "low"), sesion(3, "medium")]} clave="4" />);
    const varias = region().textContent ?? "";
    expect(una).toBe("Nueva alerta en la sesión de Ana Gómez: riesgo alto.");
    expect(varias).toBe("Nuevas alertas en 2 sesiones.");
    expect(choquesConLasListas([una, varias])).toEqual([]);
  });

  it("con varias en la misma vuelta dice cuántas", () => {
    const { rerender } = render(<AvisoAlertas sesiones={[sesion(1, null), sesion(2, null)]} clave="3" />);
    rerender(<AvisoAlertas sesiones={[sesion(1, "low"), sesion(2, "high")]} clave="3" />);
    expect(region()).toHaveTextContent("Nuevas alertas en 2 sesiones.");
  });

  it("una sesión que entra por pedir otra página solo se memoriza", () => {
    const { rerender } = render(<AvisoAlertas sesiones={[sesion(1, null)]} clave="3" />);
    rerender(<AvisoAlertas sesiones={[sesion(1, null), sesion(2, "high")]} clave="3" />);
    expect(region()).toHaveTextContent("");
  });

  it("al cambiar de examen no anuncia nada", () => {
    const { rerender } = render(<AvisoAlertas sesiones={[sesion(1, null)]} clave="3" />);
    rerender(<AvisoAlertas sesiones={[sesion(1, "high")]} clave="4" />);
    expect(region()).toHaveTextContent("");
  });

  it("con un backend que no manda los campos no anuncia nada ni falla", () => {
    const viejas = [sesionNumerada({ id: 1 }), sesionNumerada({ id: 2 })];
    const { rerender } = render(<AvisoAlertas sesiones={viejas} clave="3" />);
    rerender(<AvisoAlertas sesiones={[...viejas]} clave="3" />);
    expect(region()).toHaveTextContent("");
  });

  it("un segundo anuncio con el mismo texto va en un nodo nuevo, para que el lector lo lea", () => {
    const { rerender } = render(<AvisoAlertas sesiones={[sesion(1, null), sesion(2, null), sesion(3, null), sesion(4, null)]} clave="3" />);
    rerender(<AvisoAlertas sesiones={[sesion(1, "low"), sesion(2, "low"), sesion(3, null), sesion(4, null)]} clave="3" />);
    const primero = region().firstElementChild;
    expect(primero).toHaveTextContent("Nuevas alertas en 2 sesiones.");
    rerender(<AvisoAlertas sesiones={[sesion(1, "low"), sesion(2, "low"), sesion(3, "low"), sesion(4, "low")]} clave="3" />);
    const segundo = region().firstElementChild;
    expect(segundo).toHaveTextContent("Nuevas alertas en 2 sesiones.");
    expect(segundo).not.toBe(primero);
  });

  it("una vuelta sin novedades no vuelve a escribir el anuncio", () => {
    const { rerender } = render(<AvisoAlertas sesiones={[sesion(1, null)]} clave="3" />);
    rerender(<AvisoAlertas sesiones={[sesion(1, "medium")]} clave="3" />);
    const antes = region().firstElementChild;
    rerender(<AvisoAlertas sesiones={[sesion(1, "medium")]} clave="3" />);
    expect(region().firstElementChild).toBe(antes);
  });
});
