import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sesionesService from "../services/sesionesService";
import { AnalisisSesionVista } from "../components/AnalisisSesion";
import { esperar, simularSesiones } from "../test/fabricas";
import { EXAMEN, entregadaHaceRato, ingresar, montar, rindiendo } from "../test/panel";

/**
 * El ritmo con que el panel pregunta por la lista mientras el docente lee una sesión, y que esa consulta no
 * vuelva a dibujar el detalle si no cambió nada. Con relojes falsos: cada espera es exacta.
 */

// El apartado del análisis, envuelto para contar cuántas veces se dibuja. Se dibuja igual que siempre.
vi.mock("../components/AnalisisSesion", async (original) => {
  const modulo = await original<typeof import("../components/AnalisisSesion")>();
  return { ...modulo, AnalisisSesionVista: vi.fn(modulo.AnalisisSesionVista) };
});

describe("El ritmo de la lista mientras se lee una sesión", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ingresar();
    vi.spyOn(sesionesService, "traerExamenes").mockResolvedValue([EXAMEN]);
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([]);
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue({
      state: "not_analyzed", reason: null, calculated_at: null, alerts: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("con una sesión cerrada hace rato, la lista se pide cada treinta segundos y no cada cinco", async () => {
    const traer = simularSesiones([entregadaHaceRato(), rindiendo]);
    montar("/panel?examen=1&sesion=5");
    await esperar();
    const alEntrar = traer.mock.calls.length;

    await esperar(25_000);
    expect(traer.mock.calls.length).toBe(alEntrar);

    await esperar(5_000);
    expect(traer.mock.calls.length).toBe(alEntrar + 1);
  });

  it("con una sesión abierta, la lista se sigue pidiendo cada cinco segundos", async () => {
    const traer = simularSesiones([entregadaHaceRato(), rindiendo]);
    montar("/panel?examen=1&sesion=6");
    await esperar();
    const alEntrar = traer.mock.calls.length;

    await esperar(5_000);
    expect(traer.mock.calls.length).toBe(alEntrar + 1);
    await esperar(5_000);
    expect(traer.mock.calls.length).toBe(alEntrar + 2);
  });

  it("al volver a la lista desde una sesión cerrada, la pide en el momento", async () => {
    const traer = simularSesiones([entregadaHaceRato(), rindiendo]);
    montar("/panel?examen=1&sesion=5", ["/panel?examen=1"]);
    await esperar();
    await esperar(10_000);
    const antes = traer.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Atrás del navegador" }));
    await esperar();
    expect(traer.mock.calls.length).toBe(antes + 1);
  });

  it("una respuesta igual de la lista no vuelve a dibujar el detalle", async () => {
    simularSesiones([entregadaHaceRato(), rindiendo]);
    montar("/panel?examen=1&sesion=5");
    await esperar();
    // Pasado el plazo del análisis, que redibuja el detalle una vez por su cuenta.
    await esperar(10_000);
    const dibujos = vi.mocked(AnalisisSesionVista).mock.calls.length;
    expect(dibujos).toBeGreaterThan(0);

    // Llega otra respuesta de la lista, igual a la anterior.
    const pedidos = vi.mocked(sesionesService.traerSesiones).mock.calls.length;
    await esperar(25_000);
    expect(vi.mocked(sesionesService.traerSesiones).mock.calls.length).toBe(pedidos + 1);
    expect(vi.mocked(AnalisisSesionVista).mock.calls.length).toBe(dibujos);
  });
});
