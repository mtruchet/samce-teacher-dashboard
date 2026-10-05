import { memo, useMemo } from "react";
import type { Evento } from "../services/sesionesService";
import { describirEvento, horaCorta, horaExacta } from "../eventos";
import { conHuecos } from "../huecos";
import { Silencio } from "../iconos";
import "./ListaEventos.css";

/**
 * Los eventos de una sesión, tal como llegaron.
 *
 * Es una tabla, por lo mismo que la de sesiones: el docente no lee cada evento
 * de corrido, busca un momento, y eso es escaneo vertical.
 *
 * Una fila por evento, sin juntar ninguno, con los silencios anunciados entre
 * medio (ver `conHuecos`).
 *
 * Va del más reciente al más viejo. Sigue siendo el orden del reloj, que es el
 * que la historia exige, y nunca el de «lo que más llama la atención»: ordenar
 * por eso sería un ranking, que es el juicio que este panel no hace todavía.
 * Al revés y no al derecho porque, con la sesión abierta, lo que acaba de pasar
 * es lo que el docente está esperando. Sin índice, sin riesgo, sin alertas.
 *
 * La hora es la del servidor. La del reloj del alumno puede estar mal, y una
 * hora equivocada en una cronología es peor que ninguna; se deja a la vista,
 * en el tooltip, para quien quiera compararla. El servidor la pone al guardar
 * la fila, no al ocurrir el evento, así que una duración sacada de ahí mide la
 * cola del navegador y no al alumno. Por eso no se usa para decir cuánto duró
 * nada de lo que hizo el alumno: esas duraciones vienen dentro del evento.
 *
 * La única resta entre dos horas del servidor es la de los huecos
 * (`conHuecos`), y por eso se rotulan como recepción y no como actividad:
 * «sin eventos recibidos». Después de un corte de red, el hueco mide lo que
 * tardó en llegar el registro, y los eventos de ese tramo aparecen después del
 * hueco, con la hora en que se reenviaron.
 */

function Hora({ evento }: { evento: Evento }) {
  return (
    <time
      className="cifra"
      dateTime={evento.received_at}
      title={`Según el reloj del alumno: ${horaExacta(evento.occurred_at)}`}
    >
      {horaExacta(evento.received_at)}
    </time>
  );
}

/**
 * Una fila, memoizada.
 *
 * Con la sesión abierta llegan eventos cada cinco segundos y la lista se vuelve
 * a dibujar entera. Sin esto, mil cien filas que no cambiaron se re-renderizan
 * para agregar dos: medido sobre una sesión real de una hora, 337 ms de media
 * por refresco contra 16 con la memoización, y la pantalla trabada mientras
 * tanto. El evento de una fila ya guardada no cambia nunca, así que comparar la
 * referencia alcanza.
 */
const Fila = memo(function Fila({ evento }: { evento: Evento }) {
  const { titulo, detalle, icono: Icono } = describirEvento(evento);
  return (
    <tr>
      <td className="eventos__hora"><Hora evento={evento} /></td>
      <td className="eventos__que">
        <span className="eventos__tipo">
          <Icono size={16} aria-hidden="true" />
          <span className="eventos__titulo">{titulo}</span>
        </span>
      </td>
      <td className="eventos__detalle">{detalle}</td>
    </tr>
  );
});

interface Props {
  eventos: Evento[];
  vacio?: React.ReactNode;
}

export function ListaEventos({ eventos, vacio }: Props) {
  // Se recorre en el orden en que llegó, que es como está pensada la búsqueda
  // de huecos, y recién después se da vuelta para mostrarlo.
  const entradas = useMemo(() => conHuecos(eventos).reverse(), [eventos]);

  if (eventos.length === 0) return <>{vacio}</>;

  // El marco recorta la tabla y se desplaza por dentro, pero adentro no hay nada
  // que pueda recibir el foco: sin tabIndex, quien navega con teclado no pasa de
  // la primera pantalla de filas.
  return (
    <div className="eventos__marco" tabIndex={0} role="group" aria-label="Registro de eventos">
      <table className="eventos">
        <caption className="solo-lectores">
          Eventos de la sesión, del más reciente al más viejo, uno por fila. Cada fila dice a
          qué hora llegó al servidor, qué pasó y el detalle que trajo el evento.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="eventos__hora">Hora</th>
            <th scope="col" className="eventos__que">Qué pasó</th>
            <th scope="col">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {entradas.map((entrada) => {
            if (entrada.clase === "hueco") {
              return (
                // Cruza la fila entera y no reparte por columnas: no es un
                // evento, es un corte entre dos. Con la hora en su columna y
                // el texto en la del medio se leía como uno más de la lista.
                // «entre» y no «de X a Y»: la tabla va del más reciente al más
                // viejo, y un rango con dirección se leería al revés del
                // renglón que lo contiene.
                <tr key={entrada.clave} className="eventos__hueco">
                  <td colSpan={3}>
                    <Silencio size={18} aria-hidden="true" />
                    sin eventos recibidos entre {horaCorta(entrada.desde)} y{" "}
                    {horaCorta(entrada.hasta)}
                  </td>
                </tr>
              );
            }

            return <Fila key={entrada.clave} evento={entrada.evento} />;
          })}
        </tbody>
      </table>
    </div>
  );
}
