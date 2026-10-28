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
    level_since: "2026-10-23T14:10:00.000Z",
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
    const { container } = render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText("La sesión se analizó y no tiene alertas.")).toBeInTheDocument();
    expect(screen.getByText(/último cálculo a las/)).toBeInTheDocument();
    const hora = container.querySelector(".analisis__calculo time") as HTMLTimeElement;
    expect(hora.dateTime).toBe(CALCULO);
    expect(hora).toHaveTextContent(horaExacta(CALCULO));
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
    expect(alertas[0]).toHaveTextContent("Su comportamiento se parece al de menos del 1 % de las sesiones esperadas.");
    expect(alertas[0]).not.toHaveTextContent(/índice/i);
    expect(within(alertas[1]).getByText("Nivel alto")).toBeInTheDocument();
    // «Nivel X desde las HH:MM»: la hora en que la alerta llegó a ese nivel, aparte del nivel.
    const desde = alertas[0].querySelector(".analisis__desde") as HTMLElement;
    expect(desde).toHaveTextContent("desde las");
    const hora = desde.querySelector("time") as HTMLTimeElement;
    expect(hora.dateTime).toBe("2026-10-23T14:10:00.000Z");
    expect(hora).toHaveTextContent(horaExacta("2026-10-23T14:10:00.000Z"));
    expect(within(alertas[1]).getByText("Por un solo hecho puntual")).toBeInTheDocument();
    expect(alertas[1]).toHaveTextContent("Se pegó un bloque de 4.370 caracteres");
  });

  it("ordena la explicación: titular, variables en una tabla y la aclaración al final, discreta", async () => {
    const texto = [
      "Esta sesión se aparta levemente de lo habitual.",
      "Menos del 5 % de las sesiones esperadas llega a comportarse así.",
      "Lo que más pesó:",
      "• Mayor tiempo sin recibir datos del examen: 45 segundos (lo esperado: 20 segundos)",
      "• Velocidad de tecleo máxima: 10,8 caracteres por segundo (lo esperado: 5,6 caracteres por segundo)",
      "Esto describe lo observado y no atribuye intención: la revisión es del docente.",
    ].join("\n");
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({ alerts: [alerta({ level: "low", explanation: texto })] })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText("Esta sesión se aparta levemente de lo habitual.")).toBeInTheDocument();
    expect(screen.getByText(/Menos del 5 % de las sesiones esperadas/)).toBeInTheDocument();
    expect(screen.queryByText(/índice/i)).not.toBeInTheDocument();
    const tabla = screen.getByRole("table");
    expect(within(tabla).getAllByRole("columnheader").map((c) => c.textContent)).toEqual([
      "Qué se midió", "En el momento más marcado", "Lo esperado",
    ]);
    const filas = within(tabla).getAllByRole("row").slice(1);
    expect(filas).toHaveLength(2);
    expect(within(filas[0]).getByRole("rowheader")).toHaveTextContent("Mayor tiempo sin recibir datos del examen");
    expect(within(filas[0]).getAllByRole("cell").map((c) => c.textContent)).toEqual(["45 segundos", "20 segundos"]);
    expect(within(filas[1]).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "10,8 caracteres por segundo", "5,6 caracteres por segundo",
    ]);
    // La aclaración está una sola vez y no se repite como nota general.
    expect(screen.getAllByText(/no atribuye intención/)).toHaveLength(1);
    expect(screen.queryByText(/no es una conclusión sobre el alumno/)).not.toBeInTheDocument();
    // Ya no se lee como un párrafo corrido: no queda ningún signo de viñeta suelto.
    expect(screen.queryByText(/•/)).not.toBeInTheDocument();
  });

  it("una alerta de evento no tiene tabla: titular, aclaración y cierre", async () => {
    const texto = [
      "Se pegó un bloque de 4.370 caracteres en una respuesta en la que no se había escrito nada antes.",
      "En las sesiones esperadas, el pegado más largo no pasó de 90 caracteres.",
      "Esto describe lo observado y no atribuye intención: la revisión es del docente.",
    ].join("\n");
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({ alerts: [alerta({ origin: "event", level: "high", explanation: texto })] })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText(/Se pegó un bloque de 4.370 caracteres/)).toBeInTheDocument();
    expect(screen.getByText(/no pasó de 90 caracteres/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("una alerta guardada con el formato viejo, en un párrafo, se lee entera y la aclaración general no falta", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({
        alerts: [alerta({
          explanation: "El índice de la sesión es 60 de 100: su comportamiento se parece al de menos del 1 % de las sesiones esperadas.",
        })],
      })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    const texto = screen.getByText(/Su comportamiento se parece al de menos del 1 %/);
    expect(texto).toBeInTheDocument();
    // Sin estructura no hay titular: se muestra como texto común y no en grande y en negrita.
    expect(texto).not.toHaveClass("analisis__titular");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText(/no es una conclusión sobre el alumno/)).toBeInTheDocument();
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

    expect(screen.getByText(/El análisis del comportamiento de toda la sesión no está disponible, pero se detectó lo siguiente/)).toBeInTheDocument();
    expect(screen.queryByText(/No hay un modelo cargado/)).not.toBeInTheDocument();
    expect(screen.getByText(/Se pegó un bloque de 250 caracteres/)).toBeInTheDocument();
  });

  it("sin evidencia suficiente pero con una alerta de un solo evento, dice qué falta y que igual se detectó algo", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({
        state: "insufficient_evidence",
        reason: "Hay muy poca actividad registrada para analizar la sesión.",
        alerts: [alerta({ origin: "event", level: "high", explanation: "Se pegó un bloque de 4.370 caracteres." })],
      })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText(/No hay actividad suficiente para analizar el comportamiento de toda la sesión, pero se detectó lo siguiente/)).toBeInTheDocument();
    expect(screen.queryByText(/Hay muy poca actividad registrada/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No hay evidencia suficiente para analizar esta sesión/)).not.toBeInTheDocument();
    expect(screen.getByText(/Se pegó un bloque de 4.370 caracteres/)).toBeInTheDocument();
  });

  it("no disponible y sin alertas dice solo que no está disponible por ahora, sin el motivo técnico", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({ state: "unavailable", reason: "No hay un modelo cargado: MODEL_PATH no está configurado." })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText("El análisis de esta sesión no está disponible por ahora.")).toBeInTheDocument();
    expect(screen.queryByText(/MODEL_PATH|modelo cargado/)).not.toBeInTheDocument();
  });

  it("no muestra el índice de integridad ni las métricas, aunque el servidor los mandara", async () => {
    const conDeMas = {
      ...analisis({ alerts: [alerta({ explanation: "Su índice es 38,5 de 100: menos del 1 % de las sesiones esperadas se comporta así." })] }),
      index: 38.5, integrity_index: 38.5, variables: { largest_paste_chars: 1240 },
    };
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
    // La alerta nueva queda dentro de la región viva con nombre, para que un lector de pantalla la anuncie.
    const region = screen.getByRole("status", { name: "Alertas de la sesión" });
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(within(region).getByText("Nivel alto")).toBeInTheDocument();
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
