/**
 * El contrato con el backend, del lado del panel (pendiente 16).
 *
 * El panel lee todos los campos nuevos como opcionales y sus pruebas arman los objetos a mano: si un campo del
 * JSON cambiara de nombre (por ejemplo `analysis_state`), las pruebas seguirían en verde y el panel perdería el
 * dato sin avisar. Esta prueba lee dos respuestas completas, guardadas tal como las manda el backend, y comprueba
 * dos cosas: que traen exactamente los campos de los tipos de `sesionesService.ts`, y que la lista, el resumen y
 * el detalle las dibujan enteras.
 *
 * Cuando exista `testdata/contrato/` en el backend (las respuestas que genera su `contract_test.go` con el router
 * real), los archivos de `src/test/contrato/` se reemplazan por esa copia, sin tocar esta prueba.
 *
 * Son tres: la lista (`sesiones_con_resumen.json`, con la forma real de `capture`: `last_event_at` cuando llegó
 * algún evento, y `gap_minutes` con el corte), el análisis de una sesión cerrada con una métrica nula
 * (`analisis_cerrado.json`) y el de una que no se pudo analizar, con motivo y `metrics: null`
 * (`analisis_sin_evidencia.json`), que es como el backend real manda las abiertas y las no analizadas.
 *
 * Hasta entonces, el pendiente 16 queda resuelto a medias: estos JSON están escritos a mano en el panel (con la
 * cabecera X-Total-Count en una clave «_headers» armada acá), así que un campo renombrado en Go no hace fallar
 * esta prueba. Para que la copia funcione sin tocarla, el `contract_test.go` del backend tiene que escribir la
 * lista con la misma forma: `{ "_headers": { "X-Total-Count": "N" }, "body": … }`.
 *
 * Los nombres de los alumnos son ficticios.
 */
import { createElement } from "react";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NIVELES_DE_RIESGO, traerAnalisis, traerSesiones,
  type AlertaDeSesion, type Analisis, type EntradaDelHistorial, type EstadoDelAnalisis, type Metricas,
  type ResumenDeEvaluacion, type Sesion, type SesionNumerada,
} from "./sesionesService";
import { ListaSesiones } from "../components/ListaSesiones";
import { ResumenEvaluacion } from "../components/ResumenEvaluacion";
import { AnalisisSesion } from "../components/AnalisisSesion";
import { esperar } from "../test/fabricas";
import { expectLenguajeLlano } from "../test/lenguaje";
import crudoDeLaLista from "../test/contrato/sesiones_con_resumen.json?raw";
import crudoDelAnalisis from "../test/contrato/analisis_cerrado.json?raw";
import crudoSinEvidencia from "../test/contrato/analisis_sin_evidencia.json?raw";

type Objeto = Record<string, unknown>;

/*
 * Los campos de cada objeto del contrato, sacados de los tipos. Cada lista se escribe contra `keyof` del tipo y
 * además se comprueba que no le falte ninguno (`Faltan`), así un cambio en los tipos obliga a ponerla al día.
 */
type Faltan<T, L extends readonly PropertyKey[]> = Exclude<keyof T, L[number]>;
type Completa<T, L extends readonly PropertyKey[]> = [Faltan<T, L>] extends [never] ? true : false;

const SESION_OBLIGATORIOS = [
  "id", "moodle_attempt_id", "moodle_user_id", "student_name", "status", "started_at", "capture", "risk_level",
  "alerts_count", "alert_origins", "analysis_state", "attempt_number", "attempts_total",
] as const satisfies readonly (keyof Sesion)[];
/** Solo en las sesiones que terminaron. */
const SESION_OPCIONALES = ["closed_at"] as const satisfies readonly (keyof Sesion)[];
const RESUMEN = [
  "total", "risk_high", "risk_medium", "risk_low", "no_alerts", "not_analyzed", "insufficient_evidence", "unavailable",
] as const satisfies readonly (keyof ResumenDeEvaluacion)[];
const ANALISIS = ["state", "reason", "calculated_at", "alerts", "alert_history", "metrics"] as const satisfies readonly (keyof Analisis)[];
const ALERTA = ["origin", "level", "explanation", "level_since", "created_at", "updated_at"] as const satisfies readonly (keyof AlertaDeSesion)[];
const ENTRADA = ["origin", "level", "explanation", "recorded_at", "carried_over"] as const satisfies readonly (keyof EntradaDelHistorial)[];
const METRICAS = [
  "outside_time_ratio", "outside_longest_s", "typing_rate_median_per_s", "largest_paste_chars", "pasted_chars_ratio",
  "mouse_idle_longest_s", "question_time_median_s", "silence_longest_s",
] as const satisfies readonly (keyof Metricas)[];

