import { useEffect, useId, useRef, useState } from "react";
import type { FiltrosSesiones as Filtros } from "../services/sesionesService";
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
 */
export function FiltrosSesiones({ filtros, onCambio }: Props) {
  const id = useId();
  const [texto, setTexto] = useState(filtros.q ?? "");
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Si la búsqueda cambia desde afuera (Atrás, «Quitar filtros», una tarjeta), el campo la sigue.
  const [ultimaQ, setUltimaQ] = useState(filtros.q ?? "");
  if ((filtros.q ?? "") !== ultimaQ) {
    setUltimaQ(filtros.q ?? "");
    setTexto(filtros.q ?? "");
  }

  useEffect(() => () => {
    if (espera.current) clearTimeout(espera.current);
  }, []);

  function escribir(valor: string) {
    setTexto(valor);
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => onCambio({ q: valor.trim() || undefined }), ESPERA_BUSQUEDA_MS);
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
          <option value="high">Alto</option>
          <option value="medium">Medio</option>
          <option value="low">Bajo</option>
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
