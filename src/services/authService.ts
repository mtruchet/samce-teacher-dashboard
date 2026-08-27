import { API_CONFIG } from "../config/api.config";

/** Un curso del docente, tal como lo nombra el campus. */
export interface Curso {
  id: number;
  name: string;
}

/**
 * La sesión del panel, en cualquiera de sus dos formas.
 *
 * Se entra de dos maneras y el token lo dice: desde un curso, y entonces vienen
 * `courseId` y `courseName`; o desde el enlace general del campus, y entonces
 * viene `courses` con todos los cursos donde el docente da clase. Nunca las
 * dos: el complemento arma una o la otra.
 */
export interface SessionInfo {
  token: string;
  username: string;
  /** Nombre y apellido del docente, como lo muestra el campus. */
  displayName: string;
  role: string;
  /** El curso desde el que entró. Vale 0 cuando entró por el enlace general. */
  courseId: number;
  /** Nombre de la materia, no su identificador interno. Vacío en el general. */
  courseName: string;
  /** Todos sus cursos. Sólo llega cuando entró por el enlace general. */
  courses?: Curso[];
}

/** Si la sesión abarca todos los cursos del docente o uno solo. */
export function esPanelGeneral(sesion: SessionInfo): boolean {
  return (sesion.courses?.length ?? 0) > 0;
}

const SESSION_STORAGE_KEY = "samce_session";

interface MoodleVerifyResponse {
  token: string;
  username: string;
  display_name: string;
  role: string;
  course_id: number;
  course_name: string;
  /**
   * Sólo en el lanzamiento general. Trae id y nombre de cada curso, y no viene
   * acompañado de una lista de ids aparte: sería el mismo dato dos veces, y dos
   * copias del mismo dato se terminan desincronizando.
   */
  courses?: Curso[];
}

/**
 * Comprueba que lo guardado tenga de verdad la forma de una sesión.
 *
 * Hace falta porque `sessionStorage` lo escribe el navegador y cualquiera puede
 * poner ahí lo que quiera. Sin esto, un `{}` alcanzaba para abrir el panel: es
 * un objeto verdadero, y la ruta protegida solo miraba si había algo.
 */
function esSesion(valor: unknown): valor is SessionInfo {
  if (typeof valor !== "object" || valor === null) {
    return false;
  }
  const s = valor as Record<string, unknown>;
  const basico =
    typeof s.token === "string" &&
    s.token.length > 0 &&
    typeof s.username === "string" &&
    typeof s.displayName === "string" &&
    typeof s.role === "string";

  if (!basico) {
    return false;
  }

  // Y además tiene que decir sobre qué puede mirar: o un curso con nombre, o la
  // lista del panel general. Una sesión sin ninguna de las dos cosas abriría un
  // panel que no sabe qué mostrar.
  const unCurso = typeof s.courseId === "number" && typeof s.courseName === "string" && s.courseName.length > 0;
  const variosCursos =
    Array.isArray(s.courses) &&
    s.courses.length > 0 &&
    s.courses.every(
      (c) =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as Curso).id === "number" &&
        typeof (c as Curso).name === "string"
    );

  return unCurso || variosCursos;
}

/**
 * Intercambia el token de lanzamiento firmado por local_samce por la sesión
 * propia del panel. Se llama una sola vez, cuando el docente llega desde el
 * link de Moodle a /auth/callback.
 */
export async function verifyMoodleLaunch(launchToken: string): Promise<SessionInfo> {
  const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_MOODLE_VERIFY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: launchToken }),
  });

  if (!response.ok) {
    throw new Error(`moodle launch verification failed with status ${response.status}`);
  }

  let data: MoodleVerifyResponse;
  try {
    data = (await response.json()) as MoodleVerifyResponse;
  } catch {
    throw new Error("moodle launch verification returned an unreadable body");
  }

  const session: SessionInfo = {
    token: data.token,
    username: data.username,
    displayName: data.display_name,
    role: data.role,
    courseId: data.course_id,
    courseName: data.course_name,
    ...(data.courses?.length ? { courses: data.courses } : {}),
  };

  // Se valida con el mismo guardián que la sesión guardada: un 200 con el
  // cuerpo incompleto no puede convertirse en una sesión a medias.
  if (!esSesion(session)) {
    throw new Error("moodle launch verification returned an incomplete session");
  }

  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

/**
 * Sesión guardada en sessionStorage (no localStorage): sobrevive a un
 * refresh de la pestaña, que es lo que importa durante un examen largo,
 * pero no queda dando vueltas para siempre en el navegador.
 */
export function getStoredSession(): SessionInfo | null {
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const valor: unknown = JSON.parse(raw);
    if (!esSesion(valor)) {
      // Lo que hay guardado no sirve: se borra para no volver a mirarlo en
      // cada navegación.
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return valor;
  } catch {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}
