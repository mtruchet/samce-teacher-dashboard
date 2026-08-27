/**
 * Las direcciones de los dos sistemas con los que habla el panel.
 *
 * Las dos tienen un valor de respaldo, y no por comodidad: sin él, una variable
 * que falte deja `undefined` metido en el medio de una dirección. El enlace de
 * vuelta al campus se quedaba sin destino —y un enlace sin destino ni siquiera
 * es un enlace, con lo que tampoco existe para quien navega con teclado— y la
 * redirección terminaba en «undefined».
 *
 * El respaldo del backend es el de desarrollo, porque su dirección cambia con
 * cada despliegue y allá se define de verdad. El del campus es el de la
 * facultad, que es siempre el mismo y es adonde hay que volver.
 */
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || "http://localhost:8080",
  /** El aula virtual, adonde se devuelve a quien llega sin sesión. */
  MOODLE_URL: import.meta.env.VITE_MOODLE_URL || "https://frsfco.cvg.utn.edu.ar",
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
