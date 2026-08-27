export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL,
  /** El aula virtual, adonde se devuelve a quien llega sin sesión. */
  MOODLE_URL: import.meta.env.VITE_MOODLE_URL,
  /**
   * El lanzamiento que abarca todos los cursos del docente.
   *
   * Es una dirección de Moodle y no del backend a propósito: el docente ya
   * tiene su sesión del campus abierta, así que el salto es instantáneo y
   * vuelve con un token nuevo que autoriza todos sus cursos. Pedirlo por la
   * API obligaría a que SAMCE guarde qué cursos da cada docente, que es
   * justamente lo que no queremos duplicar.
   */
  MOODLE_LAUNCH_GENERAL: "/local/samce/launch_global.php",
  ENDPOINTS: {
    PING: "/ping",
    AUTH_MOODLE_VERIFY: "/auth/moodle/verify",
    MONITORED_QUIZZES: "/monitored-quizzes",
  },
} as const;
