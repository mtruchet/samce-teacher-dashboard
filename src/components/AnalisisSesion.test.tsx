import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sesionesService from "../services/sesionesService";
import type { AlertaDeSesion, Analisis } from "../services/sesionesService";
import { esperar, sesionNumerada } from "../test/fabricas";
import { EVENTO_453, MODELO_453, MODELO_454, NO_DISPONIBLE, SIN_EVIDENCIA_457 } from "../test/explicaciones";
import { horaCorta } from "../eventos";
import { NoSePudo } from "../iconos";
import { AnalisisSesion } from "./AnalisisSesion";

const nada = () => undefined;
const CALCULO = "2026-10-23T14:30:05.123Z";
/** Una entrega de hace una hora: el apartado ya no vuelve a preguntar. */
const HACE_RATO = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const CERRADA = { status: "closed" as const, closed_at: HACE_RATO };

/** Lo que Facundo rechazó del primer rediseño: no puede volver a aparecer. */
const RECHAZADOS =
  /Por cómo se desarrolló|Una alerta señala|no atribuye intención|la revisión es del docente|Las cifras son las del momento|Una sesión habitual|Esta sesión\n/;
/**
 * Lo que los docentes de la ronda 1 marcaron: «lo común» (se dice siempre «lo habitual»), el rótulo
 * «llamó la atención», «por última vez», «Apareció a las», «Esta sesión se rindió», las salidas
 * «del examen» y las «aplicaciones de la computadora», y las cifras sueltas como «1 vez».
 */
const MARCADOS_EN_LA_RONDA_1 =
  /lo común|llamó la atención|por última vez|Apareció a las|sesión se rindió|aplicaciones|salida más larga|fuera del examen|\b1 vez|\b1 minuto|cuando lo común/i;
/**
 * Lo que marcaron en la ronda 2: «habitual» sin decir contra qué (y repetido tres veces en la tarjeta), la viñeta que
 * remitía a «la otra alerta que describe», «una sola vez» en el pegado, «en cada pregunta», los números en letras al
 * lado de los números en cifras, la hora del análisis («Se detectó a las») y la bajada que repetía el título de la 452.
 */
const MARCADOS_EN_LA_RONDA_2 =
  /habitual|que describe la otra alerta|Pegó texto una sola vez|en cada pregunta|\b(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez) (minutos|segundos|veces)\b|Se detectó|no surgió ninguna alerta/i;
/** Palabras técnicas que el docente no tiene por qué conocer. */
const TECNICAS =
  /caracteres|sesiones habituales|sesiones esperadas|99 de cada 100|%|modelo|variable|cálculo|índice|proporción|mediana|percentil|severidad|puntaje|captura|complemento|Moodle|backend/i;

/** El veredicto de arriba del apartado. */
function veredicto(): HTMLElement {
  return document.querySelector(".veredicto") as HTMLElement;
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
    explanation: MODELO_453,
    level_since: "2026-10-23T14:10:00.000Z",
    created_at: "2026-10-23T14:00:00.000Z",
    updated_at: CALCULO,
    ...cambios,
  };
}

async function mostrar(a: Analisis, cambios: Parameters<typeof sesionNumerada>[0] = {}) {
  vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(a);
  const r = render(<AnalisisSesion sesion={sesionNumerada(cambios)} onVencida={nada} />);
  await esperar();
  return r;
}

