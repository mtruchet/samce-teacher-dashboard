import { API_CONFIG } from "../config/api.config";
import { getStoredSession } from "./authService";

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
   * misma consulta de la lista: el panel ya no pide las sesiones de cada examen
   * solo para contarlas.
   */
  open_sessions: number;
  closed_sessions: number;
  /** Intentos que vencieron o se abandonaron sin entregarse. */
  abandoned_sessions: number;
}

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
}

/**
 * Un evento de interacción del alumno durante un intento, tal como se guardó.
 *
 * El backend no lo interpreta ni le agrega nada: no trae índice de integridad,
 * nivel de riesgo ni alertas, y no viene ordenado por relevancia sino en el
 * orden en que se generaron. Tampoco lleva ningún dato del alumno: pertenece a
 * una sesión, y la sesión es la que sabe de quién es.
 */
export interface Evento {
  /** Número creciente que arma el navegador; sirve para pedir solo lo nuevo. */
  seq: number;
  /** Qué pasó. Ver `describirEvento` para cómo se cuenta cada tipo. */
  type: string;
  /** Hora según el reloj del alumno. No es confiable: el reloj puede estar mal. */
  occurred_at: string;
  /** Hora en que el servidor lo recibió. Es la que manda. */
  received_at: string;
  /** Contenido del evento; depende de `type`. */
  data: Record<string, unknown>;
}

/** Cuántos eventos se piden por vez. Es el máximo que acepta el backend. */
export const EVENTOS_POR_PAGINA = 1000;

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
  const sesion = getStoredSession();
  if (!sesion) {
    throw new SesionVencida();
  }

  const respuesta = await fetch(`${API_CONFIG.BASE_URL}${ruta}`, {
    headers: { Authorization: `Bearer ${sesion.token}` },
  });

  if (respuesta.status === 401) {
    throw new SesionVencida();
  }

  if (!respuesta.ok) {
    throw new Error(`${ruta} respondió ${respuesta.status}`);
  }

  return (await respuesta.json()) as T;
}

/**
 * Una sesión resuelta contra el examen y el curso de los que salió, para poder
 * listarlas todas juntas aunque vengan de cursos distintos.
 */
export interface SesionDeExamen extends Sesion {
  /** Del examen monitoreado, no del cuestionario de Moodle. */
  examenId: number;
  cursoId: number;
  examen: string;
  curso: string;
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

export function traerSesiones(examenId: number): Promise<Sesion[]> {
  return pedir<Sesion[]>(`${API_CONFIG.ENDPOINTS.MONITORED_QUIZZES}/${examenId}/sessions`);
}

/**
 * Los eventos de una sesión, en el orden en que se generaron.
 *
 * `despuesDe` es el `seq` del último evento que ya se tiene: el panel vuelve a
 * preguntar cada pocos segundos y así trae solo lo nuevo, en vez de repetir
 * todo lo que ya mostró. El examen tiene que ser del que salió la sesión: el
 * backend lo verifica, y responde 404 si la sesión es de otro examen.
 */
export function traerEventos(examenId: number, sesionId: number, despuesDe = 0): Promise<Evento[]> {
  const consulta = new URLSearchParams({ limit: String(EVENTOS_POR_PAGINA) });
  if (despuesDe > 0) consulta.set("after_seq", String(despuesDe));

  return pedir<Evento[]>(
    `${API_CONFIG.ENDPOINTS.MONITORED_QUIZZES}/${examenId}/sessions/${sesionId}/events?${consulta}`
  );
}
