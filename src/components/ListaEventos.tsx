import type { Evento } from "../services/sesionesService";
import { describirEvento } from "../eventos";
import "./ListaEventos.css";

/**
 * Los eventos de una sesión, tal como llegaron.
 *
 * Es una tabla, por lo mismo que la de sesiones: el docente no lee cada evento
 * de corrido, busca un momento, y eso es escaneo vertical. Va en el orden en
 * que se generaron y nunca por relevancia: ordenar por «lo que más llama la
 * atención» sería un ranking, que es justamente el juicio que este panel no
 * hace todavía. Sin índice, sin riesgo, sin alertas.
 *
 * La hora es la del servidor. La del reloj del alumno puede estar mal, y una
 * hora equivocada en una cronología es peor que ninguna; se deja a la vista,
 * en el tooltip, para quien quiera compararla.
 */

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

interface Props {
  eventos: Evento[];
  vacio?: React.ReactNode;
}

export function ListaEventos({ eventos, vacio }: Props) {
  if (eventos.length === 0) return <>{vacio}</>;

  return (
    <div className="eventos__marco">
      <table className="eventos">
        <caption className="solo-lectores">
          Eventos de la sesión, en el orden en que ocurrieron. Cada fila dice a qué hora llegó,
          qué pasó y el detalle.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="eventos__hora">Hora</th>
            <th scope="col" className="eventos__que">Qué pasó</th>
            <th scope="col">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {eventos.map((e) => {
            const { titulo, detalle } = describirEvento(e);
            return (
              <tr key={e.seq}>
                <td className="eventos__hora">
                  <time
                    className="cifra"
                    dateTime={e.received_at}
                    title={`Según el reloj del alumno: ${hora(e.occurred_at)}`}
                  >
                    {hora(e.received_at)}
                  </time>
                </td>
                <td className="eventos__que">{titulo}</td>
                <td className="eventos__detalle">{detalle}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
