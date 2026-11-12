import type { Page, Route } from "@playwright/test";
import sesionesDelContrato from "../src/test/contrato/sesiones_con_resumen.json" with { type: "json" };
import analisisCerrado from "../src/test/contrato/analisis_cerrado.json" with { type: "json" };

/**
 * El backend simulado de las pruebas de navegador.
 *
 * La construcción de prueba apunta la API a «/api» del mismo origen (ver playwright.config.ts), y acá se
 * contestan esos pedidos con datos falsos. Nunca sale un pedido a Railway ni a un backend local. Los nombres
 * de los alumnos son ficticios.
 *
 * Parte de los dos archivos del contrato (src/test/contrato/): las siete situaciones de la lista y el
 * análisis cerrado con historial copiado salen de ahí, así que si el contrato cambia, estas pruebas lo ven.
 */

type Nivel = "low" | "medium" | "high";
type Origen = "model" | "event";
type Estado = "not_analyzed" | "analyzed" | "insufficient_evidence" | "unavailable";

interface SesionFalsa {
  id: number;
  moodle_attempt_id: number;
  moodle_user_id: number;
  student_name: string;
  status: "open" | "closed" | "abandoned";
  started_at: string;
  closed_at?: string;
  capture: { state: "ok" };
  risk_level: Nivel | null;
  alerts_count: number;
  alert_origins: Origen[];
  analysis_state: Estado;
  attempt_number: number;
  attempts_total: number;
}

export const EXAMEN = 1;
const CURSO = 7;

/** La sesión del docente, tal como la deja AuthCallback en sessionStorage después de canjear el token. */
const SESION_DEL_DOCENTE = {
  token: "token-de-prueba",
  username: "docente.prueba",
  displayName: "Docente de Prueba",
  role: "editingteacher",
  courseId: CURSO,
  courseName: "Álgebra y Geometría Analítica",
};

const EXAMENES = [
  {
    id: EXAMEN,
    moodle_course_id: CURSO,
    moodle_quiz_id: 70,
    name: "Primer parcial",
    created_at: "2026-10-20T12:00:00Z",
    open_sessions: 2,
    closed_sessions: 19,
    abandoned_sessions: 1,
  },
];

/** Más sesiones finalizadas, para que la lista sea larga y la barra fija tenga algo que tapar. */
const NOMBRES = [
  "Agustina Molina", "Federico Herrera", "Camila Domínguez", "Santiago Romero", "Micaela Torres",
  "Nicolás Giménez", "Florencia Acosta", "Matías Medina", "Julieta Castro", "Lautaro Vega",
  "Sofía Navarro", "Ignacio Peralta", "Rocío Luna", "Gonzalo Paz", "Abril Correa",
];
const NIVELES_DE_LAS_DEMAS: Array<Nivel | null> = [
  "high", "medium", "low", null, "medium", "high", null, "low", "medium", "high", null, "low", "medium", null, "low",
];

function hora(base: string, minutos: number): string {
  return new Date(Date.parse(base) + minutos * 60_000).toISOString();
}

export const SESIONES: SesionFalsa[] = [
  ...(sesionesDelContrato.body.sessions as SesionFalsa[]),
  ...NOMBRES.map((nombre, i): SesionFalsa => {
    const nivel = NIVELES_DE_LAS_DEMAS[i];
    const origenes: Origen[] = nivel === null ? [] : i % 3 === 0 ? ["model", "event"] : ["model"];
    const inicio = hora("2026-10-23T12:00:00Z", 2 + i);
    return {
      id: 600 + i,
      moodle_attempt_id: 9200 + i,
      moodle_user_id: 80 + i,
      student_name: nombre,
      status: "closed",
      started_at: inicio,
      closed_at: hora(inicio, 35 + i),
      capture: { state: "ok" },
      risk_level: nivel,
      alerts_count: origenes.length,
      alert_origins: origenes,
      analysis_state: "analyzed",
      attempt_number: 1,
      attempts_total: 1,
    };
  }),
];

const PESO: Record<Nivel, number> = { low: 1, medium: 2, high: 3 };

