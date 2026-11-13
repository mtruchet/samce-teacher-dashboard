import { useEffect, useRef } from "react";
import { PALABRA_DEL_NIVEL, subio } from "../lenguajeAlerta";
import type { NivelDeRiesgo } from "../niveles";
import { nombreDeAlumno, type Sesion } from "../services/sesionesService";
import { AnuncioVivo } from "./AnuncioVivo";
import { useAnuncio } from "./useAnuncio";

/**
 * El anuncio accesible de una alerta nueva en la lista de sesiones (HU03).
 *
 * No se ve: es una región viva (`AnuncioVivo`, que explica por qué no relee la lista) con solo la frase
 * del anuncio.
 *
 * Solo anuncia una sesión que ya estaba en la respuesta anterior y cuyo nivel aparece o sube. Una
 * sesión que no estaba (porque entró por «Ver más sesiones», o por un filtro) solo se memoriza. La
 * memoria se vacía cuando cambia `clave` (la vista de la respuesta que se muestra: el examen y los
 * filtros), y la primera respuesta después de eso solo memoriza. El nivel nunca baja, así que no hay anuncio de bajada.
 */
export function AvisoAlertas({ sesiones, clave }: { sesiones: Sesion[]; clave: string }) {
  const memoria = useRef<{ clave: string; niveles: Map<number, Sesion["risk_level"]> } | null>(null);
  // Cada anuncio va en un nodo nuevo, así un anuncio igual al anterior también se lee.
  const [aviso, anunciar] = useAnuncio();

  useEffect(() => {
    const anterior = memoria.current;
    const niveles = new Map(sesiones.map((s) => [s.id, s.risk_level]));
    memoria.current = { clave, niveles };
    if (!anterior || anterior.clave !== clave) return;

    const nuevas: Array<{ sesion: Sesion; nivel: NivelDeRiesgo }> = [];
    for (const s of sesiones) {
      if (!anterior.niveles.has(s.id) || !s.risk_level) continue;
      const antes = anterior.niveles.get(s.id);
      if (!antes || subio(antes, s.risk_level)) nuevas.push({ sesion: s, nivel: s.risk_level });
    }
    if (nuevas.length === 1) {
      const { sesion, nivel } = nuevas[0];
      anunciar(`Nueva alerta en la sesión de ${nombreDeAlumno(sesion)}: riesgo ${PALABRA_DEL_NIVEL[nivel]}.`);
    } else if (nuevas.length > 1) {
      anunciar(`Nuevas alertas en ${nuevas.length} sesiones.`);
    }
  }, [sesiones, clave, anunciar]);

  return <AnuncioVivo aviso={aviso} />;
}
