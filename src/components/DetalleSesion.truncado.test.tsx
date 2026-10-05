import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sesionesService from "../services/sesionesService";
import { esperar, evento, sesionNumerada } from "../test/fabricas";
import { DetalleSesion } from "./DetalleSesion";

/**
 * La paginación del registro, con páginas de tres eventos.
 *
 * Con el tamaño real (mil por página) llegar al tope son veinte mil filas
 * pintadas. Achicar la página exige mockear el módulo del servicio entero, y
 * por eso va en su propio archivo: vitest aísla los mocks de módulo por archivo.
 */
vi.mock("../services/sesionesService", async (original) => ({
  ...(await original<typeof import("../services/sesionesService")>()),
  EVENTOS_POR_PAGINA: 3,
  traerEventos: vi.fn(),
}));

const POR_PAGINA = 3;
const traer = vi.mocked(sesionesService.traerEventos);
const pagina = (desde: number, cuantos = POR_PAGINA) =>
  Array.from({ length: cuantos }, (_, i) => evento(desde + i, "mouse_enter"));

describe("DetalleSesion, la paginación del registro", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    traer.mockReset();
  });

  it("avisa cuando la sesión tiene más eventos de los que el panel muestra de una vez", async () => {
    let vuelta = 0;
    traer.mockImplementation(async () => pagina(vuelta++ * POR_PAGINA + 1));

    render(<DetalleSesion sesion={sesionNumerada()} onVencida={() => undefined} />);
    await esperar();

    expect(screen.getByText(/todavía falta lo más reciente/)).toBeInTheDocument();
  });

  // Si el cursor avanzara página por página y la segunda fallara, la vuelta
  // siguiente pediría desde un punto adelantado sobre eventos que nunca se
  // mostraron, y ese tramo no aparecería nunca más.
  it("si una página falla a mitad de la paginación, el reintento no se saltea lo que faltaba", async () => {
    traer
      // Primera consulta: la página 1 viene llena y la 2 se cae.
      .mockResolvedValueOnce(pagina(1))
      .mockRejectedValueOnce(new Error("sin red"))
      // Segunda: sale bien, y tiene que volver a pedir desde el principio.
      .mockResolvedValueOnce(pagina(1))
      .mockResolvedValueOnce(pagina(POR_PAGINA + 1, 1));

    render(<DetalleSesion sesion={sesionNumerada()} onVencida={() => undefined} />);
    await esperar();
    await esperar(5000);

    expect(traer.mock.calls.map((c) => c[2])).toEqual([0, POR_PAGINA, 0, POR_PAGINA]);
    const encabezado = screen.getByRole("heading", { name: "Registro de eventos" }).parentElement!;
    expect(within(encabezado).getByText(String(POR_PAGINA + 1))).toBeInTheDocument();
  });
});