/** El resumen se cuenta sobre toda la evaluación, como el backend: sin filtro ni página. */
function resumen() {
  const sin = (estado: Estado) => SESIONES.filter((s) => s.alerts_count === 0 && s.analysis_state === estado).length;
  return {
    total: SESIONES.length,
    risk_high: SESIONES.filter((s) => s.risk_level === "high").length,
    risk_medium: SESIONES.filter((s) => s.risk_level === "medium").length,
    risk_low: SESIONES.filter((s) => s.risk_level === "low").length,
    no_alerts: sin("analyzed"),
    not_analyzed: sin("not_analyzed"),
    insufficient_evidence: sin("insufficient_evidence"),
    unavailable: sin("unavailable"),
  };
}

function filtrar(consulta: URLSearchParams): SesionFalsa[] {
  const nivel = consulta.get("risk_level");
  const estado = consulta.get("status");
  const analisis = consulta.get("analysis");
  const q = consulta.get("q")?.toLocaleLowerCase("es");
  let lista = SESIONES.filter((s) => {
    if (nivel && s.risk_level !== nivel) return false;
    if (estado === "open" && s.status !== "open") return false;
    if (estado === "finished" && s.status === "open") return false;
    if (analisis === "no_alerts" && !(s.alerts_count === 0 && s.analysis_state === "analyzed")) return false;
    if (analisis && analisis !== "no_alerts" && !(s.alerts_count === 0 && s.analysis_state === analisis)) return false;
    if (q && !s.student_name.toLocaleLowerCase("es").includes(q)) return false;
    return true;
  });
  // Las en curso primero y, dentro de cada grupo, las más recientes arriba (o por nivel, si se pide).
  lista = [...lista].sort((a, b) => {
    const abierta = Number(b.status === "open") - Number(a.status === "open");
    if (abierta !== 0) return abierta;
    if (consulta.get("sort") === "risk_level") {
      const peso = (b.risk_level ? PESO[b.risk_level] : 0) - (a.risk_level ? PESO[a.risk_level] : 0);
      if (peso !== 0) return peso;
    }
    return Date.parse(b.started_at) - Date.parse(a.started_at);
  });
  return lista;
}

const EXPLICACION_MODELO: Record<Nivel, string> = {
  low: "Este examen se desarrolló de una forma apenas distinta a lo que suele verse en una evaluación.\nLo que más se notó:\n• En general, se tomó más tiempo que la mayoría para responder.",
  medium: "Este examen se desarrolló de una forma un poco distinta a lo que suele verse en una evaluación.\nLo que más se notó:\n• Pasó a otra ventana 4 veces.",
  high: "Este examen se desarrolló de una forma muy distinta a lo que suele verse en una evaluación.\nLo que más se notó:\n• Pasó a otra ventana 9 veces.\n• La vez más larga fue de 40 segundos.",
};
const EXPLICACION_EVENTO =
  "A las 09:20, en la pregunta 2, pegó de una sola vez un texto largo en una respuesta que todavía estaba vacía, algo poco común en un examen.";

const METRICAS = {
  outside_time_ratio: 0.1,
  outside_longest_s: 0,
  typing_rate_median_per_s: 1.04,
  largest_paste_chars: 0,
  pasted_chars_ratio: 0,
  mouse_idle_longest_s: 0,
  question_time_median_s: 95,
  silence_longest_s: 60,
};

function analisisDe(s: SesionFalsa) {
  if (s.id === 501) return analisisCerrado;
  const calculado = s.analysis_state === "not_analyzed" ? null : hora(s.started_at, 20);
  if (s.analysis_state !== "analyzed") {
    const motivo = s.analysis_state === "insufficient_evidence" ? "low_activity" : s.analysis_state === "unavailable" ? "no_model" : null;
    return { state: s.analysis_state, reason: motivo, calculated_at: calculado, alerts: [], alert_history: [], metrics: null };
  }
  const nivel = s.risk_level;
  const alertas = nivel
    ? s.alert_origins.map((origen) => ({
        origin: origen,
        level: origen === "model" ? nivel : "medium",
        explanation: origen === "model" ? EXPLICACION_MODELO[nivel] : EXPLICACION_EVENTO,
        level_since: hora(s.started_at, 12),
        created_at: hora(s.started_at, 12),
        updated_at: hora(s.started_at, 20),
      }))
    : [];
  const historial = alertas.map((a) => ({
    origin: a.origin,
    level: a.level,
    explanation: a.explanation,
    recorded_at: a.level_since,
    carried_over: false,
  }));
  return {
    state: "analyzed",
    reason: null,
    calculated_at: calculado,
    alerts: alertas,
    alert_history: historial,
    metrics: s.status === "open" ? null : METRICAS,
  };
}

