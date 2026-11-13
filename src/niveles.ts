/**
 * Los niveles de riesgo, de menor a mayor. Es el único lugar donde está el orden: el peso de cada nivel, sus
 * palabras y el tipo salen de acá (ver `lenguajeAlerta.ts`). Va en un módulo sin dependencias para que el
 * servicio y los filtros de la dirección lo usen sin depender uno del otro.
 */
export const NIVELES_DE_RIESGO = ["low", "medium", "high"] as const;
export type NivelDeRiesgo = (typeof NIVELES_DE_RIESGO)[number];

/**
 * Los estados de sesión y del análisis por los que se puede filtrar la lista (HU04), con los nombres del
 * backend (`status=open|finished`, `analysis=…`). Están acá, sin dependencias, para que el servicio (el pedido)
 * y los filtros de la dirección tomen los dos tipos del mismo lugar.
 */
export const ESTADOS_FILTRO = ["open", "finished"] as const;
export type EstadoDelFiltro = (typeof ESTADOS_FILTRO)[number];
/** Los estados del análisis de las sesiones sin alertas. Solo los escriben las tarjetas del resumen. */
export const ANALISIS_FILTRO = ["no_alerts", "not_analyzed", "insufficient_evidence", "unavailable"] as const;
export type AnalisisDelFiltro = (typeof ANALISIS_FILTRO)[number];
