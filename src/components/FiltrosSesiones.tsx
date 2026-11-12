import { useEffect, useId, useRef, useState } from "react";
import { NIVELES_FILTRO, type FiltrosSesiones as Filtros } from "../filtrosDeLaDireccion";
import { NIVELES } from "../lenguajeAlerta";
import "./FiltrosSesiones.css";

/** Cuánto se espera después de la última tecla antes de buscar: no se pide en cada letra. */
export const ESPERA_BUSQUEDA_MS = 300;

interface Props {
  filtros: Filtros;
  /** Recibe solo lo que cambió; quien lo monta lo escribe en la dirección de la página. */
  onCambio: (parciales: Partial<Filtros>) => void;
}

/**
 * La barra de filtros de la lista de sesiones (HU04): nivel de riesgo, estado, búsqueda por nombre y
 * orden. Es controlada: los valores vienen de la dirección de la página y cada cambio vuelve a ella,
 * así sobreviven a la actualización automática y al botón Atrás. Solo guarda el texto de la búsqueda
 * mientras espera que el docente deje de escribir.
 *
 * El orden predeterminado es por hora de inicio. Ordenar por nivel es una opción del docente, que
 * agrupa por nivel dentro de cada grupo y, a igual nivel, conserva la hora de inicio: nunca un
 * ranking por índice.
 *
 * Los niveles se nombran como en las tarjetas del resumen y en la lista («Riesgo alto»): el selector y la
 * tarjeta son dos caminos al mismo filtro y se reflejan entre sí. Nivel y estado del análisis se excluyen:
 * elegir un nivel borra el filtro de análisis (lo resuelve `escribirFiltros`).
 *
 * Va dentro de la lámina de control, sin lámina propia. «N de M sesiones» y «Quitar filtros» no son de la
 * barra: van en el renglón de resultado (`ResultadoDelFiltro`), debajo.
 */
export function FiltrosSesiones({ filtros, onCambio }: Props) {
  const id = useId();
  const [texto, setTexto] = useState(filtros.q ?? "");
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  // La espera llama siempre a la última función recibida, no a la de la vuelta en que se tecleó: si en esos
  // 300 ms el docente eligió un nivel, la función vieja lo borraba al escribir la búsqueda.
  const alCambiar = useRef(onCambio);
  useEffect(() => {
    alCambiar.current = onCambio;
  }, [onCambio]);

  // Si la búsqueda cambia desde afuera (Atrás, «Quitar filtros», una tarjeta), el campo la sigue. Solo se
  // pisa si dice otra cosa: la dirección guarda la búsqueda sin espacios en los bordes, y pisar «Juan » con
  // «Juan» le borraba al docente el espacio que acababa de escribir.
  const q = filtros.q ?? "";
  const [ultimaQ, setUltimaQ] = useState(q);
  if (q !== ultimaQ) {
    setUltimaQ(q);
    if (texto.trim() !== q) setTexto(q);
  }

  // Lo que se estaba esperando escribir ya no vale cuando la búsqueda cambió desde afuera.
  useEffect(() => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = null;
  }, [q]);

  useEffect(() => () => {
    if (espera.current) clearTimeout(espera.current);
  }, []);

  function escribir(valor: string) {
    setTexto(valor);
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      espera.current = null;
      alCambiar.current({ q: valor.trim() || undefined });
    }, ESPERA_BUSQUEDA_MS);
  }

  return (
    <div className="filtros" role="group" aria-label="Filtrar y ordenar las sesiones">
      <div className="filtros__campo">
        <label htmlFor={`${id}-nivel`}>Nivel de riesgo</label>
        <select
          id={`${id}-nivel`}
          value={filtros.nivel ?? ""}
          onChange={(e) => onCambio({ nivel: (e.target.value || undefined) as Filtros["nivel"] })}
        >
          <option value="">Todos</option>
          {NIVELES_FILTRO.map((nivel) => (
            <option key={nivel} value={nivel}>
              {NIVELES[nivel]}
            </option>
          ))}
        </select>
      </div>
      <div className="filtros__campo">
        <label htmlFor={`${id}-estado`}>Estado</label>
        <select
          id={`${id}-estado`}
          value={filtros.estado ?? ""}
          onChange={(e) => onCambio({ estado: (e.target.value || undefined) as Filtros["estado"] })}
        >
          <option value="">Todas</option>
          <option value="open">En curso</option>
          <option value="finished">Finalizadas</option>
        </select>
      </div>
      <div className="filtros__campo filtros__campo--busqueda">
        <label htmlFor={`${id}-q`}>Buscar alumno</label>
        <input
          id={`${id}-q`}
          type="search"
          placeholder="Nombre o apellido"
          maxLength={100}
          value={texto}
          onChange={(e) => escribir(e.target.value)}
        />
      </div>
      <div className="filtros__campo">
        <label htmlFor={`${id}-orden`}>Ordenar por</label>
        {/* «Hora de inicio» es el orden predeterminado: en la dirección no se escribe, y en el control lleva
            un valor propio que se traduce a «sin orden». */}
        <select
          id={`${id}-orden`}
          value={filtros.orden ?? "started_at"}
          onChange={(e) =>
            onCambio({ orden: e.target.value === "risk_level" ? "risk_level" : undefined })
          }
        >
          <option value="started_at">Hora de inicio</option>
          <option value="risk_level">Nivel de riesgo</option>
        </select>
      </div>
    </div>
  );
}
