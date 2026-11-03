import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sesionesService from "../services/sesionesService";
import type { AlertaDeSesion, Analisis } from "../services/sesionesService";
import { esperar, sesionNumerada } from "../test/fabricas";
import { horaCorta } from "../eventos";
import { AnalisisSesion } from "./AnalisisSesion";

const nada = () => undefined;
const CALCULO = "2026-10-23T14:30:05.123Z";
/** Una entrega de hace una hora: el apartado ya no vuelve a preguntar. */
const HACE_RATO = new Date(Date.now() - 60 * 60 * 1000).toISOString();

/*
 * Las explicaciones reales de la sesión 453 del «Segundo Parcial (réplica del campus)», tal como las
 * guarda la base, y la de la sesión en conjunto de la 454.
 */
const MODELO_453 = [
  "Esta sesión se aparta levemente de lo habitual.",
  "Menos del 5 % de las sesiones esperadas llega a comportarse así.",
  "Lo que más pesó:",
  "• Pegado más largo: 301 caracteres (lo esperado: 0 caracteres)",
  "• Pegados por pregunta: 0,2 pegados por pregunta (lo esperado: 0 pegados por pregunta)",
  "• Tiempo habitual en una pregunta: 176 segundos (lo esperado: 67,8 segundos)",
  "Esto describe lo observado y no atribuye intención: la revisión es del docente.",
].join("\n");
const EVENTO_453 = [
  "Se pegó un bloque de 301 caracteres en una respuesta en la que no se había escrito nada antes.",
  "En el 99 % de las sesiones esperadas, ningún pegado sin escritura previa pasó de 241 caracteres.",
  "Esto describe lo observado y no atribuye intención: la revisión es del docente.",
].join("\n");
const MODELO_454 = [
  "Esta sesión se aparta mucho de lo habitual.",
  "Menos del 0,2 % de las sesiones esperadas llega a comportarse así.",
  "Lo que más pesó:",
  "• Proporción del tiempo fuera del examen: 28,8 % (lo esperado: 0 %)",
  "• Salidas a otra aplicación por minuto: 0,61 salidas por minuto (lo esperado: 0 salidas por minuto)",
  "• Salida más larga del examen: 45 segundos (lo esperado: 0 segundos)",
  "Esto describe lo observado y no atribuye intención: la revisión es del docente.",
].join("\n");

/** El resumen de arriba del apartado. */
function resumen(): HTMLElement {
  return document.querySelector(".resumen") as HTMLElement;
}

