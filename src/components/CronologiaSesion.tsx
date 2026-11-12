import { describirEvento, eventosCriticos, horaCorta } from "../eventos";
import type { Evento } from "../services/sesionesService";
import "./DetalleAnalisis.css";

interface Props {
  /** Los eventos del detalle, ya en el orden del registro (`received_at`, `seq`, `id`). No se vuelven a ordenar. */
  eventos: Evento[];
  /** Lleva a la fila del evento en el registro. */
  onIrAlEvento: (id: number) => void;
}

/**
 * Los momentos para revisar (HU05, criterio 3): un índice del registro de eventos, adentro de su lámina, con los
 * eventos críticos de la sesión de lo más viejo a lo más nuevo. Cada uno lleva su hora (la del servidor, la misma
 * del registro), el mismo ícono y el mismo nombre que su fila, y un botón que lleva a esa fila, donde sigue en su
 * forma original. Tres tipos fijos: pegados, salidas de la ventana o de la pestaña, y salidas de la pantalla
 * completa.
 */
export function CronologiaSesion({ eventos, onIrAlEvento }: Props) {
  const criticos = eventosCriticos(eventos);
  return (
    <div className="apartado momentos">
      <h3 className="apartado__titulo">Momentos para revisar</h3>
      {criticos.length === 0 ? (
        <p className="apartado__nota">No pegó texto, no cambió de ventana ni de pestaña y no salió de pantalla completa.</p>
      ) : (
        <ol className="momentos__lista">
          {criticos.map(({ evento, titulo }) => {
            const { icono: Icono } = describirEvento(evento);
            const hora = horaCorta(evento.received_at);
            return (
              <li key={evento.id} className="momentos__momento">
                <time className="momentos__hora cifra" dateTime={evento.received_at}>{hora}</time>
                <span className="momentos__que">
                  <Icono size={16} aria-hidden="true" />
                  <span className="momentos__titulo">{titulo}</span>
                </span>
                <button
                  type="button"
                  className="boton-texto momentos__ir"
                  aria-label={`Ver en el registro: ${titulo}, a las ${hora}`}
                  onClick={() => onIrAlEvento(evento.id)}
                >
                  Ver en el registro
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
