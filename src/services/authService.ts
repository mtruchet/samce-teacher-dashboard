import { API_CONFIG } from "../config/api.config";

export interface SessionInfo {
  token: string;
  username: string;
  role: string;
  courseId: number;
}

const SESSION_STORAGE_KEY = "samce_session";

interface MoodleVerifyResponse {
  token: string;
  username: string;
  role: string;
  course_id: number;
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

  const data: MoodleVerifyResponse = await response.json();
  const session: SessionInfo = {
    token: data.token,
    username: data.username,
    role: data.role,
    courseId: data.course_id,
  };

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
    return JSON.parse(raw) as SessionInfo;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}