const LISTAS_COMPLETAS: boolean[] = [
  true satisfies Completa<Sesion, [...typeof SESION_OBLIGATORIOS, ...typeof SESION_OPCIONALES]>,
  true satisfies Completa<ResumenDeEvaluacion, typeof RESUMEN>,
  true satisfies Completa<Analisis, typeof ANALISIS>,
  true satisfies Completa<AlertaDeSesion, typeof ALERTA>,
  true satisfies Completa<EntradaDelHistorial, typeof ENTRADA>,
  true satisfies Completa<Metricas, typeof METRICAS>,
];

const ESTADOS: readonly EstadoDelAnalisis[] = ["not_analyzed", "analyzed", "insufficient_evidence", "unavailable"];
const ORIGENES = ["model", "event"];

/**
 * Los problemas de un objeto frente a su lista de campos: los que faltan y los que sobran (un campo renombrado
 * aparece en los dos). Vacío si coincide.
 */
function revisarCampos(donde: string, objeto: unknown, obligatorios: readonly string[], opcionales: readonly string[] = []): string[] {
  if (typeof objeto !== "object" || objeto === null) return [`${donde}: no es un objeto`];
  const claves = Object.keys(objeto);
  const faltan = obligatorios.filter((c) => !claves.includes(c)).map((c) => `${donde}: falta «${c}»`);
  const sobran = claves.filter((c) => !obligatorios.includes(c) && !opcionales.includes(c)).map((c) => `${donde}: sobra «${c}»`);
  return [...faltan, ...sobran];
}

const ESTADOS_DE_CAPTURA = ["ok", "none", "gap", "js_disabled", "no_start"];
const esFecha = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v));

/**
 * `capture` como la arma el backend (capture/state.go): `last_event_at` si llegó algún evento, y con el corte
 * («gap») siempre `gap_minutes` y `last_event_at`, que son los que el aviso del detalle usa para decir el rango.
 */
function problemasDeLaCaptura(donde: string, captura: unknown): string[] {
  const problemas = revisarCampos(donde, captura, ["state"], ["gap_minutes", "last_event_at"]);
  if (problemas.length > 0) return problemas;
  const c = captura as Objeto;
  if (!ESTADOS_DE_CAPTURA.includes(c.state as string)) problemas.push(`${donde}.state: valor raro`);
  if ("last_event_at" in c && !esFecha(c.last_event_at)) problemas.push(`${donde}.last_event_at: no es una fecha`);
  if (c.state === "gap") {
    if (!Number.isInteger(c.gap_minutes) || (c.gap_minutes as number) < 1) problemas.push(`${donde}: «gap» sin gap_minutes`);
    if (!("last_event_at" in c)) problemas.push(`${donde}: «gap» sin last_event_at`);
  } else if ("gap_minutes" in c) {
    problemas.push(`${donde}: gap_minutes fuera de un corte`);
  }
  return problemas;
}

