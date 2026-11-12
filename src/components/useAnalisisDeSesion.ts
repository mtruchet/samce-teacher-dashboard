import { useEffect, useRef, useState } from "react";
import { ORIGENES, PALABRA_DEL_NIVEL, subio } from "../lenguajeAlerta";
import { recienCerrada } from "../seguimiento";
import {
  CADENCIA_MS,
  SesionVencida,
  traerAnalisis,
  type AlertaDeSesion,
  type Analisis,
  type SesionNumerada,
} from "../services/sesionesService";
import { useAnuncio, type Anuncio } from "./useAnuncio";

/**
 * Lo nuevo de una consulta, para el lector de pantalla: la alerta que apareció o subió de nivel. Solo eso, y
 * no todo el apartado: la región viva contiene solo esta frase. Con las mismas palabras que el anuncio de la
 * lista de sesiones («Nueva alerta … riesgo medio.»).
 */
function novedades(antes: AlertaDeSesion[], ahora: AlertaDeSesion[]): string {
  const frases: string[] = [];
  for (const a of ahora) {
    const previa = antes.find((b) => b.origin === a.origin);
    const donde = ORIGENES[a.origin].toLowerCase();
    if (!previa) frases.push(`Nueva alerta ${donde}: riesgo ${PALABRA_DEL_NIVEL[a.level]}.`);
    else if (subio(previa.level, a.level)) {
      frases.push(`La alerta ${donde} subió a riesgo ${PALABRA_DEL_NIVEL[a.level]}.`);
    }
  }
  return frases.join(" ");
}

interface EstadoDelAnalisisDeSesion {
  /** La última respuesta que llegó, o null mientras no llegó ninguna. */
  analisis: Analisis | null;
  /** La última consulta falló: lo que se ve es lo último que llegó. */
  sinConexion: boolean;
  /** Lo que la región viva tiene que decir: la alerta que apareció o subió. */
  anuncio: Anuncio;
}

/**
 * El ciclo de consultas del análisis de una sesión. Mientras la sesión sigue abierta, y unos minutos después de
 * la entrega, vuelve a preguntar cada pocos segundos: el análisis se recalcula con cada tanda de eventos, y una
 * alerta puede aparecer o subir de nivel mientras el docente mira. Cada novedad se anuncia una vez, en un nodo
 * nuevo, así dos novedades seguidas con la misma frase se leen las dos.
 */
export function useAnalisisDeSesion(sesion: SesionNumerada, onVencida: () => void): EstadoDelAnalisisDeSesion {
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [sinConexion, setSinConexion] = useState(false);
  const [anuncio, anunciar] = useAnuncio();
  // Las alertas de la consulta anterior, para saber qué cambió.
  const anteriores = useRef<AlertaDeSesion[] | null>(null);
  // El aviso de vencida va en una referencia: el panel se redibuja con cada respuesta de su propia consulta y le
  // pasa una función nueva cada vez, y si el efecto dependiera de ella se reiniciaría en cada redibujo.
  const alVencer = useRef(onVencida);
  useEffect(() => {
    alVencer.current = onVencida;
  });

  const examenId = sesion.examenId;
  const sesionId = sesion.id;
  const abierta = sesion.status === "open";
  const cierre = sesion.closed_at;

  useEffect(() => {
    let vigente = true;
    let proxima: number | undefined;

    const ciclo = async () => {
      try {
        const respuesta = await traerAnalisis(examenId, sesionId);
        if (!vigente) return;
        setAnalisis(respuesta);
        setSinConexion(false);
      } catch (error) {
        if (!vigente) return;
        if (error instanceof SesionVencida) {
          alVencer.current();
          return;
        }
        // Se conserva lo último que llegó y se avisa: seguir mostrándolo como si fuera de ahora sería mentir.
        setSinConexion(true);
      }
      if (abierta || recienCerrada(cierre)) proxima = window.setTimeout(ciclo, CADENCIA_MS);
    };
    void ciclo();
    return () => {
      vigente = false;
      window.clearTimeout(proxima);
    };
  }, [examenId, sesionId, abierta, cierre]);

  useEffect(() => {
    if (!analisis) return;
    // La primera respuesta solo se memoriza: lo que ya estaba al abrir no es nuevo.
    if (anteriores.current !== null) {
      const frase = novedades(anteriores.current, analisis.alerts);
      if (frase) anunciar(frase);
    }
    anteriores.current = analisis.alerts;
  }, [analisis, anunciar]);

  return { analisis, sinConexion, anuncio };
}
