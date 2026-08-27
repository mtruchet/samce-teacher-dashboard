/**
 * Las secciones de la página pública, en el orden en que aparecen.
 *
 * Vive en un solo lugar porque la cabecera y el pie enlazan lo mismo: si la
 * lista estuviera escrita dos veces, cambiar un nombre significaría acordarse
 * de los dos archivos, y tarde o temprano quedan distintos.
 *
 * Los ids tienen que coincidir con los de Landing.tsx. La cabecera además los
 * observa para marcar dónde está parado el lector.
 */

export const SECCIONES = [
  { id: "sistema", texto: "Las tres capas" },
  { id: "motor", texto: "El modelo" },
  { id: "trazabilidad", texto: "La evidencia" },
  { id: "panel", texto: "El panel" },
  { id: "alumno", texto: "El alumno" },
] as const;