/**
 * Los eventos de una sesión: un pegado de texto, un pegado que no es texto, una salida a otra pestaña, una
 * salida de pantalla completa y tecleo de relleno, hasta pasar los 50 para que aparezca «Mostrar 50 más».
 */
function eventosDe(s: SesionFalsa) {
  const base = Date.parse(s.started_at);
  const tipos: Array<[string, Record<string, unknown>]> = [
    ["consent_accepted", {}],
    ["fullscreen", { on: true }],
    ["clipboard", { action: "paste", length: 340, slot: 2, qtype: "essay" }],
    ["focus_lost", {}],
    ["visibility_hidden", {}],
    ["visibility_visible", {}],
    ["focus_gained", { away_ms: 40_000 }],
    ["clipboard", { action: "paste", non_text: true, slot: 3 }],
    ["fullscreen", { on: false }],
  ];
  for (let i = 0; i < 71; i++) tipos.push(["key_activity", { count: 12 + (i % 7) }]);
  return tipos.map(([type, data], i) => {
    const cuando = new Date(base + (i + 1) * 20_000).toISOString();
    return { id: i + 1, seq: i + 1, context_id: "pestana-1", type, occurred_at: cuando, received_at: cuando, data };
  });
}

function json(route: Route, cuerpo: unknown, cabeceras: Record<string, string> = {}) {
  return route.fulfill({ status: 200, contentType: "application/json", headers: cabeceras, body: JSON.stringify(cuerpo) });
}

/** Deja la sesión del docente guardada y contesta todos los pedidos a la API con los datos falsos. */
export async function simularBackend(page: Page): Promise<void> {
  await page.addInitScript((sesion) => {
    window.sessionStorage.setItem("samce_session", JSON.stringify(sesion));
  }, SESION_DEL_DOCENTE);

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const ruta = url.pathname.replace(/^\/api/, "");

    if (ruta === "/monitored-quizzes") return json(route, EXAMENES);

    const lista = ruta.match(/^\/monitored-quizzes\/(\d+)\/sessions$/);
    if (lista) {
      const todas = filtrar(url.searchParams);
      const limite = Number(url.searchParams.get("limit") ?? "50");
      return json(route, { sessions: todas.slice(0, limite), summary: resumen() }, { "X-Total-Count": String(todas.length) });
    }

    const detalle = ruta.match(/^\/monitored-quizzes\/(\d+)\/sessions\/(\d+)\/(analysis|events)$/);
    if (detalle) {
      const sesion = SESIONES.find((s) => s.id === Number(detalle[2]));
      if (!sesion) return route.fulfill({ status: 404, body: "" });
      if (detalle[3] === "analysis") return json(route, analisisDe(sesion));
      const despuesDe = Number(url.searchParams.get("after_id") ?? "0");
      return json(route, eventosDe(sesion).filter((e) => e.id > despuesDe));
    }

    return route.fulfill({ status: 404, body: "" });
  });
}

/** Las direcciones de las vistas que se recorren. */
export const VISTAS = {
  lista: `/panel?examen=${EXAMEN}`,
  listaSinAlertas: `/panel?examen=${EXAMEN}&analisis=no_alerts`,
  listaRiesgoAlto: `/panel?examen=${EXAMEN}&nivel=high`,
  detalleAlto: `/panel?examen=${EXAMEN}&sesion=501`,
  detalleNoAnalizado: `/panel?examen=${EXAMEN}&sesion=505`,
  detalleEnCurso: `/panel?examen=${EXAMEN}&sesion=503`,
} as const;

/** Abre una vista y espera a que tenga contenido real (no el arranque). */
export async function abrir(page: Page, vista: string): Promise<void> {
  await page.goto(vista);
  if (vista.includes("sesion=")) {
    await page.getByRole("heading", { name: "Registro de eventos" }).waitFor();
    await page.getByRole("heading", { name: "Análisis de la sesión" }).waitFor();
    await page.locator(".eventos tbody tr").first().waitFor();
  } else {
    await page.getByRole("heading", { name: "Resumen de la evaluación" }).waitFor();
    await page.locator(".lista table").first().waitFor();
  }
  // Las fuentes cambian los anchos: se mide con las definitivas.
  await page.evaluate(() => document.fonts.ready);
}
