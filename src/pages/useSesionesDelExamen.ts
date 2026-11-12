import { useCallback, useEffect, useRef, useState } from "react";
import { leerFiltros } from "../filtrosDeLaDireccion";
import { clearSession } from "../services/authService";
import {
  CADENCIA_MS,
  SESIONES_POR_PAGINA,
  SesionVencida,
  traerExamenes,
  traerSesiones,
  type ExamenMonitoreado,
  type ResumenDeEvaluacion,
  type SesionDeExamen,
} from "../services/sesionesService";
import type { EstadoEnlace } from "../components/PulsoEnlace";

/** Las sesiones del examen que se está mirando, con de qué examen y de qué consulta son. */
export interface SesionesCargadas {
  examenId: number;
  /** De qué examen y consulta es la respuesta: `${examen}|${clavePedido}`. */
  vista: string;
  lista: SesionDeExamen[];
  /** Cuántas cumplen el filtro en toda la evaluación (X-Total-Count); null con un backend viejo. */
  total: number | null;
  resumen: ResumenDeEvaluacion | null;
}

/**
 * El ciclo de consultas del panel: los exámenes del docente y, si hay uno elegido, sus sesiones, cada
 * `CADENCIA_MS`. Sigue el modelo de `useAnalisisDeSesion` en el detalle: el componente decide qué mostrar y
 * este hook solo pregunta y guarda lo que llegó.
 *
 * - `examenElegido`: el examen de la dirección; solo de ese se piden las sesiones.
 * - `clavePedido`: lo que de verdad se le pide al backend, como texto (`claveDelPedido`).
 * - `paginas`: cuántas páginas de 50 sesiones se pidieron.
 */
export function useSesionesDelExamen(examenElegido: string | null, clavePedido: string, paginas: number) {
  const [examenes, setExamenes] = useState<ExamenMonitoreado[]>([]);
  // Solo las sesiones del examen que se está mirando, con el examen del que
  // son: las de los demás no se piden.
  const [cargadas, setCargadas] = useState<SesionesCargadas | null>(null);
  const [enlace, setEnlace] = useState<EstadoEnlace>("vivo");
  const [marca, setMarca] = useState(0);
  const [vencida, setVencida] = useState(false);
  // Si alguna consulta llegó bien. Sin esto, una primera consulta fallida
  // dejaba la lista de exámenes vacía y la pantalla afirmaba «todavía no hay
  // ningún examen en curso», cuando lo único que se sabía es que el servidor
  // no había contestado.
  const [recibido, setRecibido] = useState(false);

  // El token dejó de valer: no se arregla reintentando.
  const vencer = useCallback(() => {
    clearSession();
    setVencida(true);
  }, []);

  /**
   * Cuál es la consulta que vale. Sube con cada pedido, y el que vuelve con un
   * número viejo se descarta sin tocar la pantalla.
   *
   * Hacen falta dos llamadas al servidor y el docente puede cambiar de examen
   * entre una y la otra, o mientras el refresco de los cinco segundos está en
   * vuelo. Sin esto, la respuesta que llega tarde pisa la lista con las
   * sesiones del examen anterior, y como también pisa `cargadas`, la pantalla
   * queda convencida de que esas son las del examen que se está mirando.
   */
  const pedido = useRef(0);

  const consultar = useCallback(async () => {
    const mio = ++pedido.current;
    try {
      const lista = await traerExamenes();
      if (mio !== pedido.current) return;

      // Las sesiones se piden solo del examen que la dirección tiene elegido, y
      // solo si es de uno de los cursos del docente (la lista ya viene filtrada
      // por el backend según su token).
      const elegido = examenElegido ? lista.find((e) => String(e.id) === examenElegido) : undefined;
      const delPedido = leerFiltros(new URLSearchParams(clavePedido));
      const respuesta = elegido ? await traerSesiones(elegido.id, paginas * SESIONES_POR_PAGINA, delPedido) : null;
      const delElegido = respuesta && elegido ? respuesta.sesiones.map((s) => ({ ...s, examenId: elegido.id })) : [];

      if (mio !== pedido.current) return;

      setExamenes(lista);
      setRecibido(true);
      setCargadas(
        elegido && respuesta
          ? {
              examenId: elegido.id,
              vista: `${examenElegido}|${clavePedido}`,
              lista: delElegido,
              total: respuesta.total,
              resumen: respuesta.resumen,
            }
          : null
      );
      setEnlace("vivo");
      setMarca((m) => m + 1);
    } catch (error) {
      // Que el token haya vencido no es un problema de red, y tratarlo como
      // tal es lo peor que puede hacer el panel: se queda mostrando «sin
      // conexión, reintentando» encima de una lista que ya no se actualiza,
      // mientras puede haber alumnos rindiendo de los que no se entera.
      if (mio !== pedido.current) return;

      if (error instanceof SesionVencida) {
        vencer();
        return;
      }

      // Cualquier otro fallo sí se reintenta, y se conserva lo último que
      // llegó. Seguir mostrándolo como si fuera de ahora sería mentir, así que
      // el estado del canal lo dice.
      setEnlace("sin-conexion");
    }
  }, [examenElegido, clavePedido, paginas, vencer]);

  useEffect(() => {
    if (vencida) return;

    // La próxima consulta se programa recién cuando termina la anterior. Con un
    // intervalo fijo, un servidor que tardaba más de cinco segundos recibía un
    // pedido nuevo antes de contestar el anterior, cada respuesta llegaba ya
    // descartada por vieja, y el panel seguía diciendo «En vivo» sin mostrar
    // nada nuevo.
    let activo = true;
    let proxima: number | undefined;
    const ciclo = async () => {
      await consultar();
      if (activo) proxima = window.setTimeout(ciclo, CADENCIA_MS);
    };
    void ciclo();
    return () => {
      activo = false;
      window.clearTimeout(proxima);
    };
  }, [consultar, vencida]);

  return { examenes, cargadas, enlace, marca, recibido, vencida, vencer };
}
