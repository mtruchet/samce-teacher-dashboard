import { API_CONFIG } from "../config/api.config";
import { getStoredSession } from "./authService";
import type { FiltrosSesiones } from "../filtrosDeLaDireccion";

/**
 * Los exámenes monitoreados del docente y sus sesiones.
 *
 * Ningún curso se manda en las llamadas: salen del JWT, así que un docente solo
 * puede ver lo suyo. Da igual si entró desde un curso o por el enlace general
 * del campus: el mismo endpoint devuelve los exámenes de los cursos que el
 * token autoriza, y el backend lo verifica de nuevo en cada pedido.
 */

export interface ExamenMonitoreado {
  id: number;
  /** De qué curso es. Hace falta para agrupar cuando el panel abarca varios. */
  moodle_course_id: number;
  moodle_quiz_id: number;
  name: string;
  created_at: string;
  /**
   * Cuántas sesiones tiene el examen, por estado. Las cuenta el backend en la
   * misma consulta de la lista.
   */
  open_sessions: number;
  closed_sessions: number;
  /** Intentos que vencieron o se abandonaron sin entregarse. */
  abandoned_sessions: number;
}

/**
 * Los niveles de riesgo, de menor a mayor. Es el único lugar donde está el orden: el peso de cada nivel, sus
 * palabras y el tipo salen de acá (ver `lenguajeAlerta.ts`).
 */
export const NIVELES_DE_RIESGO = ["low", "medium", "high"] as const;
export type NivelDeRiesgo = (typeof NIVELES_DE_RIESGO)[number];

export interface Sesion {
  id: number;
  moodle_attempt_id: number;
  /** El backend descifra la referencia protegida y devuelve el id del alumno. */
  moodle_user_id: number;
  /**
   * Nombre y apellido, como lo escribe el campus. Viaja cifrado y el backend lo
   * descifra al responder. Puede llegar vacío en sesiones registradas antes de
   * que el aula virtual empezara a mandarlo.
   */
  student_name: string;
  status: "open" | "closed" | "abandoned";
  started_at: string;
  closed_at?: string;
  /** Si la captura de eventos estuvo funcionando. Sin el campo (un backend viejo) no se marca nada. */
  capture?: Captura;
  /**
   * El nivel de riesgo de la sesión: el más alto entre los de sus alertas. Nulo si no tiene
   * alertas, que no es lo mismo que riesgo bajo. Sin el campo (un backend viejo) no se marca nada.
   */
  risk_level?: NivelDeRiesgo | null;
  /** Cuántas alertas tiene: a lo sumo una por origen. */
  alerts_count?: number;
  /** De dónde salió cada alerta, la de toda la sesión primero. */
  alert_origins?: Array<"model" | "event">;
  /** El estado del último análisis, el mismo de `EstadoDelAnalisis`. */
  analysis_state?: EstadoDelAnalisis;
  /** «Intento N de M» del alumno, contado por el backend sobre toda la evaluación antes de filtrar. */
  attempt_number?: number;
  attempts_total?: number;
}

/**
 * Cómo estuvo la captura en una sesión. Es una señal para el docente y no una
 * prueba: puede haber un motivo técnico legítimo.
 */
export interface Captura {
  /**
   * ok; none (no llegó ningún evento); gap (un silencio largo mientras el examen
   * seguía); js_disabled (una página se cargó con JavaScript apagado); no_start
   * (se cargó una página y la captura no arrancó).
   */
  state: "ok" | "none" | "gap" | "js_disabled" | "no_start";
  gap_minutes?: number;
  last_event_at?: string;
}

/**
 * Un evento de interacción del alumno durante un intento, tal como se guardó.
 *
 * El backend no lo interpreta ni le agrega nada: no trae índice de integridad,
 * nivel de riesgo ni alertas, y no viene ordenado por relevancia sino por orden
 * de llegada. Tampoco lleva ningún dato del alumno: pertenece a
 * una sesión, y la sesión es la que sabe de quién es.
 */
