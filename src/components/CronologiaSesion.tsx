import { describirEvento, eventosCriticos, horaCorta } from "../eventos";
import type { Evento } from "../services/sesionesService";
import "./DetalleAnalisis.css";

interface Props {
  /** Los eventos del detalle, ya en el orden del registro (`received_at`, `seq`, `id`). No se vuelven a ordenar. */
  eventos: Evento[];
  /** Lleva a la fila del evento en el registro. */
  onIrAlEvento: (id: number) => void;
  /**
   * Qué se sabe del registro, para decir con cuidado que no hubo momentos:
   * - «completo»: la sesión terminó y el registro está entero.
   * - «abierta»: la sesión sigue, y lo que no pasó todavía puede pasar.
   * - «parcial»: falta una parte del registro (no se cargó todo o la captura quedó incompleta).
   */
  alcance: "completo" | "abierta" | "parcial";
}

/** Lo que se dice cuando no hay momentos, según cuánto del registro se conoce. Los tres hechos, con las mismas
 *  palabras que las métricas (D5): «no pegó texto» y «no estuvo en otra ventana ni en otra pestaña». */
const SIN_MOMENTOS: Record<Props["alcance"], string> = {
  completo: "No pegó texto, no estuvo en otra ventana ni en otra pestaña y no salió de pantalla completa.",
  abierta: "Hasta ahora no pegó texto, no estuvo en otra ventana ni en otra pestaña y no salió de pantalla completa.",
  parcial:
    "En lo que quedó registrado, no pegó texto, no estuvo en otra ventana ni en otra pestaña y no salió de pantalla completa.",
};

/**
 * Los momentos para revisar (HU05, criterio 3): un índice del registro de eventos, adentro de su lámina, con los
 * eventos críticos de la sesión de lo más viejo a lo más nuevo. Cada uno lleva su hora (la del servidor, la misma
 * del registro), el mismo ícono y el mismo nombre que su fila, y un botón que lleva a esa fila, donde sigue en su
 * forma original. Tres tipos fijos: pegados, salidas de la ventana o de la pestaña, y salidas de la pantalla
 * completa.
 *
 * Sin eventos no se dibuja: el registro ya dice que no hay ninguno, y afirmar que no pegó ni salió no tendría
 * con qué sostenerse. Eso lo decide quien lo monta.
 */
export function CronologiaSesion({ eventos, onIrAlEvento, alcance }: Props) {
  const criticos = eventosCriticos(eventos);
  return (
    <div className="apartado momentos">
      <h3 className="apartado__titulo">Momentos para revisar</h3>
      {criticos.length === 0 ? (
        <p className="apartado__nota">{SIN_MOMENTOS[alcance]}</p>
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