/** Las dos alertas reales de la 453, en el orden en que las manda el backend. */
const ALERTAS_453 = [
  alerta({ origin: "event", level: "low", explanation: EVENTO_453 }),
  alerta({ origin: "model", level: "low", explanation: MODELO_453 }),
];

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

  // ---- Los diez estados del veredicto ------------------------------------------------------------

  it("cargando: lo dice, y no afirma que no hay nada para revisar", () => {
    vi.spyOn(sesionesService, "traerAnalisis").mockReturnValue(new Promise(() => undefined));
    render(<AnalisisSesion sesion={sesionNumerada()} onVencida={nada} />);

    expect(screen.getByText("Cargando el análisis…")).toBeInTheDocument();
    expect(screen.queryByText(/nada para revisar/)).not.toBeInTheDocument();
    expect(veredicto()).toBeNull();
  });

  it("sin analizar y rindiendo: con el reloj, dice que se va a analizar solo", async () => {
    await mostrar(analisis({ state: "not_analyzed", calculated_at: null }), { status: "open" });

    expect(within(veredicto()).getByText("Esta sesión todavía no se analizó.")).toBeInTheDocument();
    expect(
      within(veredicto()).getByText("Se va a analizar mientras el alumno rinde. No hace falta recargar la pantalla.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Analizada/)).not.toBeInTheDocument();
  });

  it("sin analizar y cerrada: solo la frase, sin bajada ni hora", async () => {
    await mostrar(analisis({ state: "not_analyzed", calculated_at: null }), CERRADA);

    expect(veredicto()).toHaveTextContent(/^Esta sesión todavía no se analizó\.$/);
    expect(screen.queryByText(/Analizada/)).not.toBeInTheDocument();
  });

  it("analizada, sin alertas y cerrada: «No hay alertas para revisar.», sin la hora del análisis", async () => {
    const { container } = await mostrar(analisis(), CERRADA);

    expect(within(veredicto()).getByText("No hay alertas para revisar.")).toBeInTheDocument();
    // Sin repetir el título: «no surgió ninguna alerta» decía lo mismo dos veces.
    expect(within(veredicto()).getByText("Se analizó todo el examen.")).toBeInTheDocument();
    // Con el examen terminado, la hora del análisis no le sirve al docente: una sesión de la mañana
    // analizada de nuevo a la tarde decía «Analizada por última vez a las 16:55».
    expect(container.querySelector(".analisis__ultima")).toBeNull();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("analizada y rindiendo: «Analizada a las», sin segundos y sin «por última vez»", async () => {
    const { container } = await mostrar(analisis(), { status: "open" });

    const ultima = container.querySelector(".analisis__ultima") as HTMLElement;
    expect(ultima).toHaveTextContent(new RegExp(`^Analizada a las ${horaCorta(CALCULO)}$`));
    expect(ultima.querySelector("time")?.dateTime).toBe(CALCULO);
  });

  it("analizada, sin alertas y rindiendo: dice «por ahora»", async () => {
    await mostrar(analisis(), { status: "open" });

    expect(within(veredicto()).getByText("Por ahora no hay alertas para revisar.")).toBeInTheDocument();
    expect(within(veredicto()).getByText("La sesión se sigue analizando mientras el alumno rinde.")).toBeInTheDocument();
  });

  it("con alertas: cuántas hay, sin bajada", async () => {
    await mostrar(analisis({ alerts: ALERTAS_453 }));

    expect(veredicto()).toHaveTextContent(/^Hay 2 alertas para revisar\.$/);
  });

  it("todos los estados tienen la misma forma: la frase y el ícono en su cuadro, nunca el de prohibido", async () => {
    const casos: Analisis[] = [
      analisis({ alerts: ALERTAS_453 }),
      analisis(),
      analisis({ state: "not_analyzed", calculated_at: null }),
      analisis({ state: "insufficient_evidence", reason: SIN_EVIDENCIA_457 }),
      analisis({ state: "unavailable", reason: NO_DISPONIBLE }),
    ];
    // El círculo tachado («Prohibit») parecía un error o una sanción.
    const dibujoProhibido = render(<NoSePudo />);
    const prohibido = dibujoProhibido.container.querySelector("path")?.getAttribute("d") as string;
    dibujoProhibido.unmount();
    expect(prohibido).toBeTruthy();
    const formas = [];
    for (const caso of casos) {
      const { unmount } = await mostrar(caso, CERRADA);
      formas.push([veredicto().className, veredicto().querySelector(".veredicto__icono svg")?.getAttribute("width")]);
      expect(veredicto().querySelector(".veredicto__frase")).not.toBeNull();
      expect(veredicto().innerHTML).not.toContain(prohibido);
      unmount();
      vi.restoreAllMocks();
    }
    expect(new Set(formas.map((f) => f.join("|"))).size).toBe(1);
  });

  it("con una sola alerta, en singular", async () => {
    await mostrar(analisis({ alerts: [alerta({ level: "high", explanation: MODELO_454 })] }));

    expect(veredicto()).toHaveTextContent(/^Hay 1 alerta para revisar\.$/);
  });

  it("sin evidencia y sin alertas (457): el motivo del motor tal cual y dónde mirar, sin desplegable", async () => {
    const { container } = await mostrar(analisis({ state: "insufficient_evidence", reason: SIN_EVIDENCIA_457 }), CERRADA);

    const bajadas = Array.from(veredicto().querySelectorAll(".veredicto__bajada")).map((b) => b.textContent);
    expect(within(veredicto()).getByText("Esta sesión no se pudo analizar.")).toBeInTheDocument();
    // Dos frases: el motivo del motor y, en una sola, que no indica un problema y dónde mirar.
    expect(bajadas).toEqual([
      SIN_EVIDENCIA_457,
      "Que no se haya podido analizar no indica ningún problema en el examen; lo que sí se registró está más abajo.",
    ]);
    expect(container.querySelector("details")).toBeNull();
    // Ni «Analizada a las»: contradecía al título.
    expect(container.querySelector(".analisis__ultima")).toBeNull();
    // El motivo no repite «esta sesión», que ya está en el título.
    expect(SIN_EVIDENCIA_457).not.toMatch(/sesión/);
  });

  it("sin evidencia y sin motivo: la frase, que no indica un problema y dónde mirar", async () => {
    const { container } = await mostrar(analisis({ state: "insufficient_evidence", reason: null }));

    expect(within(veredicto()).getByText("Esta sesión no se pudo analizar.")).toBeInTheDocument();
    expect(veredicto().querySelectorAll(".veredicto__bajada")).toHaveLength(1);
    // Aunque la sesión siga abierta, una que no se pudo analizar no dice la hora del análisis.
    expect(container.querySelector(".analisis__ultima")).toBeNull();
  });

  it("sin evidencia pero con la alerta de un momento: cuántas hay, que conviene mirar y el motivo del motor", async () => {
    await mostrar(analisis({
      state: "insufficient_evidence",
      reason: SIN_EVIDENCIA_457,
      alerts: [alerta({ origin: "event", level: "high", explanation: EVENTO_453 })],
    }));

    const bajadas = Array.from(veredicto().querySelectorAll(".veredicto__bajada")).map((b) => b.textContent);
    expect(within(veredicto()).getByText("Hay 1 alerta para revisar.")).toBeInTheDocument();
    expect(bajadas).toEqual([
      "La sesión completa no se pudo analizar, pero hubo un momento que conviene mirar.", SIN_EVIDENCIA_457,
    ]);
    expect(within(tarjetasDeAlerta()[0]).getByText(EVENTO_453)).toBeInTheDocument();
  });

  it("no disponible y sin alertas: lo dice una sola vez, sin repetir el motivo", async () => {
    await mostrar(analisis({ state: "unavailable", reason: NO_DISPONIBLE }));

    expect(within(veredicto()).getByText("El análisis no está disponible en este momento.")).toBeInTheDocument();
    expect(within(veredicto()).getByText("Los eventos de la sesión se pueden ver igual, más abajo.")).toBeInTheDocument();
    expect(screen.getAllByText(NO_DISPONIBLE)).toHaveLength(1);
  });

  it("no disponible pero con la alerta de un momento: la alerta se sigue mostrando", async () => {
    await mostrar(analisis({
      state: "unavailable",
      reason: NO_DISPONIBLE,
      alerts: [alerta({ origin: "event", level: "low", explanation: EVENTO_453 })],
    }));

    expect(within(veredicto()).getByText("Hay 1 alerta para revisar.")).toBeInTheDocument();
    expect(
      within(veredicto()).getByText("El análisis de la sesión completa no está disponible en este momento.")
    ).toBeInTheDocument();
    expect(screen.getByText(EVENTO_453)).toBeInTheDocument();
  });

  it("frontera con HU03: el veredicto nunca dice un nivel, en ningún estado", async () => {
    const casos: Analisis[] = [
      analisis({ alerts: [alerta({ level: "high", explanation: MODELO_454 })] }),
      analisis({ alerts: ALERTAS_453 }),
      analisis(),
      analisis({ state: "not_analyzed", calculated_at: null }),
      analisis({ state: "insufficient_evidence", reason: SIN_EVIDENCIA_457 }),
      analisis({ state: "unavailable", reason: NO_DISPONIBLE }),
    ];
    for (const caso of casos) {
      const { unmount } = await mostrar(caso);
      expect(veredicto()).not.toHaveTextContent(/Nivel|nivel (bajo|medio|alto)/i);
      unmount();
      vi.restoreAllMocks();
    }
  });

  // ---- Las tarjetas -----------------------------------------------------------------------------

  it("453: dos tarjetas de nivel bajo, primero la de toda la sesión, con el texto del motor tal cual", async () => {
    await mostrar(analisis({ alerts: ALERTAS_453 }));

    const [modelo, evento] = tarjetasDeAlerta();
    expect(modelo.querySelector(".analisis__rotulo")).toHaveTextContent("Nivel bajo · En toda la sesión");
    expect(evento.querySelector(".analisis__rotulo")).toHaveTextContent("Nivel bajo · En un momento de la sesión");

    expect(modelo.querySelector(".analisis__hecho")).toHaveTextContent(MODELO_453.split("\n")[0]);
    expect(within(modelo).getByRole("heading", { name: "Lo que más se notó" })).toBeInTheDocument();
    const viñetas = Array.from(modelo.querySelectorAll(".analisis__lista li")).map((li) => li.textContent);
    expect(viñetas).toEqual(MODELO_453.split("\n").filter((r) => r.startsWith("• ")).map((r) => r.slice(2)));

    expect(evento.querySelector(".analisis__hecho")).toHaveTextContent(EVENTO_453);
    expect(evento.querySelector(".analisis__lista")).toBeNull();
    // El pegado se nombra una sola vez en la lista, con su pregunta, y aclara que es el de la otra alerta.
    expect(viñetas.filter((v) => /[Pp]eg/.test(v ?? ""))).toEqual([
      "En la pregunta 3 pegó un texto largo (es el mismo de la otra alerta).",
    ]);
    expect(EVENTO_453).toMatch(/^En la pregunta 3, /);
    // El tiempo por pregunta va al final, sin cifras y «en general»: es un promedio, no todas las preguntas.
    expect(viñetas[viñetas.length - 1]).toBe("En general, tardó más que la mayoría en responder las preguntas.");
    // «Habitual» no aparece en ningún lado de la tarjeta: el titular dice contra qué se compara.
    expect(modelo.textContent).not.toMatch(/habitual/);
    expect(modelo.querySelector(".analisis__hecho")).toHaveTextContent("a la mayoría de los exámenes");
    // Ningún signo de viñeta suelto: la lista los dibuja.
    expect(screen.queryByText(/•/)).not.toBeInTheDocument();
  });

  it("454: la alerta de nivel alto, con su lista", async () => {
    await mostrar(analisis({ alerts: [alerta({ level: "high", explanation: MODELO_454 })] }));

    const [tarjeta] = tarjetasDeAlerta();
    expect(tarjeta).toHaveClass("analisis__alerta--high");
    expect(tarjeta.querySelector(".analisis__hecho")).toHaveTextContent(
      "Este examen se rindió de una forma muy distinta a la mayoría de los exámenes."
    );
    // Las salidas, con las palabras del registro y con su número, sin suponer que se fue, de lo general a lo
    // particular y con todos los números en cifras.
    const viñetas = Array.from(tarjeta.querySelectorAll(".analisis__lista li")).map((li) => li.textContent);
    expect(viñetas).toEqual([
      "Pasó a otra ventana 11 veces.",
      "En total, estuvo unos 8 minutos fuera de la ventana del examen, de los 28 que duró.",
      "La vez más larga fue de 45 segundos.",
    ]);
  });

  it("ordena por nivel: un momento de nivel alto va antes que toda la sesión de nivel bajo", async () => {
    await mostrar(analisis({
      alerts: [alerta({ level: "low" }), alerta({ origin: "event", level: "high", explanation: EVENTO_453 })],
    }));

    const [primera, segunda] = tarjetasDeAlerta();
    expect(primera).toHaveTextContent("Nivel alto");
    expect(primera).toHaveTextContent("En un momento de la sesión");
    expect(segunda).toHaveTextContent("Nivel bajo");
    expect(segunda).toHaveTextContent("En toda la sesión");
  });

  it("el origen sale del campo `origin`, no del texto, escrito y sin ícono", async () => {
    // El texto de la alerta de un momento puesto en una de toda la sesión, y al revés.
    await mostrar(analisis({
      alerts: [
        alerta({ origin: "model", level: "high", explanation: EVENTO_453 }),
        alerta({ origin: "event", level: "low", explanation: MODELO_453 }),
      ],
    }));

    const [modelo, evento] = tarjetasDeAlerta();
    expect(modelo).toHaveAttribute("data-origen", "model");
    expect(evento).toHaveAttribute("data-origen", "event");
    expect(modelo.querySelector(".analisis__origen")).toHaveTextContent("En toda la sesión");
    expect(evento.querySelector(".analisis__origen")).toHaveTextContent("En un momento de la sesión");
    // Los íconos de capas y de ubicación no se entendían sin una leyenda.
    expect(document.querySelector(".analisis__origen-icono")).toBeNull();
  });

  it("ninguna alerta lleva hora: la que da la API es la del análisis, no la del hecho", async () => {
    await mostrar(analisis({
      alerts: [
        alerta({ level: "medium", level_since: "2026-10-23T14:10:00.000Z", created_at: "2026-10-23T14:00:00.000Z" }),
        alerta({
          origin: "event", level: "low", explanation: EVENTO_453,
          level_since: "2026-10-23T14:05:00.000Z", created_at: "2026-10-23T14:05:00.000Z",
        }),
      ],
    }));

    // En la 453, «Se detectó a las 09:36» no coincidía con el pegado del registro (09:35:08), y los docentes
    // buscaban 09:36 sin encontrarlo. Dónde fue lo dice el texto del motor, con la pregunta.
    for (const tarjeta of tarjetasDeAlerta()) {
      expect(tarjeta.querySelector("time")).toBeNull();
      expect(tarjeta.textContent).not.toMatch(/\d{2}:\d{2}|Se detectó|a las/);
    }
  });

  it("ninguna hora del apartado lleva segundos", async () => {
    const { container } = await mostrar(analisis({ alerts: ALERTAS_453 }), { status: "open" });

    // Solo «Analizada a las», mientras el alumno rinde.
    const horas = Array.from(container.querySelectorAll("time"));
    expect(horas).toHaveLength(1);
    for (const hora of horas) expect(hora.textContent).toMatch(/^\d{2}:\d{2}$/);
    expect(container.textContent).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it("las notas del motor (la combinación, la conexión) salen tal cual, con el ícono de información", async () => {
    const combinacion = "Ninguna de estas cosas es rara por sí sola. Lo poco común es que se den juntas.";
    const conexion = "Parte de esto puede deberse a cortes de la conexión a internet, que no dependen del alumno.";
    const texto = [
      "Este examen se rindió de una forma bastante distinta a la mayoría de los exámenes.",
      "Lo que más se notó:",
      "• La conexión a internet se cortó más veces que en la mayoría.",
      combinacion,
      conexion,
    ].join("\n");
    await mostrar(analisis({ alerts: [alerta({ explanation: texto })] }));

    const notas = Array.from(document.querySelectorAll(".analisis__nota"));
    expect(notas.map((n) => n.textContent)).toEqual([combinacion, conexion]);
    for (const n of notas) expect(n.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("un renglón que el panel no conoce sale como nota, idéntico", async () => {
    const raro = "Un renglón nuevo que el motor escribió (con 2 cifras: 7 y 8).";
    await mostrar(analisis({ alerts: [alerta({ explanation: `${EVENTO_453}\n${raro}` })] }));

    expect(document.querySelector(".analisis__nota")).toHaveTextContent(raro);
  });

  it("un rótulo de lista sin viñetas no abre una lista vacía: sale como nota", async () => {
    await mostrar(analisis({ alerts: [alerta({ explanation: "Algo pasó.\nLo que más se notó:" })] }));

    expect(screen.queryByRole("heading", { name: "Lo que más se notó" })).not.toBeInTheDocument();
    expect(document.querySelector(".analisis__nota")).toHaveTextContent("Lo que más se notó:");
  });

  it("una alerta vieja sin volver a analizar se lee igual, pero sin el cierre", async () => {
    const vieja = [
      "Esta sesión se aparta levemente de lo habitual.",
      "Lo que más pesó:",
      "• Pegado más largo: 301 caracteres (lo esperado: 0 caracteres)",
      "Esto describe lo observado y no atribuye intención: la revisión es del docente.",
    ].join("\n");
    await mostrar(analisis({ alerts: [alerta({ explanation: vieja })] }));

    expect(screen.getByText("Esta sesión se aparta levemente de lo habitual.")).toBeInTheDocument();
    expect(screen.getByText("Pegado más largo: 301 caracteres (lo esperado: 0 caracteres)")).toBeInTheDocument();
    expect(screen.queryByText(/no atribuye intención/)).not.toBeInTheDocument();
  });

  // ---- Lo que no tiene que aparecer -------------------------------------------------------------

  it("con las explicaciones reales no aparece ninguna palabra técnica ni nada de lo rechazado", async () => {
    const { container } = await mostrar(analisis({
      alerts: [alerta({ level: "high", explanation: MODELO_454 }), alerta({ origin: "event", explanation: EVENTO_453 })],
    }));

    expect(container.textContent).not.toMatch(TECNICAS);
    expect(container.textContent).not.toMatch(RECHAZADOS);
    expect(container.textContent).not.toMatch(MARCADOS_EN_LA_RONDA_1);
    expect(container.textContent).not.toMatch(MARCADOS_EN_LA_RONDA_2);
    expect(container.querySelector(".comparacion, .resumen__nota, .resumen__motivos, .analisis__aclaracion")).toBeNull();
  });

  it("la 453 y la 457 tampoco muestran palabras técnicas ni lo rechazado", async () => {
    const r453 = await mostrar(analisis({ alerts: ALERTAS_453 }));
    expect(r453.container.textContent).not.toMatch(TECNICAS);
    expect(r453.container.textContent).not.toMatch(RECHAZADOS);
    expect(r453.container.textContent).not.toMatch(MARCADOS_EN_LA_RONDA_1);
    expect(r453.container.textContent).not.toMatch(MARCADOS_EN_LA_RONDA_2);
    r453.unmount();
    vi.restoreAllMocks();

    const r457 = await mostrar(analisis({ state: "insufficient_evidence", reason: SIN_EVIDENCIA_457 }), CERRADA);
    expect(r457.container.textContent).not.toMatch(TECNICAS);
    expect(r457.container.textContent).not.toMatch(MARCADOS_EN_LA_RONDA_1);
    expect(r457.container.textContent).not.toMatch(MARCADOS_EN_LA_RONDA_2);
    expect(r457.container.textContent).not.toMatch(/eventos de actividad|se necesitan/);
  });

  it("no muestra el índice de integridad ni las métricas, aunque el servidor los mandara", async () => {
    const conDeMas = {
      ...analisis({ alerts: [alerta({ explanation: "Su índice es 38,5 de 100: menos del 1 % de las sesiones esperadas se comporta así." })] }),
      index: 38.5, integrity_index: 38.5, variables: { largest_paste_chars: 1240 }, dimensions: [{ name: "clipboard" }],
    };
    await mostrar(conDeMas as Analisis);

    expect(screen.queryByText(/38[,.]5/)).not.toBeInTheDocument();
    expect(screen.queryByText(/largest_paste_chars|clipboard/)).not.toBeInTheDocument();
    expect(screen.queryByText(/historial|cronolog/i)).not.toBeInTheDocument();
  });

  it("no muestra la severidad de la alerta ni sus variables, aunque el servidor las mandara", async () => {
    const conSeveridad = {
      ...alerta({ explanation: MODELO_454 }), severity: 61.5,
      variables: [{ name: "outside_time_ratio", observed: 0.288, expected: 0 }],
    };
    const { container } = await mostrar(analisis({ alerts: [conSeveridad as AlertaDeSesion] }));

    expect(container.textContent).not.toMatch(/61[,.]5|0[,.]288|outside_time_ratio|severi|índice|puntaje/i);
  });

  it("no dibuja barras ni comparaciones: solo texto y el medidor del nivel, oculto para lectores", async () => {
    const { container } = await mostrar(analisis({ alerts: ALERTAS_453 }));

    expect(container.querySelector("[class*='comparacion'], [class*='barra'], [class*='pista']")).toBeNull();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    for (const medidor of container.querySelectorAll(".medidor")) expect(medidor).toHaveAttribute("aria-hidden", "true");
  });

  it("con la sesión abierta vuelve a preguntar y una alerta aparece o sube de nivel mientras se mira", async () => {
    const traer = vi.spyOn(sesionesService, "traerAnalisis");
    traer.mockResolvedValueOnce(analisis());
    render(<AnalisisSesion sesion={sesionNumerada({ status: "open" })} onVencida={nada} />);
    await esperar();
    expect(screen.getByText("Por ahora no hay alertas para revisar.")).toBeInTheDocument();

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
    expect(screen.queryByText(/nada para revisar/)).not.toBeInTheDocument();
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
