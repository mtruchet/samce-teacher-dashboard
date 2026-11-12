import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  claveDeFiltros,
  conservarFiltros as conservarLosFiltros,
  escribirFiltros,
  hayFiltro as hayAlgunFiltro,
  leerFiltros,
  type FiltrosSesiones,
} from "../filtrosDeLaDireccion";

const SIN_FILTROS: Partial<FiltrosSesiones> = { nivel: undefined, estado: undefined, analisis: undefined, q: undefined };

/**
 * Los filtros de la lista de sesiones, leídos de la dirección de la página y escritos en ella.
 *
 * `filtros` es el mismo objeto mientras no cambie `claveFiltros`, que es texto: la actualización automática y
 * cualquier otro cambio de la dirección (abrir una sesión) no lo rehacen, y lo que depende de él no se vuelve
 * a calcular sin motivo.
 *
 * Las funciones leen la dirección vigente de una referencia y no de la vuelta en que se crearon: la búsqueda
 * espera 300 ms antes de escribir, y si en ese lapso el docente eligió un nivel, partir de la dirección vieja
 * lo borraba.
 */
export function useFiltrosDeLaDireccion() {
  const [parametros, setParametros] = useSearchParams();
  const vigentes = useRef(parametros);
  useEffect(() => {
    vigentes.current = parametros;
  }, [parametros]);

  const claveFiltros = claveDeFiltros(parametros);
  const filtros = useMemo(() => leerFiltros(new URLSearchParams(claveFiltros)), [claveFiltros]);

  const navegar = useCallback(
    (parciales: Partial<FiltrosSesiones>, reemplazar: boolean) => {
      const actuales = vigentes.current;
      const siguiente = escribirFiltros(actuales, parciales);
      // Sin cambios no se navega: cada pausa al escribir dejaba una entrada igual en el historial, y Atrás
      // parecía no hacer nada.
      if (siguiente.toString() === actuales.toString()) return;
      vigentes.current = siguiente;
      setParametros(siguiente, { replace: reemplazar });
    },
    [setParametros]
  );

  /**
   * Escribe en la dirección lo que cambió, con la misma función para la barra y para las tarjetas del
   * resumen. Queda en el historial, así Atrás vuelve a la vista anterior. La búsqueda que se va escribiendo
   * es la excepción: la primera pausa deja una entrada y las siguientes la reemplazan, así una búsqueda
   * tipeada es una sola entrada.
   */
  const aplicarFiltros = useCallback(
    (parciales: Partial<FiltrosSesiones>) => {
      const soloBusqueda = Object.keys(parciales).length === 1 && "q" in parciales;
      navegar(parciales, soloBusqueda && vigentes.current.has("q"));
    },
    [navegar]
  );

  /** Borra nivel, estado, análisis y búsqueda, y conserva el orden elegido. */
  const quitarFiltros = useCallback(() => navegar(SIN_FILTROS, false), [navegar]);

  /** Le pasa a una dirección nueva los filtros vigentes, solo si es el mismo examen. */
  const conservarFiltros = useCallback(
    (destino: URLSearchParams) =>
      conservarLosFiltros(destino, vigentes.current, vigentes.current.get("examen")),
    []
  );

  return {
    filtros,
    claveFiltros,
    hayFiltro: hayAlgunFiltro(filtros),
    aplicarFiltros,
    quitarFiltros,
    conservarFiltros,
  };
}
