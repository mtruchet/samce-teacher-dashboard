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

  // La última respuesta completa de cada vista del examen (filtro y orden), para volver a una vista ya vista
  // sin pasar por la lista de otra: al quitar un filtro, al volver del detalle o con Atrás, la lista se dibuja
  // en el primer cuadro con lo último que se supo de esa vista y la respuesta nueva la reemplaza al llegar.
  // Solo del examen que se está mirando, y con un tope de ocho vistas: más que eso es memoria que no se usa.
  const porVista = useRef(new Map<string, SesionesCargadas>());

  const consultar = useCallback(async () => {
    const mio = ++pedido.current;
    try {
      // Los dos pedidos salen a la vez. Uno detrás del otro, cada vista nueva esperaba dos viajes al servidor,
      // y la lista llegaba después que todo lo demás. Las sesiones se piden del examen de la dirección antes
      // de saber si es del docente; si no lo es, la respuesta (o el rechazo del backend) se descarta abajo.
      const idPedido = examenElegido && /^\d+$/.test(examenElegido) ? Number(examenElegido) : null;
      const delPedido = leerFiltros(new URLSearchParams(clavePedido));
      const [lista, respuesta] = await Promise.all([
        traerExamenes(),
        idPedido !== null
          ? traerSesiones(idPedido, paginas * SESIONES_POR_PAGINA, delPedido).catch((error: unknown) => {
              // El token vencido vale para los dos pedidos y se atiende abajo. Cualquier otro fallo se guarda
              // hasta saber si el examen es del docente: de un examen ajeno, el rechazo es lo esperable.
              if (error instanceof SesionVencida) throw error;
              return error instanceof Error ? error : new Error(String(error));
            })
          : Promise.resolve(null),
      ]);
      if (mio !== pedido.current) return;

      // Las sesiones valen solo si el examen es uno de los cursos del docente (la lista ya viene filtrada por
      // el backend según su token).
      const elegido = examenElegido ? lista.find((e) => String(e.id) === examenElegido) : undefined;
      // De un examen propio, el fallo es real: el canal queda sin conexión y se conserva lo último que llegó.
      if (elegido && respuesta instanceof Error) throw respuesta;
      const ok = elegido && respuesta && !(respuesta instanceof Error) ? respuesta : null;

      const nuevas: SesionesCargadas | null =
        elegido && ok
          ? {
              examenId: elegido.id,
              vista: `${examenElegido}|${clavePedido}`,
              lista: ok.sesiones.map((s) => ({ ...s, examenId: elegido.id })),
              total: ok.total,
              resumen: ok.resumen,
            }
          : null;

      if (nuevas) {
        const memoria = porVista.current;
        // Otro examen: lo guardado de las vistas del anterior ya no sirve.
        if ([...memoria.values()].some((v) => v.examenId !== nuevas.examenId)) memoria.clear();
        memoria.delete(nuevas.vista);
        memoria.set(nuevas.vista, nuevas);
        if (memoria.size > 8) memoria.delete(memoria.keys().next().value!);
      }

      setExamenes(lista);
      setRecibido(true);
      setCargadas(nuevas);
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

  // Lo que se muestra es siempre una respuesta completa (filas, total y resumen del mismo pedido): la de la
  // vista pedida si es la última que llegó o está en memoria, y si no, la última. `alDia` dice si es de la
  // vista pedida y llegó con la última consulta; mientras no lo es, la lista se marca como ocupada.
  const pedida = `${examenElegido}|${clavePedido}`;
  const mostrada = cargadas?.vista === pedida ? cargadas : (porVista.current.get(pedida) ?? cargadas);
  const alDia = cargadas?.vista === pedida;

  return { examenes, cargadas: mostrada, alDia, enlace, marca, recibido, vencida, vencer };
}
