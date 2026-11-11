import { eventosCriticos, horaCorta } from "../eventos";
import type { Evento } from "../services/sesionesService";
import "./DetalleAnalisis.css";

interface Props {
  /** Los eventos del detalle, ya en el orden del registro. No se vuelven a ordenar. */
  eventos: Evento[];
  /** Lleva a la fila del evento en el registro. */
  onIrAlEvento: (id: number) => void;
}

/**
 * Los momentos para revisar (HU05, criterio 3): la cronología de los eventos críticos de la sesión, con su
 * hora (la del servidor, la misma del registro) y un botón que lleva a su fila en el registro, donde sigue
 * en su forma original. Tres tipos fijos: pegados, salidas de la ventana o de la pestaña, y salidas de la
 * pantalla completa.
 */
export function CronologiaSesion({ eventos, onIrAlEvento }: Props) {
  const criticos = eventosCriticos(eventos);
  return (
    <section className="detalle-analisis detalle-analisis--cronologia" aria-labelledby="cronologia-titulo">
      <h2 className="detalle-analisis__titulo" id="cronologia-titulo">Momentos para revisar</h2>
      {criticos.length === 0 ? (
        <p className="detalle-analisis__nota">No hubo pegados de texto ni salidas de la ventana o de la pantalla completa.</p>
      ) : (
        <ol className="detalle-analisis__lista">
          {criticos.map(({ evento, titulo }) => (
            <li key={evento.id} className="detalle-analisis__momento">
              <time className="cifra" dateTime={evento.received_at}>{horaCorta(evento.received_at)}</time>
              <span>{titulo}</span>
              <button type="button" className="detalle-analisis__ir" onClick={() => onIrAlEvento(evento.id)}>
                Ver en el registro
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