export interface Evento {
  /**
   * Orden de llegada al servidor. Es el cursor para pedir solo lo nuevo: el
   * `seq` no sirve para eso, porque un evento que llega tarde puede traer uno
   * menor al último visto.
   */
  id: number;
  /**
   * Número creciente que arma el navegador, único dentro de la sesión. Ordena
   * los eventos que llegaron juntos al servidor.
   */
  seq: number;
  /** Qué pestaña del navegador lo generó, si el complemento lo informó. */
  context_id?: string;
  /** Qué pasó. Ver `describirEvento` para cómo se cuenta cada tipo. */
  type: string;
  /** Hora según el reloj del alumno. No es confiable: el reloj puede estar mal. */
  occurred_at: string;
  /** Hora en que el servidor lo recibió. Es la que manda. */
  received_at: string;
  /** Contenido del evento; depende de `type`. */
  data: Record<string, unknown>;
}

/** Cada cuánto el panel y el registro de una sesión vuelven a preguntar. */
export const CADENCIA_MS = 5000;

/** Cuántos eventos se piden por vez. Es el máximo que acepta el backend. */
export const EVENTOS_POR_PAGINA = 1000;

/**
 * Cuánto se espera una respuesta antes de darla por perdida.
 *
 * Un `fetch` sin plazo no falla nunca: si el servidor acepta la conexión y no
 * contesta, la promesa queda colgada, el `catch` no corre y el panel sigue
 * diciendo «En vivo» sobre datos viejos, con un pedido nuevo cada cinco
 * segundos que tampoco va a volver.
 *
 * Cuatro ciclos y no dos: con diez segundos, un servidor vivo pero lento
 * —once por pedido— aborta en cada vuelta y la pantalla diría «Sin conexión»
 * de forma permanente sobre algo que está contestando, que es peor que el
 * problema. Un backend que tarda más de veinte ya no sirve para una pantalla
 * que se refresca cada cinco.
 */
const PLAZO = 20_000;

/**
 * El backend rechazó el token de sesión.
 *
 * Se distingue de cualquier otro fallo porque no se arregla reintentando: el
 * token dura ocho horas y, cuando vence, el panel tiene que decirlo en vez de
 * seguir mostrando la última pantalla como si nada.
 */
export class SesionVencida extends Error {
  constructor() {
    super("la sesión del panel ya no vale");
    this.name = "SesionVencida";
  }
}

async function pedir<T>(ruta: string): Promise<T> {
  return (await (await pedirRespuesta(ruta)).json()) as T;
}

/** El pedido con el token, el plazo y el manejo del token vencido; devuelve la respuesta entera. */
async function pedirRespuesta(ruta: string): Promise<Response> {
  const sesion = getStoredSession();
  if (!sesion) {
    throw new SesionVencida();
  }

  const respuesta = await fetch(`${API_CONFIG.BASE_URL}${ruta}`, {
    headers: { Authorization: `Bearer ${sesion.token}` },
    signal: AbortSignal.timeout(PLAZO),
  });

  if (respuesta.status === 401) {
    throw new SesionVencida();
  }

  if (!respuesta.ok) {
    throw new Error(`${ruta} respondió ${respuesta.status}`);
  }

  return respuesta;
}

/**
 * Una sesión junto con el examen del que salió: el registro de eventos se pide
 * por examen y sesión, y el backend verifica que la sesión sea de ese examen.
 */
export interface SesionDeExamen extends Sesion {
  /** Del examen monitoreado, no del cuestionario de Moodle. */
  examenId: number;
}

/**
 * Una sesión con el lugar que ocupa entre los intentos de ese alumno en ese
 * examen: la primera es 1 de 2, la segunda 2 de 2.
 *
 * Se cuenta acá y no se usa el `moodle_attempt_id` porque ese número es el
 * identificador interno de Moodle, corre por todo el campus y no dice nada:
 * dos intentos seguidos del mismo alumno pueden ser el 7001 y el 90004.
 */
export interface SesionNumerada extends SesionDeExamen {
  intento: number;
  intentos: number;
}

export function traerExamenes(): Promise<ExamenMonitoreado[]> {
  return pedir<ExamenMonitoreado[]>(API_CONFIG.ENDPOINTS.MONITORED_QUIZZES);
}

/** Cuántas sesiones se muestran por vez en la lista de un examen. */
export const SESIONES_POR_PAGINA = 50;