/** Todos los problemas de la respuesta de la lista: campos y valores. */
function problemasDeLaLista(lista: { _headers: Objeto; body: Objeto }): string[] {
  const problemas: string[] = [];
  const sesiones = Array.isArray(lista.body.sessions) ? (lista.body.sessions as Objeto[]) : [];
  const resumen = (lista.body.summary ?? {}) as Objeto;
  problemas.push(...revisarCampos("body", lista.body, ["sessions", "summary"]));
  problemas.push(...revisarCampos("summary", lista.body.summary, RESUMEN));
  for (const clave of RESUMEN) {
    const n = resumen[clave];
    if (!Number.isInteger(n) || (n as number) < 0) problemas.push(`summary.${clave}: no es un recuento`);
  }
  if (!("X-Total-Count" in lista._headers)) problemas.push("falta la cabecera X-Total-Count");
  sesiones.forEach((s, i) => {
    const donde = `sessions[${i}]`;
    problemas.push(...revisarCampos(donde, s, SESION_OBLIGATORIOS, SESION_OPCIONALES));
    problemas.push(...problemasDeLaCaptura(`${donde}.capture`, s.capture));
    if (!ESTADOS.includes(s.analysis_state as EstadoDelAnalisis)) problemas.push(`${donde}.analysis_state: valor raro`);
    if (s.risk_level !== null && !(NIVELES_DE_RIESGO as readonly unknown[]).includes(s.risk_level)) {
      problemas.push(`${donde}.risk_level: valor raro`);
    }
    const origenes = s.alert_origins as unknown[];
    if (!Array.isArray(origenes) || origenes.some((o) => !ORIGENES.includes(o as string)) || origenes.length !== s.alerts_count) {
      problemas.push(`${donde}.alert_origins: no coincide con alerts_count`);
    }
    const [n, m] = [s.attempt_number as number, s.attempts_total as number];
    if (!Number.isInteger(n) || !Number.isInteger(m) || n < 1 || n > m) problemas.push(`${donde}: «intento N de M» raro`);
  });
  return problemas;
}

/** Todos los problemas de la respuesta del análisis. */
function problemasDelAnalisis(a: Objeto): string[] {
  const problemas = revisarCampos("analysis", a, ANALISIS);
  (a.alerts as unknown[] | undefined)?.forEach((x, i) => problemas.push(...revisarCampos(`alerts[${i}]`, x, ALERTA)));
  (a.alert_history as unknown[] | undefined)?.forEach((x, i) => problemas.push(...revisarCampos(`alert_history[${i}]`, x, ENTRADA)));
  // El backend manda `metrics: null` con la sesión abierta y cuando no se pudo analizar; si vienen, cada una es
  // un número o null (una métrica que no se pudo calcular).
  if (a.metrics !== null) {
    problemas.push(...revisarCampos("metrics", a.metrics, METRICAS));
    if (typeof a.metrics === "object" && a.metrics !== null) {
      for (const [clave, valor] of Object.entries(a.metrics)) {
        if (valor !== null && typeof valor !== "number") problemas.push(`metrics.${clave}: no es un número ni null`);
      }
    }
  }
  if (a.reason !== null && typeof a.reason !== "string") problemas.push("analysis.reason: no es un texto ni null");
  if (!ESTADOS.includes(a.state as EstadoDelAnalisis)) problemas.push("analysis.state: valor raro");
  return problemas;
}

/** Copia profunda con un campo renombrado en el primer objeto donde aparece: el error que esta prueba atrapa. */
function renombrar<T>(datos: T, de: string, a: string): T {
  let hecho = false;
  const json = JSON.stringify(datos, function (this: unknown, _clave, valor: unknown) {
    if (!hecho && valor && typeof valor === "object" && !Array.isArray(valor) && de in valor) {
      hecho = true;
      const copia: Objeto = {};
      for (const [k, v] of Object.entries(valor)) copia[k === de ? a : k] = v;
      return copia;
    }
    return valor;
  });
  return JSON.parse(json) as T;
}

const leerLista = () => JSON.parse(crudoDeLaLista) as { _headers: Objeto; body: Objeto };
const leerAnalisis = () => JSON.parse(crudoDelAnalisis) as Objeto;
const leerSinEvidencia = () => JSON.parse(crudoSinEvidencia) as Objeto;

