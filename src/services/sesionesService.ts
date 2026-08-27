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
}

export interface Sesion {
  id: number;
  moodle_attempt_id: number;
  /** El backend descifra la referencia protegida y devuelve el id del alumno. */
  moodle_user_id: number;
  status: "open" | "closed";
  started_at: string;
  closed_at?: string;
}

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