/**
 * Cuántas sesiones devuelve el backend como mucho, por más que se le pidan más
 * (`maxSessionsLimit` en list_sessions.go).
 *
 * Está acá porque el panel tiene que saberlo: pedir 1050 y recibir 1000 sin
 * ninguna marca de recorte hacía que el botón de «Ver más» siguiera apareciendo,
 * trajera exactamente lo mismo que ya estaba, y recién ahí desapareciera. El
 * docente apretaba y no pasaba nada.
 */
export const SESIONES_TOPE = 1000;

/**
 * Las sesiones de un examen: las en curso primero y después las finalizadas,
 * cada grupo con las más recientes arriba. `limite` es cuántas pedir desde la
 * primera; el panel lo sube de a 50 con «Ver más» y sigue refrescando todo lo
 * que ya mostró.
 */
/** Un total que no es un número entero no negativo (cabecera ausente, vacía o rara) no se usa: así nunca se ve «NaN de 30». */
function cifra(valor: string | null): number | null {
  if (valor === null || valor.trim() === "") return null;
  const n = Number(valor);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export async function traerSesiones(
  examenId: number,
  limite = SESIONES_POR_PAGINA,
  filtros: FiltrosSesiones = {}
): Promise<PaginaDeSesiones> {
  // Nunca por encima del tope del backend: pedir de más no trae de más, y lo
  // único que consigue es que la cuenta del panel no cierre.
  const consulta = new URLSearchParams({ limit: String(Math.min(limite, SESIONES_TOPE)), include: "summary" });
  if (filtros.nivel) consulta.set("risk_level", filtros.nivel);
  if (filtros.estado) consulta.set("status", filtros.estado);
  if (filtros.analisis) consulta.set("analysis", filtros.analisis);
  if (filtros.q) consulta.set("q", filtros.q);
  if (filtros.orden) consulta.set("sort", filtros.orden);

  const respuesta = await pedirRespuesta(`${API_CONFIG.ENDPOINTS.MONITORED_QUIZZES}/${examenId}/sessions?${consulta}`);
  const cuerpo = (await respuesta.json()) as Sesion[] | { sessions: Sesion[]; summary: ResumenDeEvaluacion };
  const total = cifra(respuesta.headers.get("X-Total-Count"));
  // Lectura tolerante: un backend sin el resumen devuelve el arreglo de siempre.
  return Array.isArray(cuerpo)
    ? { sesiones: cuerpo, total, resumen: null }
    : { sesiones: cuerpo.sessions, total, resumen: cuerpo.summary };
}

/**
 * El resumen de la evaluación (HU03): cuántas sesiones hay en cada nivel de riesgo y, las que no tienen
 * alertas, en cada estado del análisis. Cuenta toda la evaluación (hasta 1000 sesiones), no la página
 * ni el filtro. Son recuentos: sin nombres, sin índice, sin promedios.
 */
export interface ResumenDeEvaluacion {
  total: number;
  risk_high: number;
  risk_medium: number;
  risk_low: number;
  no_alerts: number;
  not_analyzed: number;
  insufficient_evidence: number;
  unavailable: number;
}

/** Una página de la lista de un examen, con lo que el backend dice de toda la evaluación. */
export interface PaginaDeSesiones {
  sesiones: Sesion[];
  /** Cuántas cumplen el filtro en toda la evaluación (cabecera X-Total-Count); null con un backend viejo. */
  total: number | null;
  /** El resumen de la evaluación; null si el backend devuelve el arreglo de siempre. */
  resumen: ResumenDeEvaluacion | null;
}

/**
 * Los eventos de una sesión, por orden de llegada al servidor.
 *
 * `despuesDeId` es el `id` del último evento que ya se tiene: el panel vuelve a
 * preguntar cada pocos segundos y así trae solo lo nuevo, en vez de repetir
 * todo lo que ya mostró. El examen tiene que ser del que salió la sesión: el
 * backend lo verifica, y responde 404 si la sesión es de otro examen.
 */
export function traerEventos(examenId: number, sesionId: number, despuesDeId = 0): Promise<Evento[]> {
  // after_id se manda siempre, aun en cero: es lo que pide el orden de llegada.
  const consulta = new URLSearchParams({
    limit: String(EVENTOS_POR_PAGINA),
    after_id: String(despuesDeId),
  });

  return pedir<Evento[]>(
    `${API_CONFIG.ENDPOINTS.MONITORED_QUIZZES}/${examenId}/sessions/${sesionId}/events?${consulta}`
  );
}

/**
 * Cómo está el análisis de una sesión (SAMCE-36).
 *
 * not_analyzed: todavía no hay ningún cálculo. analyzed: se analizó, con alertas o sin
 * ellas. insufficient_evidence: no tuvo evidencia suficiente (poca actividad o captura
 * incompleta). unavailable: el motor no pudo analizarla, por ejemplo sin modelo cargado.
 */
export type EstadoDelAnalisis = "not_analyzed" | "analyzed" | "insufficient_evidence" | "unavailable";

/**
 * Una alerta vigente de la sesión. A lo sumo hay una de cada origen. Es una señal para
 * revisar y no una conclusión: la explicación describe lo observado sin atribuir intención.
 */
export interface AlertaDeSesion {
  /** model: el índice de integridad bajó del umbral. event: un solo evento, el pegado de un bloque largo. */
  origin: "model" | "event";
  level: NivelDeRiesgo;
  explanation: string;
  /** Desde cuándo la alerta está en su nivel actual (sube cuando el nivel sube). */
  level_since: string;
  created_at: string;
  updated_at: string;
}

/** Una aparición o subida de nivel de una alerta, en el historial de la sesión (HU05). */
export interface EntradaDelHistorial {
  origin: "model" | "event";
  level: NivelDeRiesgo;
  explanation: string;
  /** Hora del análisis que la registró, no la del hecho. */
  recorded_at: string;
  /** Copiada de la alerta vigente al empezar a guardar el historial: lo anterior no quedó registrado. */
  carried_over: boolean;
}

/** El valor del propio alumno en cada métrica del cierre. Sin lo esperado. Nulo si no hubo dato. */
export type Metricas = Record<
  | "outside_time_ratio" | "outside_longest_s" | "typing_rate_median_per_s"
  | "largest_paste_chars" | "pasted_chars_ratio" | "mouse_idle_longest_s"
  | "question_time_median_s" | "silence_longest_s",
  number | null
>;

/**
 * El análisis de una sesión: su estado, la hora del último cálculo, sus alertas vigentes, el historial
 * de esas alertas y las métricas del cierre (HU05). Nunca el índice de integridad.
 */
export interface Analisis {
  state: EstadoDelAnalisis;
  /** Por qué no hay índice (poca actividad, sin modelo...). Nulo si se analizó o todavía no. */
  reason: string | null;
  /** Hora del último cálculo. Nulo si todavía no se analizó. */
  calculated_at: string | null;
  alerts: AlertaDeSesion[];
  /** Cada aparición o subida de nivel, en orden. Sin el campo (un backend viejo), no se muestra. */
  alert_history?: EntradaDelHistorial[];
  /** Las métricas del cierre. Nulas mientras la sesión sigue abierta o si no se pudo analizar. */
  metrics?: Metricas | null;
}

/** El análisis de una sesión: su estado, el último cálculo y las alertas vigentes. */
export function traerAnalisis(examenId: number, sesionId: number): Promise<Analisis> {
  return pedir<Analisis>(
    `${API_CONFIG.ENDPOINTS.MONITORED_QUIZZES}/${examenId}/sessions/${sesionId}/analysis`
  );
}

/**
 * Cómo se llama al alumno de una sesión en la pantalla.
 *
 * Tres casos. Si el backend pudo descifrar el nombre, va el nombre. Si solo
 * pudo con el identificador, va «Alumno 41», que es el número del aula virtual.
 * Y si no pudo con ninguno de los dos, manda un `moodle_user_id` negativo —un
 * centinela, único por sesión, para que el panel no junte por error sesiones
 * sin relación— y ahí no hay identidad que mostrar: decir «Alumno -29» sería
 * enseñar un número interno como si fuera un legajo.
 *
 * La sesión aparece igual, a propósito: si no, el docente no tendría forma de
 * saber que le falta alguien.
 */
export function nombreDeAlumno(sesion: Pick<Sesion, "student_name" | "moodle_user_id">): string {
  if (sesion.student_name) return sesion.student_name;
  if (sesion.moodle_user_id < 0) return "Alumno sin identificar";
  return `Alumno ${sesion.moodle_user_id}`;
}
