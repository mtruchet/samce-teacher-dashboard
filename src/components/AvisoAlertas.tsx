import { useEffect, useRef, useState } from "react";
import { nombreDeAlumno, type Sesion } from "../services/sesionesService";

type Nivel = NonNullable<Sesion["risk_level"]>;

const PESO: Record<Nivel, number> = { low: 1, medium: 2, high: 3 };
const PALABRA: Record<Nivel, string> = { low: "bajo", medium: "medio", high: "alto" };

/**
 * El anuncio accesible de una alerta nueva en la lista de sesiones (HU03).
 *
 * No se ve: es una región viva que contiene solo la frase del anuncio, así el lector de pantalla
 * dice la frase y no vuelve a leer toda la lista. `role="status"` lleva `aria-atomic` verdadero de
 * forma implícita, que es lo que hacía releer toda la región de alertas del detalle: acá se declara
 * en falso, y como la región no tiene nada más que la frase, no hay nada más que releer.
 *
 * Solo anuncia una sesión que ya estaba en la respuesta anterior y cuyo nivel aparece o sube. Una
 * sesión que no estaba (porque entró por «Ver más sesiones», o por un filtro) solo se memoriza. La
 * memoria se vacía cuando cambia `clave` (el examen elegido), y la primera respuesta después de eso
 * solo memoriza. El nivel nunca baja, así que no hay anuncio de bajada.
 */
export function AvisoAlertas({ sesiones, clave }: { sesiones: Sesion[]; clave: string }) {
  const memoria = useRef<{ clave: string; niveles: Map<number, Sesion["risk_level"]> } | null>(null);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const anterior = memoria.current;
    const niveles = new Map(sesiones.map((s) => [s.id, s.risk_level]));
    memoria.current = { clave, niveles };
    if (!anterior || anterior.clave !== clave) return;

    const nuevas: Array<{ sesion: Sesion; nivel: Nivel }> = [];
    for (const s of sesiones) {
      if (!anterior.niveles.has(s.id) || !s.risk_level) continue;
      const antes = anterior.niveles.get(s.id);
      if (!antes || PESO[s.risk_level] > PESO[antes]) nuevas.push({ sesion: s, nivel: s.risk_level });
    }
    if (nuevas.length === 1) {
      const { sesion, nivel } = nuevas[0];
      setMensaje(`Nueva alerta en la sesión de ${nombreDeAlumno(sesion)}: riesgo ${PALABRA[nivel]}.`);
    } else if (nuevas.length > 1) {
      setMensaje(`Nuevas alertas en ${nuevas.length} sesiones.`);
    }
  }, [sesiones, clave]);

  return (
    <p role="status" aria-live="polite" aria-atomic="false" className="solo-lectores">
      {mensaje}
    </p>
  );
}
