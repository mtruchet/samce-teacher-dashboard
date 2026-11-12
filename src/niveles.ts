/**
 * Los niveles de riesgo, de menor a mayor. Es el único lugar donde está el orden: el peso de cada nivel, sus
 * palabras y el tipo salen de acá (ver `lenguajeAlerta.ts`). Va en un módulo sin dependencias para que el
 * servicio y los filtros de la dirección lo usen sin depender uno del otro.
 */
export const NIVELES_DE_RIESGO = ["low", "medium", "high"] as const;
export type NivelDeRiesgo = (typeof NIVELES_DE_RIESGO)[number];