/** Un `fetch` que contesta como el backend: la lista con su cabecera, o el análisis. */
function simularBackend(lista = leerLista(), analisis = leerAnalisis()) {
  const fetch = vi.fn(async (url: string) => {
    const esAnalisis = url.includes("/analysis");
    const cabeceras = new Map(Object.entries(esAnalisis ? {} : lista._headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
    return {
      ok: true,
      status: 200,
      headers: { get: (nombre: string) => cabeceras.get(nombre.toLowerCase()) ?? null },
      json: async () => structuredClone(esAnalisis ? analisis : lista.body),
    };
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function guardarIngreso() {
  sessionStorage.clear();
  sessionStorage.setItem(
    "samce_session",
    JSON.stringify({
      token: "session-jwt",
      username: "docente.demo",
      displayName: "Docente de Prueba",
      role: "docente",
      courseId: 2,
      courseName: "Sistemas de Información II",
    })
  );
}

const numerar = (s: Sesion): SesionNumerada => ({ ...s, examenId: 3, intento: s.attempt_number!, intentos: s.attempts_total! });

describe("El contrato con el backend (pendiente 16)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    guardarIngreso();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("las listas de campos cubren todos los campos de los tipos", () => {
    expect(LISTAS_COMPLETAS.every(Boolean)).toBe(true);
  });

  it("las tres respuestas guardadas traen exactamente los campos del contrato", () => {
    expect(problemasDeLaLista(leerLista())).toEqual([]);
    expect(problemasDelAnalisis(leerAnalisis())).toEqual([]);
    expect(problemasDelAnalisis(leerSinEvidencia())).toEqual([]);
  });

  it("los JSON cubren lo que el backend real manda: métricas nulas, motivo con texto y la captura completa (INT-03, H01)", () => {
    const cerrado = leerAnalisis();
    expect(Object.values(cerrado.metrics as Objeto)).toContain(null);
    const sinEvidencia = leerSinEvidencia();
    expect(sinEvidencia.metrics).toBeNull();
    expect(typeof sinEvidencia.reason).toBe("string");
    const capturas = (leerLista().body.sessions as Objeto[]).map((s) => s.capture as Objeto);
    expect(capturas.some((c) => c.state === "gap" && Number.isInteger(c.gap_minutes) && "last_event_at" in c)).toBe(true);
    expect(capturas.some((c) => c.state === "ok" && "last_event_at" in c)).toBe(true);
  });

  it("la revisión de la captura atrapa un corte sin sus datos y un campo renombrado (H01)", () => {
    const lista = leerLista();
    const corte = (lista.body.sessions as Objeto[]).findIndex((s) => (s.capture as Objeto).state === "gap");
    const sinMinutos = structuredClone(lista);
    delete ((sinMinutos.body.sessions as Objeto[])[corte].capture as Objeto).gap_minutes;
    expect(problemasDeLaLista(sinMinutos)).toContain(`sessions[${corte}].capture: «gap» sin gap_minutes`);
    expect(problemasDeLaLista(renombrar(lista, "gap_minutes", "gapMinutes"))).not.toEqual([]);
    expect(problemasDeLaLista(renombrar(lista, "last_event_at", "lastEventAt"))).not.toEqual([]);
  });

  it("un campo renombrado en cualquier lugar del JSON hace fallar la revisión", () => {
    // Cada campo de cada objeto, renombrado de a uno: ninguno pasa inadvertido.
    const lista = leerLista();
    const camposDeLaLista = [...SESION_OBLIGATORIOS, ...RESUMEN, "sessions", "summary", "state"];
    for (const campo of camposDeLaLista) {
      expect(problemasDeLaLista(renombrar(lista, campo, `${campo}_v2`)), campo).not.toEqual([]);
    }
    const sinEvidencia = leerSinEvidencia();
    for (const campo of ANALISIS) {
      expect(problemasDelAnalisis(renombrar(sinEvidencia, campo, `${campo}_v2`)), campo).not.toEqual([]);
    }
    const analisis = leerAnalisis();
    for (const campo of [...ANALISIS, ...ALERTA, ...ENTRADA, ...METRICAS]) {
      expect(problemasDelAnalisis(renombrar(analisis, campo, `${campo}_v2`)), campo).not.toEqual([]);
    }
    expect(problemasDeLaLista(renombrar(lista, "analysis_state", "analysisState"))).toContain("sessions[0]: falta «analysis_state»");
  });

  it("traerSesiones lee el resumen con sus ocho recuentos, el total de la cabecera y cada sesión entera", async () => {
    simularBackend();
    const { sesiones, total, resumen } = await traerSesiones(3, 50, {});

    expect(total).toBe(7);
    expect(sesiones).toHaveLength(7);
    expect(resumen).not.toBeNull();
    for (const clave of RESUMEN) expect(typeof resumen![clave], clave).toBe("number");
    for (const s of sesiones) {
      expect(ESTADOS).toContain(s.analysis_state);
      expect(Number.isInteger(s.attempt_number)).toBe(true);
      expect(Number.isInteger(s.attempts_total)).toBe(true);
    }
    // Una sesión por situación: los tres niveles y los cuatro estados sin alertas.
    expect(sesiones.map((s) => s.risk_level ?? s.analysis_state)).toEqual([
      "high", "medium", "low", "analyzed", "not_analyzed", "insufficient_evidence", "unavailable",
    ]);
  });

  it("traerAnalisis trae el historial y las métricas", async () => {
    simularBackend();
    const a = await traerAnalisis(3, 501);

    expect(a.alert_history).toBeDefined();
    expect(a.alert_history).toHaveLength(2);
    expect(a.metrics).toBeDefined();
    expect(a.metrics).not.toBeNull();
    expect(a.alert_history!.some((e) => e.carried_over)).toBe(true);
  });

  it("la lista dibuja la columna «Análisis» de las siete sesiones y el resumen sus siete tarjetas", async () => {
    simularBackend();
    const { sesiones, resumen } = await traerSesiones(3, 50, {});
    const numeradas = sesiones.map(numerar);
    const { container } = render(
      createElement("div", null,
        createElement(ResumenEvaluacion, { resumen: resumen!, filtros: {}, onFiltrar: () => {} }),
        createElement(ListaSesiones, {
          titulo: "En curso", sesiones: numeradas.filter((s) => s.status === "open"), onVerEventos: () => {},
        }),
        createElement(ListaSesiones, {
          titulo: "Finalizadas", sesiones: numeradas.filter((s) => s.status !== "open"), cerradas: true, onVerEventos: () => {},
        })
      )
    );

    const celdas = Array.from(container.querySelectorAll("tbody td.tabla__analisis"));
    expect(celdas).toHaveLength(7);
    for (const celda of celdas) expect(celda.textContent!.trim(), celda.closest("tr")!.textContent!).not.toBe("");
    expect(container.querySelectorAll(".resumen__tarjeta")).toHaveLength(7);
    expect(container.textContent).toContain("intento 2 de 2");
    // La marca de captura queda afuera: sus textos son del Sprint 3 y no entran en esta revisión.
    expectLenguajeLlano(container, { excluir: ".alumno__captura" });
  });

  it("el detalle de una sesión que no se pudo analizar muestra el motivo y no dibuja métricas", async () => {
    vi.useFakeTimers();
    simularBackend(leerLista(), leerSinEvidencia());
    const { sesiones } = await traerSesiones(3, 50, {});
    const sesion = numerar(sesiones.find((s) => s.analysis_state === "insufficient_evidence")!);
    const { container } = render(createElement(AnalisisSesion, { sesion, onVencida: () => {} }));
    await esperar();

    expect(container.textContent).toContain("Esta sesión no se pudo analizar.");
    expect(container.textContent).toContain(leerSinEvidencia().reason as string);
    expect(container.querySelectorAll(".metricas__metrica")).toHaveLength(0);
  });

  it("el detalle de una sesión cerrada dibuja la evolución, el historial y seis métricas, sin las proporciones", async () => {
    vi.useFakeTimers();
    simularBackend();
    const { sesiones } = await traerSesiones(3, 50, {});
    const cerrada = numerar(sesiones[0]);
    const { container } = render(createElement(AnalisisSesion, { sesion: cerrada, onVencida: () => {} }));
    await esperar();

    expect(container.textContent).toContain("Análisis de las");
    expect(container.querySelectorAll(".analisis__alerta")).toHaveLength(2);
    expect(container.querySelectorAll(".metricas__metrica")).toHaveLength(6);
    const claves = Array.from(container.querySelectorAll(".metricas__metrica")).map((m) => m.getAttribute("data-clave"));
    expect(claves).not.toContain("outside_time_ratio");
    expect(claves).not.toContain("pasted_chars_ratio");
    // Ni el 0,29 ni el 0,41 de las proporciones, en ninguna forma, ni ningún porcentaje.
    expect(container.textContent).not.toMatch(/0[,.]29|0[,.]41|\b29\s?%|\b41\s?%|%/);
    expectLenguajeLlano(container, { excluir: ".alumno__captura" });
  });
});