/** Las tarjetas de las alertas, en el orden en que se muestran. */
function tarjetasDeAlerta(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".analisis__alerta"));
}

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

  it("una sesión que todavía no se analizó lo dice, sin hora del análisis", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(analisis({ state: "not_analyzed", calculated_at: null }));
    render(<AnalisisSesion sesion={sesionNumerada({ status: "closed", closed_at: HACE_RATO })} onVencida={nada} />);
    await esperar();

    expect(screen.getByText("Esta sesión todavía no se analizó.")).toBeInTheDocument();
    expect(screen.queryByText(/Analizada por última vez/)).not.toBeInTheDocument();
    expect(screen.queryByText(/El análisis se hace solo/)).not.toBeInTheDocument();
  });

  it("con la sesión abierta y sin analizar, dice que el análisis se hace solo", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(analisis({ state: "not_analyzed", calculated_at: null }));
    render(<AnalisisSesion sesion={sesionNumerada({ status: "open" })} onVencida={nada} />);
    await esperar();

    expect(screen.getByText(/El análisis se hace solo mientras el alumno rinde/)).toBeInTheDocument();
  });

  it("una sesión entregada sin alertas dice que no se encontró nada, con la hora del análisis sin segundos", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(analisis());
    const { container } = render(
      <AnalisisSesion sesion={sesionNumerada({ status: "closed", closed_at: HACE_RATO })} onVencida={nada} />
    );
    await esperar();

    expect(screen.getByText("No se encontró nada fuera de lo habitual.")).toBeInTheDocument();
    expect(screen.getByText("La sesión se analizó completa y no tiene alertas.")).toBeInTheDocument();
    const ultima = container.querySelector(".analisis__ultima") as HTMLElement;
    expect(ultima).toHaveTextContent(`Analizada por última vez a las ${horaCorta(CALCULO)}`);
    expect(ultima.querySelector("time")?.dateTime).toBe(CALCULO);
    expect(screen.queryByText(/cálculo/)).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    // Sin alertas no hay nota de apoyo: no hay nada que aclarar.
    expect(screen.queryByText(/la revisión es del docente/)).not.toBeInTheDocument();
  });

  it("con la sesión abierta y sin alertas dice «por ahora»", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(analisis());
    render(<AnalisisSesion sesion={sesionNumerada({ status: "open" })} onVencida={nada} />);
    await esperar();

    expect(screen.getByText("Por ahora no se encontró nada fuera de lo habitual.")).toBeInTheDocument();
    expect(screen.getByText("El análisis se repite solo mientras el alumno rinde.")).toBeInTheDocument();
  });

  it("con dos alertas dice cuántas hay y por qué, cada motivo enlazado a su tarjeta", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({ alerts: [alerta({ level: "low", explanation: MODELO_453 }), alerta({ origin: "event", level: "low", explanation: EVENTO_453 })] })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText("Hay 2 alertas para revisar.")).toBeInTheDocument();
    const enlaces = within(resumen()).getAllByRole("link");
    expect(enlaces.map((a) => a.textContent)).toEqual([
      "Por cómo se desarrolló la sesión en conjunto, sobre todo el pegado más largo",
      "Por un texto pegado de 301 caracteres",
    ]);
    const tarjetas = tarjetasDeAlerta();
    expect(enlaces[0]).toHaveAttribute("href", `#${tarjetas[0].id}`);
    expect(enlaces[1]).toHaveAttribute("href", `#${tarjetas[1].id}`);
  });

  it("seguir un motivo lleva el foco a su tarjeta", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({ alerts: [alerta({ level: "low", explanation: MODELO_453 }), alerta({ origin: "event", level: "low", explanation: EVENTO_453 })] })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    const [, segundo] = within(resumen()).getAllByRole("link");
    fireEvent.click(segundo);
    const tarjeta = tarjetasDeAlerta()[1];
    expect(tarjeta).toHaveFocus();
    expect(tarjeta).toHaveAttribute("tabindex", "-1");
  });

  it("frontera con HU03: el resumen no muestra ningún nivel, aunque las tarjetas sí", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({ alerts: [alerta({ level: "high", explanation: MODELO_454 }), alerta({ origin: "event", level: "medium", explanation: EVENTO_453 })] })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(resumen()).not.toHaveTextContent(/Nivel bajo|Nivel medio|Nivel alto|nivel/i);
    expect(within(tarjetasDeAlerta()[0]).getByText("Nivel alto")).toBeInTheDocument();
  });

  it("ordena las alertas por nivel: un momento puntual alto va antes que la sesión en conjunto baja", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({
        alerts: [
          alerta({ level: "low", explanation: MODELO_453 }),
          alerta({ origin: "event", level: "high", explanation: "Se pegó un bloque de 4.370 caracteres en una respuesta con 5 caracteres escritos antes." }),
        ],
      })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    const tarjetas = tarjetasDeAlerta();
    expect(within(tarjetas[0]).getByText("Nivel alto")).toBeInTheDocument();
    expect(within(tarjetas[0]).getByText("Un momento puntual")).toBeInTheDocument();
    expect(within(tarjetas[1]).getByText("Nivel bajo")).toBeInTheDocument();
    expect(within(tarjetas[1]).getByText("La sesión en conjunto")).toBeInTheDocument();
    // Y los motivos siguen el orden de las tarjetas.
    expect(within(resumen()).getAllByRole("link")[0]).toHaveTextContent("Por un texto pegado de 4.370 caracteres");
  });

  it("cada tarjeta dice su nivel escrito, la hora sin segundos y de dónde sale", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({
        alerts: [
          // Subió de nivel: dice desde cuándo tiene este nivel.
          alerta({ level: "medium", level_since: "2026-10-23T14:10:00.000Z", created_at: "2026-10-23T14:00:00.000Z" }),
          // No cambió: dice cuándo apareció.
          alerta({ origin: "event", level: "low", explanation: EVENTO_453, level_since: "2026-10-23T14:05:00.000Z", created_at: "2026-10-23T14:05:00.000Z" }),
        ],
      })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    const [modelo, evento] = tarjetasDeAlerta();
    expect(within(modelo).getByText("Nivel medio")).toBeInTheDocument();
    expect(within(modelo).getByText("La sesión en conjunto")).toBeInTheDocument();
    const desde = modelo.querySelector(".analisis__hora") as HTMLElement;
    expect(desde).toHaveTextContent(`Con este nivel desde las ${horaCorta("2026-10-23T14:10:00.000Z")}`);
    expect(desde.querySelector("time")?.dateTime).toBe("2026-10-23T14:10:00.000Z");
    expect(evento.querySelector(".analisis__hora")).toHaveTextContent(`Apareció a las ${horaCorta("2026-10-23T14:05:00.000Z")}`);
    expect(within(evento).getByText("Un momento puntual")).toBeInTheDocument();
  });

  it("ninguna hora del apartado lleva segundos", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({ alerts: [alerta({ explanation: MODELO_454 }), alerta({ origin: "event", explanation: EVENTO_453 })] })
    );
    const { container } = render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    const horas = Array.from(container.querySelectorAll("time"));
    expect(horas.length).toBeGreaterThanOrEqual(3);
    for (const hora of horas) expect(hora.textContent).toMatch(/^\d{2}:\d{2}$/);
    expect(container.textContent).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it("la explicación se lee en lenguaje llano, con lo de esta sesión al lado de una sesión habitual", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({ alerts: [alerta({ level: "high", explanation: MODELO_454 })] })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    const [tarjeta] = tarjetasDeAlerta();
    expect(within(tarjeta).getByText("Esta sesión se aparta mucho de lo habitual.")).toHaveClass("analisis__titular");
    expect(within(tarjeta).getByText("Menos de 2 de cada 1.000 sesiones habituales se comportan así.")).toBeInTheDocument();
    expect(within(tarjeta).getByRole("heading", { name: "Lo que más pesó" })).toBeInTheDocument();
    const cifras = tarjeta.querySelectorAll(".comparacion");
    expect(cifras).toHaveLength(3);
    expect(cifras[0]).toHaveTextContent("Tiempo fuera del examen");
    expect(within(cifras[0] as HTMLElement).getAllByRole("term").map((t) => t.textContent)).toEqual([
      "Esta sesión", "Una sesión habitual",
    ]);
    expect(cifras[1]).toHaveTextContent("unas 6 salidas cada 10 minutos");
    expect(cifras[1]).toHaveTextContent("0 salidas cada 10 minutos");
    expect(cifras[2]).toHaveTextContent("45 s");
    expect(within(tarjeta).getByText("Las cifras son las del momento de la sesión en que más se notó.")).toBeInTheDocument();
    // No se lee como un párrafo corrido: no queda ningún signo de viñeta suelto ni la tabla vieja.
    expect(screen.queryByText(/•/)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("las barras van ocultas para los lectores de pantalla y los valores siempre están escritos", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({ alerts: [alerta({ explanation: MODELO_453 })] })
    );
    const { container } = render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    const pistas = container.querySelectorAll(".comparacion__pista");
    expect(pistas.length).toBe(6);
    for (const pista of pistas) expect(pista).toHaveAttribute("aria-hidden", "true");
    const valores = Array.from(container.querySelectorAll(".comparacion__valor")).map((v) => v.textContent);
    expect(valores).toEqual([
      "301 caracteres", "0 caracteres",
      "2 pegados cada 10 preguntas", "0 pegados cada 10 preguntas",
      "2 min 56 s", "1 min 8 s",
    ]);
    // El medidor también: la palabra ya dice el nivel.
    expect(container.querySelector(".medidor")).toHaveAttribute("aria-hidden", "true");
  });

  it("si los dos valores son cero, la cifra va sin barras", async () => {
    const texto = [
      "Esta sesión se aparta levemente de lo habitual.",
      "Lo que más pesó:",
      "• Salida más larga del examen: 0 segundos (lo esperado: 0 segundos)",
      "Esto describe lo observado y no atribuye intención: la revisión es del docente.",
    ].join("\n");
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(analisis({ alerts: [alerta({ explanation: texto })] }));
    const { container } = render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(container.querySelector(".comparacion__pista")).toBeNull();
    expect(container.querySelector(".comparacion")).toHaveTextContent("0 s");
  });

  it("la nota de apoyo aparece una sola vez arriba, y el cierre no se repite en cada tarjeta", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({ alerts: [alerta({ explanation: MODELO_453 }), alerta({ origin: "event", explanation: EVENTO_453 })] })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getAllByText(/la revisión es del docente/)).toHaveLength(1);
    expect(screen.getAllByText(/no atribuye intención/)).toHaveLength(1);
    expect(within(resumen()).getByText(/Una alerta señala algo para mirar con atención/)).toBeInTheDocument();
    for (const tarjeta of tarjetasDeAlerta()) expect(tarjeta).not.toHaveTextContent(/no atribuye intención/);
  });

  it("una alerta guardada con el formato viejo, en un párrafo, se lee entera y la nota no falta", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({
        alerts: [alerta({
          explanation: "El índice de la sesión es 60 de 100: su comportamiento se parece al de menos del 1 % de las sesiones esperadas.",
        })],
      })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    const texto = screen.getByText(/Su comportamiento se parece al de menos del 1 % de las sesiones habituales/);
    expect(texto).toBeInTheDocument();
    // Sin estructura no hay titular: se muestra como texto común y no en grande y en negrita.
    expect(texto).not.toHaveClass("analisis__titular");
    expect(screen.queryByText(/índice/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sesiones esperadas/)).not.toBeInTheDocument();
    expect(screen.getByText("Hay 1 alerta para revisar.")).toBeInTheDocument();
    expect(screen.getAllByText(/la revisión es del docente/)).toHaveLength(1);
  });

  it("una viñeta sin la forma esperada se muestra tal cual, sin perderse", async () => {
    const texto = [
      "Esta sesión se aparta de lo habitual.",
      "Lo que más pesó:",
      "• Algo que el motor escribió de otra forma",
      "Esto describe lo observado y no atribuye intención: la revisión es del docente.",
    ].join("\n");
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(analisis({ alerts: [alerta({ explanation: texto })] }));
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText("Algo que el motor escribió de otra forma")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lo que más pesó" })).toBeInTheDocument();
  });

  it("sin evidencia suficiente lo dice en llano, y el requisito queda dentro de un desplegable cerrado", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({
        state: "insufficient_evidence",
        reason: "Hay muy poca actividad registrada para analizar la sesión: se necesitan al menos 1 minuto observado y 5 eventos de actividad.",
      })
    );
    const { container } = render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText("Hubo muy poca actividad para analizar esta sesión.")).toBeInTheDocument();
    expect(screen.getByText("Con tan pocos datos no se puede decir si se aparta de lo habitual.")).toBeInTheDocument();
    const desplegable = container.querySelector("details") as HTMLDetailsElement;
    expect(desplegable).not.toBeNull();
    expect(desplegable.open).toBe(false);
    expect(within(desplegable).getByText("Qué hace falta para analizarla").tagName).toBe("SUMMARY");
    expect(within(desplegable).getByText("Se necesitan al menos 1 minuto observado y 5 eventos de actividad.")).toBeInTheDocument();
    expect(screen.queryByText(/no tiene alertas/)).not.toBeInTheDocument();
  });

  it("sin evidencia y sin motivo no hay desplegable", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(analisis({ state: "insufficient_evidence", reason: null }));
    const { container } = render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText("Hubo muy poca actividad para analizar esta sesión.")).toBeInTheDocument();
    expect(container.querySelector("details")).toBeNull();
  });

  it("con la captura incompleta no dice que hubo poca actividad", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({
        state: "insufficient_evidence",
        reason: "La captura no arrancó en esta sesión: el servidor de Moodle avisó que el complemento no llegó a capturar.",
      })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText("Esta sesión no se pudo analizar porque la captura quedó incompleta.")).toBeInTheDocument();
    expect(screen.queryByText(/poca actividad/)).not.toBeInTheDocument();
  });

  it("si el análisis no está disponible lo dice, y la alerta de un momento puntual se sigue mostrando", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({
        state: "unavailable",
        reason: "No hay un modelo cargado.",
        alerts: [alerta({ origin: "event", level: "low", explanation: "Se pegó un bloque de 250 caracteres." })],
      })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText("Hay 1 alerta para revisar.")).toBeInTheDocument();
    expect(screen.getByText(/El análisis de la sesión en conjunto no está disponible por ahora, pero se marcó un momento puntual/)).toBeInTheDocument();
    expect(screen.queryByText(/modelo/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Se pegó un bloque de 250 caracteres/)).toBeInTheDocument();
  });

  it("sin evidencia suficiente pero con la alerta de un momento puntual, dice qué faltó y que igual se marcó algo", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({
        state: "insufficient_evidence",
        reason: "Hay muy poca actividad registrada para analizar la sesión.",
        alerts: [alerta({ origin: "event", level: "high", explanation: "Se pegó un bloque de 4.370 caracteres." })],
      })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText("Hay 1 alerta para revisar.")).toBeInTheDocument();
    expect(screen.getByText("Hubo poca actividad para analizar la sesión en conjunto, pero se marcó un momento puntual.")).toBeInTheDocument();
    expect(screen.queryByText(/Hay muy poca actividad registrada/)).not.toBeInTheDocument();
    expect(screen.getByText(/Se pegó un bloque de 4.370 caracteres/)).toBeInTheDocument();
  });

  it("no disponible y sin alertas dice solo que no está disponible por ahora, sin el motivo técnico", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({ state: "unavailable", reason: "No hay un modelo cargado: MODEL_PATH no está configurado." })
    );
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(screen.getByText("El análisis de esta sesión no está disponible por ahora.")).toBeInTheDocument();
    expect(screen.getByText("Los eventos de la sesión se pueden revisar igual, más abajo.")).toBeInTheDocument();
    expect(screen.queryByText(/MODEL_PATH|modelo cargado/)).not.toBeInTheDocument();
  });

  it("con las explicaciones reales no aparece ninguna palabra técnica en pantalla", async () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(
      analisis({ alerts: [alerta({ level: "high", explanation: MODELO_454 }), alerta({ origin: "event", explanation: EVENTO_453 })] })
    );
    const { container } = render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(container.textContent).not.toMatch(
      /modelo|variable|sesiones esperadas|cálculo|índice|proporción|mediana|percentil|severidad|puntaje/i
    );
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

  it("no muestra la severidad de la alerta, que revelaría el índice, aunque el servidor la mandara", async () => {
    const conSeveridad = { ...alerta({ explanation: MODELO_454 }), severity: 61.5, variables: [{ name: "outside_time_ratio" }] };
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(analisis({ alerts: [conSeveridad as AlertaDeSesion] }));
    const { container } = render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);
    await esperar();

    expect(container.textContent).not.toMatch(/61[,.]5|38[,.]5|outside_time_ratio|severi|índice|puntaje/i);
  });

  it("con la sesión abierta vuelve a preguntar y una alerta aparece o sube de nivel mientras se mira", async () => {
    const traer = vi.spyOn(sesionesService, "traerAnalisis");
    traer.mockResolvedValueOnce(analisis());
    render(<AnalisisSesion sesion={sesionNumerada({ status: "open" })} onVencida={nada} />);
    await esperar();
    expect(screen.getByText("Por ahora no se encontró nada fuera de lo habitual.")).toBeInTheDocument();

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
