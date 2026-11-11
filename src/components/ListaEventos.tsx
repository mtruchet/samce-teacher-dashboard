import { memo, useEffect, useMemo, useState } from "react";
import type { Evento } from "../services/sesionesService";
import { cortesDeConexion, describirEvento, horaCorta, horaExacta } from "../eventos";
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
 *
 * Se muestran de a tandas (`TANDA`), con «Mostrar más» y «Mostrar todos»
 * abajo, y la tabla crece con la página en vez de desplazarse por dentro:
 * con el desplazamiento interno, quien miraba el registro veía las diez
 * filas de arriba y no encontraba cómo llegar al resto. Es solo cuántas filas
 * se ven: ninguna se junta con otra, ninguna se esconde por su tipo y el orden
 * sigue siendo el del reloj (criterio 6 de HU10).
 */

/** Cuántas filas se agregan con cada «Mostrar más». */
export const TANDA = 50;

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
const Fila = memo(function Fila({ evento, cortadaMs }: { evento: Evento; cortadaMs?: number }) {
  const { titulo, detalle, icono: Icono } = describirEvento(evento, { cortadaMs });
  // El `id` y el foco programático son el destino del salto desde «Momentos para revisar».
  return (
    <tr id={`evento-${evento.id}`} tabIndex={-1}>
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
  /**
   * La fila a la que hay que llevar al docente (desde «Momentos para revisar»). `vez` cambia en cada pedido,
   * así elegir dos veces el mismo evento vuelve a llevarlo.
   */
  destacado?: { id: number; vez: number } | null;
}

export function ListaEventos({ eventos, vacio, destacado }: Props) {
  // Se recorre en el orden en que llegó, que es como está pensada la búsqueda
  // de huecos, y recién después se da vuelta para mostrarlo.
  const entradas = useMemo(() => conHuecos(eventos).reverse(), [eventos]);
  // Cuánto duró cada corte de la conexión, para que la fila de la vuelta lo diga (ver `cortesDeConexion`).
  const cortes = useMemo(() => cortesDeConexion(eventos), [eventos]);
  const [visibles, setVisibles] = useState(TANDA);

  // Si la fila pedida no está entre las que se ven, se muestran filas hasta incluirla; después se la lleva a
  // la vista, recibe el foco y queda resaltada un momento.
  const indiceDestacado = destacado
    ? entradas.findIndex((e) => e.clase !== "hueco" && e.evento.id === destacado.id)
    : -1;
  if (indiceDestacado >= visibles) setVisibles(indiceDestacado + 1);
  useEffect(() => {
    if (!destacado) return;
    const fila = document.getElementById(`evento-${destacado.id}`);
    if (!fila) return;
    const reducido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    fila.scrollIntoView?.({ block: "center", behavior: reducido ? "auto" : "smooth" });
    fila.focus({ preventScroll: true });
    fila.classList.add("eventos__fila--destacada");
    const quitar = window.setTimeout(() => fila.classList.remove("eventos__fila--destacada"), 2000);
    return () => window.clearTimeout(quitar);
  }, [destacado, visibles]);

  if (eventos.length === 0) return <>{vacio}</>;

  const mostradas = entradas.slice(0, visibles);
  const quedan = entradas.length - mostradas.length;
  // Los huecos no son eventos: la cuenta dice cuántos eventos se ven, que es lo que dice el encabezado.
  const eventosVistos = mostradas.filter((e) => e.clase !== "hueco").length;

  // El marco recorta la tabla y se desplaza por dentro, pero adentro no hay nada
  // que pueda recibir el foco: sin tabIndex, quien navega con teclado no pasa de
  // la primera pantalla de filas.
  return (
    <>
      {/* Visible y no solo en la `caption`: sin esto, quien mira la tabla por
          primera vez no sabe si lo de arriba es el comienzo o el final. */}
      <p className="eventos__orden" aria-hidden="true">Lo más reciente va arriba.</p>
      <div className="eventos__marco" tabIndex={0} role="group" aria-label="Registro de eventos">
        <table className="eventos">
          <caption className="solo-lectores">
            Eventos de la sesión, del más reciente al más viejo, uno por fila. Cada fila dice a
            qué hora se registró, qué pasó y el detalle que trajo el evento.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="eventos__hora">Hora</th>
              <th scope="col" className="eventos__que">Qué pasó</th>
              <th scope="col">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {mostradas.map((entrada) => {
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

              return <Fila key={entrada.clave} evento={entrada.evento} cortadaMs={cortes.get(entrada.evento.id)} />;
            })}
          </tbody>
        </table>
      </div>
      {quedan > 0 ? (
        <div className="eventos__mas">
          <p className="eventos__vistos" role="status">
            Se ven los {eventosVistos.toLocaleString("es-AR")} eventos más recientes de{" "}
            {eventos.length.toLocaleString("es-AR")}.
          </p>
          <div className="eventos__botones">
            <button type="button" className="eventos__boton" onClick={() => setVisibles((v) => v + TANDA)}>
              Mostrar {Math.min(TANDA, quedan).toLocaleString("es-AR")} más
            </button>
            <button type="button" className="eventos__boton" onClick={() => setVisibles(entradas.length)}>
              Mostrar todos
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
