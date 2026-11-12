import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sesionesService from "../services/sesionesService";
import { conAnalisis, esperar, pagina } from "../test/fabricas";
import { EXAMEN, ingresar, montar, rindiendo } from "../test/panel";

/**
 * Criterio 2 de HU03: una alerta nueva aparece en la lista en la vuelta siguiente de la actualización
 * automática, sin recargar ni volver a montar la pantalla, y se anuncia a los lectores de pantalla. Hasta
 * ahora solo lo recorría a mano el caso CP28.
 */
describe("Una alerta nueva en la lista de sesiones", () => {
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
});
