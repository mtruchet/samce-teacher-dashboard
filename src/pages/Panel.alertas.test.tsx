import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sesionesService from "../services/sesionesService";
import { conAnalisis, esperar, pagina } from "../test/fabricas";
import { EXAMEN, ingresar, montar, rindiendo } from "../test/panel";

/** La región viva del anuncio de alertas, si dice algo. */
const anuncioDeAlertas = () => screen.queryAllByRole("status").find((r) => /Nuevas? alertas?/.test(r.textContent ?? ""));

/**
 * Pendiente 10, HU03_T02. Criterio 2 de HU03: una alerta nueva aparece en la lista en la vuelta siguiente de la actualización
 * automática, sin recargar ni volver a montar la pantalla, y se anuncia a los lectores de pantalla. Hasta
 * ahora solo lo recorría a mano el caso CP28.
 */
describe("HU03_T02 (pendiente 10): una alerta nueva en la lista de sesiones", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ingresar();
    vi.spyOn(sesionesService, "traerExamenes").mockResolvedValue([{ ...EXAMEN, closed_sessions: 0 }]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("aparece en la vuelta siguiente, sin volver a montar, y se anuncia una vez", async () => {
    const traer = vi
      .spyOn(sesionesService, "traerSesiones")
      .mockResolvedValueOnce(pagina([{ ...rindiendo, ...conAnalisis(null) }]))
      .mockResolvedValue(pagina([{ ...rindiendo, ...conAnalisis("medium", ["event"]) }]));
    montar("/panel?examen=1");
    await esperar();

    const fila = () => screen.getByRole("row", { name: /Bruno Pérez/ });
    expect(within(fila()).getByText("Sin alertas")).toBeInTheDocument();
    const tabla = screen.getByRole("table");
    const anuncio = () => screen.getAllByRole("status").find((r) => /Nueva alerta/.test(r.textContent ?? ""));
    expect(anuncio()).toBeUndefined();

    await esperar(sesionesService.CADENCIA_MS);
    expect(traer).toHaveBeenCalledTimes(2);
    // La misma tabla, no una montada de nuevo.
    expect(screen.getByRole("table")).toBe(tabla);
    expect(within(fila()).getByText("Riesgo medio")).toBeInTheDocument();
    expect(within(fila()).getByText("1 alerta: en un momento de la sesión")).toBeInTheDocument();
    expect(anuncio()).toHaveTextContent("Nueva alerta en la sesión de Bruno Pérez: riesgo medio.");

    // La vuelta siguiente, sin cambios, no vuelve a anunciar.
    const nodo = anuncio()!.firstElementChild;
    await esperar(sesionesService.CADENCIA_MS);
    expect(anuncio()!.firstElementChild).toBe(nodo);
  });

  // Las dos pruebas del anuncio con filtros (HU04_T02 §4.1, P14): una sesión que entra a la lista por un
  // cambio de filtro no es una alerta nueva, aunque ya tuviera una.
  it("HU04_T02 P14: quitar un filtro no anuncia nada", async () => {
    // Con «En curso», Bruno se ve sin alertas; sin el filtro, la respuesta trae a Bruno en riesgo medio.
    vi.spyOn(sesionesService, "traerSesiones").mockImplementation(async (_examen, _limite, filtros = {}) =>
      filtros.estado === "open"
        ? pagina([{ ...rindiendo, ...conAnalisis(null) }], 1)
        : pagina([{ ...rindiendo, ...conAnalisis("medium", ["event"]) }], 1)
    );
    montar("/panel?examen=1&estado=open");
    await esperar();
    expect(within(screen.getByRole("row", { name: /Bruno Pérez/ })).getByText("Sin alertas")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Quitar filtros" }));
    await esperar();
    expect(within(screen.getByRole("row", { name: /Bruno Pérez/ })).getByText("Riesgo medio")).toBeInTheDocument();
    expect(anuncioDeAlertas()).toBeUndefined();

    // Y la vuelta siguiente, ya sin filtro y sin cambios, tampoco.
    await esperar(sesionesService.CADENCIA_MS);
    expect(anuncioDeAlertas()).toBeUndefined();
  });

  it("HU04_T02 P14: con un filtro de nivel activo, la sesión que entra al subir de nivel no se anuncia", async () => {
    vi.spyOn(sesionesService, "traerSesiones")
      .mockResolvedValueOnce(pagina([], 0))
      .mockResolvedValue(pagina([{ ...rindiendo, ...conAnalisis("high", ["model"]) }], 1));
    montar("/panel?examen=1&nivel=high");
    await esperar();
    expect(screen.queryByRole("row", { name: /Bruno Pérez/ })).toBeNull();

    await esperar(sesionesService.CADENCIA_MS);
    expect(within(screen.getByRole("row", { name: /Bruno Pérez/ })).getByText("Riesgo alto")).toBeInTheDocument();
    expect(anuncioDeAlertas()).toBeUndefined();
  });
});
