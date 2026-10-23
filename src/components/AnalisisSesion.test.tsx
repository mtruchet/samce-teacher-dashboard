import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sesionesService from "../services/sesionesService";
import type { AlertaDeSesion, Analisis } from "../services/sesionesService";
import { esperar, sesionNumerada } from "../test/fabricas";
import { horaExacta } from "../eventos";
import { AnalisisSesion } from "./AnalisisSesion";

const nada = () => undefined;
const CALCULO = "2026-10-23T14:30:05.123Z";

function analisis(cambios: Partial<Analisis> = {}): Analisis {
  return { state: "analyzed", reason: null, calculated_at: CALCULO, alerts: [], ...cambios };
}

function alerta(cambios: Partial<AlertaDeSesion> = {}): AlertaDeSesion {
  return {
    origin: "model",
    level: "medium",
    explanation: "El índice de la sesión es 60 de 100: su comportamiento se parece al de menos del 1 % de las sesiones esperadas.",
    created_at: "2026-10-23T14:00:00.000Z",
    updated_at: CALCULO,
    ...cambios,
  };
}

describe("AnalisisSesion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("pide el análisis de la sesión del examen y lo muestra aparte, con su título", async () => {
    const traer = vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(analisis());
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(traer).toHaveBeenCalledWith(3, 7);
    expect(screen.getByRole("heading", { name: "Análisis de la sesión" })).toBeInTheDocument();
  });

  it("mientras llega la primera respuesta lo dice, y no afirma que no hay alertas", () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockReturnValue(new Promise(() => undefined));
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);

    expect(screen.getByText("Cargando el análisis…")).toBeInTheDocument();
    expect(screen.queryByText(/no tiene alertas/)).not.toBeInTheDocument();
  });

  it("una sesión que todavía no se analizó lo dice, sin hora de cálculo", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(analisis({ state: "not_analyzed", calculated_at: null }));
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText("Todavía no se analizó esta sesión.")).toBeInTheDocument();
    expect(screen.queryByText(/último cálculo/)).not.toBeInTheDocument();
  });

  it("una sesión analizada sin alertas dice que no tiene, con la hora del último cálculo", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(analisis());
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText("La sesión se analizó y no tiene alertas.")).toBeInTheDocument();
    expect(screen.getByText(`último cálculo a las ${horaExacta(CALCULO)}`)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("muestra cada alerta con su nivel escrito y su explicación", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({
        alerts: [
          alerta(),
          alerta({ origin: "event", level: "high", explanation: "Se pegó un bloque de 4.370 caracteres en una respuesta con 5 caracteres escritos antes." }),
        ],
      })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText("La sesión se analizó y tiene alertas.")).toBeInTheDocument();
    const alertas = screen.getAllByRole("listitem");
    expect(alertas).toHaveLength(2);
    // El nivel va escrito, no solo en el color.
    expect(within(alertas[0]).getByText("Nivel medio")).toBeInTheDocument();
    expect(within(alertas[0]).getByText("Por el comportamiento de toda la sesión")).toBeInTheDocument();
    expect(alertas[0]).toHaveTextContent("El índice de la sesión es 60 de 100");
    expect(within(alertas[1]).getByText("Nivel alto")).toBeInTheDocument();
    expect(within(alertas[1]).getByText("Por un solo hecho puntual")).toBeInTheDocument();
    expect(alertas[1]).toHaveTextContent("Se pegó un bloque de 4.370 caracteres");
  });

  it("cada nivel se nombra: bajo, medio y alto", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(analisis({ alerts: [alerta({ level: "low" })] }));
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();
    expect(screen.getByText("Nivel bajo")).toBeInTheDocument();
  });

  it("aclara que una alerta es algo para revisar y no una conclusión sobre el alumno", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(analisis({ alerts: [alerta()] }));
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText(/no es una conclusión sobre el alumno/)).toBeInTheDocument();
  });

  it("sin evidencia suficiente lo dice con su motivo", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({ state: "insufficient_evidence", reason: "Hay muy poca actividad registrada para analizar la sesión." })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText(/No hay evidencia suficiente para analizar esta sesión/)).toBeInTheDocument();
    expect(screen.getByText(/Hay muy poca actividad registrada/)).toBeInTheDocument();
    expect(screen.queryByText(/no tiene alertas/)).not.toBeInTheDocument();
  });

  it("si el análisis no está disponible lo dice, y la alerta de un solo evento se sigue mostrando", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({
        state: "unavailable",
        reason: "No hay un modelo cargado.",
        alerts: [alerta({ origin: "event", level: "low", explanation: "Se pegó un bloque de 250 caracteres." })],
      })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText(/El análisis de esta sesión no está disponible/)).toBeInTheDocument();
    expect(screen.getByText(/No hay un modelo cargado/)).toBeInTheDocument();
    expect(screen.getByText(/Se pegó un bloque de 250 caracteres/)).toBeInTheDocument();
  });

  it("no muestra el índice de integridad ni las métricas, aunque el servidor los mandara", async () => {
    const conDeMas = { ...analisis({ alerts: [alerta()] }), index: 38.5, integrity_index: 38.5, variables: { largest_paste_chars: 1240 } };
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(conDeMas as Analisis);
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.queryByText(/38[,.]5/)).not.toBeInTheDocument();
    expect(screen.queryByText(/largest_paste_chars/)).not.toBeInTheDocument();
    expect(screen.queryByText(/historial|cronolog/i)).not.toBeInTheDocument();
  });

  it("con la sesión abierta vuelve a preguntar y una alerta aparece o sube de nivel mientras se mira", async () => {
    const traer = vi.spyOn(sesionesService, "traerAnalisis");
    traer.mockResolvedValueOnce(analisis());
    render(<AnalisisSesion sesion={sesionNumerada({ status: "open" })} onVencida={nada} />);
    await esperar();
    expect(screen.getByText("La sesión se analizó y no tiene alertas.")).toBeInTheDocument();

    traer.mockResolvedValueOnce(analisis({ alerts: [alerta({ level: "low" })] }));
    await esperar(sesionesService.CADENCIA_MS);
    expect(screen.getByText("Nivel bajo")).toBeInTheDocument();

    traer.mockResolvedValue(analisis({ alerts: [alerta({ level: "high" })] }));
    await esperar(sesionesService.CADENCIA_MS);
    expect(screen.getByText("Nivel alto")).toBeInTheDocument();
    expect(screen.queryByText("Nivel bajo")).not.toBeInTheDocument();
  });

  it("una sesión entregada hace mucho no sigue preguntando", async () => {
    const traer = vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(analisis());
    const entregada = sesionNumerada({ status: "closed", closed_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
    render(<AnalisisSesion sesion={entregada} onVencida={nada} />);
    await esperar();
    await esperar(60_000);

    expect(traer).toHaveBeenCalledTimes(1);
  });

  it("una sesión recién entregada sigue preguntando unos minutos, por lo que llega tarde", async () => {
    const traer = vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(analisis());
    const recien = sesionNumerada({ status: "closed", closed_at: new Date(Date.now() - 60 * 1000).toISOString() });
    render(<AnalisisSesion sesion={recien} onVencida={nada} />);
    await esperar();
    await esperar(sesionesService.CADENCIA_MS);

    expect(traer.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("si falla la primera consulta no dice que no hay alertas", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockRejectedValue(new Error("sin red"));
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText("No se pudo traer el análisis de esta sesión.")).toBeInTheDocument();
    expect(screen.queryByText(/no tiene alertas/)).not.toBeInTheDocument();
    expect(screen.queryByText("Cargando el análisis…")).not.toBeInTheDocument();
  });

  it("si falla una consulta posterior conserva lo último que llegó y lo avisa", async () => {
    const traer = vi.spyOn(sesionesService, "traerAnalisis");
    traer.mockResolvedValueOnce(analisis({ alerts: [alerta()] }));
    render(<AnalisisSesion sesion={sesionNumerada({ status: "open" })} onVencida={nada} />);
    await esperar();

    traer.mockRejectedValue(new Error("sin red"));
    await esperar(sesionesService.CADENCIA_MS);

    expect(screen.getByText("No se pudo actualizar el análisis. Lo que se ve es lo último que llegó.")).toBeInTheDocument();
    expect(screen.getByText("Nivel medio")).toBeInTheDocument();

    traer.mockResolvedValue(analisis());
    await esperar(sesionesService.CADENCIA_MS);
    expect(screen.queryByText(/No se pudo actualizar/)).not.toBeInTheDocument();
  });

  it("si el token venció avisa al panel y deja de preguntar", async () => {
    const traer = vi.spyOn(sesionesService, "traerAnalisis").mockRejectedValue(new sesionesService.SesionVencida());
    const alVencer = vi.fn();
    render(<AnalisisSesion sesion={sesionNumerada({ status: "open" })} onVencida={alVencer} />);
    await esperar();
    await esperar(sesionesService.CADENCIA_MS * 3);

    expect(alVencer).toHaveBeenCalledTimes(1);
    expect(traer).toHaveBeenCalledTimes(1);
  });
});
