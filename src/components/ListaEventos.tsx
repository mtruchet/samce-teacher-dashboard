import { enCifras } from "../cifras";
import { memo, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Evento } from "../services/sesionesService";
import { cortesDeConexion, describirEvento, horaCorta, horaExacta } from "../eventos";
import { conHuecos } from "../huecos";
import { Silencio } from "../iconos";
import { AnuncioVivo } from "./AnuncioVivo";
import { useAnuncio } from "./useAnuncio";
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

/** Cuánto dura resaltada la fila a la que se saltó. */
const RESALTADO_MS = 2000;

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
const Fila = memo(function Fila({
  evento,
  cortadaMs,
  destacada,
}: {
  evento: Evento;
  cortadaMs?: number;
  /** Si es la fila a la que se acaba de saltar desde «Momentos para revisar». */
  destacada: boolean;
}) {
  const { titulo, detalle, icono: Icono } = describirEvento(evento, { cortadaMs });
  // El `id` y el foco programático son el destino del salto desde «Momentos para revisar».
  return (
    <tr id={`evento-${evento.id}`} tabIndex={-1} className={destacada ? "eventos__fila--destacada" : undefined}>
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

/**
 * Si el contenido de un elemento es más ancho que el elemento (se desplaza de costado). Se vuelve a medir
 * cuando cambia el tamaño del elemento o de su contenido.
 */
function useDesborde(): [RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [desborda, setDesborda] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setDesborda(el.scrollWidth > el.clientWidth + 1);
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    if (el.firstElementChild) observador.observe(el.firstElementChild);
    return () => observador.disconnect();
  });
  return [ref, desborda];
}

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
  // Cuántas filas quedan sin mostrar, contadas desde el extremo viejo (el de abajo). Se cuentan desde ahí y
  // no cuántas se ven desde arriba: los eventos nuevos entran arriba, y con la cuenta desde arriba cada uno
  // empujaba fuera de la tabla la última fila visible, justo la que el docente podía estar leyendo, y si
  // tenía el foco, el foco caía al principio de la página. Así, un evento nuevo agrega una fila arriba y no
  // saca ninguna de abajo.
  const [ocultas, setOcultas] = useState(() => Math.max(0, entradas.length - TANDA));
  // Un registro que se montó vacío cuenta sus primeras filas cuando llegan, no al montarse: si no, el primer
  // lote entraba entero, con cero ocultas.
  const [iniciada, setIniciada] = useState(entradas.length > 0);
  if (!iniciada && entradas.length > 0) {
    setIniciada(true);
    setOcultas(Math.max(0, entradas.length - TANDA));
  }
  const cuantasSeVen = entradas.length - ocultas;

  // Si la fila pedida no está entre las que se ven, se muestran filas hasta incluirla; después se la lleva a
  // la vista, recibe el foco y queda resaltada un momento.
  // Cada pedido (`vez`) se atiende una sola vez: «Mostrar N más» y los eventos nuevos no vuelven a llevar el
  // foco a la fila.
  const atendido = useRef(0);
  // El resaltado es estado de React y no una clase puesta a mano: con dos saltos seguidos, la clase de la
  // primera fila quedaba puesta, y una fila que se volvía a dibujar la perdía antes de tiempo.
  const [resaltada, setResaltada] = useState<{ id: number; vez: number } | null>(null);
  // Un solo temporizador: cada salto cancela el anterior y arranca otro.
  const apagar = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(apagar.current), []);
  const pendiente = destacado && destacado.vez !== atendido.current ? destacado : null;
  const indiceDestacado = pendiente
    ? entradas.findIndex((e) => e.clase !== "hueco" && e.evento.id === pendiente.id)
    : -1;
  if (indiceDestacado >= cuantasSeVen) setOcultas(entradas.length - 1 - indiceDestacado);
  useEffect(() => {
    if (!destacado || destacado.vez === atendido.current) return;
    const fila = document.getElementById(`evento-${destacado.id}`);
    if (!fila) return;
    atendido.current = destacado.vez;
    const reducido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    fila.scrollIntoView?.({ block: "center", behavior: reducido ? "auto" : "smooth" });
    fila.focus({ preventScroll: true });
    setResaltada({ id: destacado.id, vez: destacado.vez });
    window.clearTimeout(apagar.current);
    apagar.current = window.setTimeout(() => setResaltada(null), RESALTADO_MS);
  }, [destacado, ocultas]);

  // «Se ven los N eventos más recientes de M» queda a la vista y al día, pero se anuncia solo cuando el
  // docente pide más filas: un evento nuevo cambia la cifra en silencio.
  const [anuncioVistos, anunciar] = useAnuncio();
  const [marco, desborda] = useDesborde();
  // Al mostrar más, el foco va a la primera fila nueva, la que sigue a la última que se veía, como en el
  // salto desde los momentos. Con «Mostrar todos» los dos botones desaparecían y el foco caía al principio de
  // la página; con «Mostrar 50 más» se quedaba en el botón, que bajaba cincuenta filas y quedaba fuera de la
  // pantalla, lejos de lo que se acababa de agregar.
  const filaQueSigue = useRef<number | null>(null);
  useEffect(() => {
    if (filaQueSigue.current === null) return;
    document.getElementById(`evento-${filaQueSigue.current}`)?.focus();
    filaQueSigue.current = null;
  }, [ocultas]);
  const mostrar = (nuevasOcultas: number) => {
    const siguiente = entradas.slice(cuantasSeVen).find((e) => e.clase === "evento");
    filaQueSigue.current = siguiente?.clase === "evento" ? siguiente.evento.id : null;
    setOcultas(nuevasOcultas);
    const vistos = entradas.slice(0, entradas.length - nuevasOcultas).filter((e) => e.clase !== "hueco").length;
    anunciar(
      vistos < eventos.length
        ? `Se ven los ${enCifras(vistos)} eventos más recientes de ${enCifras(eventos.length)}.`
        : `Se ven los ${enCifras(eventos.length)} eventos.`
    );
  };

  if (eventos.length === 0) return <>{vacio}</>;

  const mostradas = entradas.slice(0, cuantasSeVen);
  const quedan = entradas.length - mostradas.length;
  // Los huecos no son eventos: la cuenta dice cuántos eventos se ven, que es lo que dice el encabezado.
  const eventosVistos = mostradas.filter((e) => e.clase !== "hueco").length;

  return (
    <>
      {/* Visible y no solo en la `caption`: sin esto, quien mira la tabla por
          primera vez no sabe si lo de arriba es el comienzo o el final. */}
      <p className="eventos__orden" aria-hidden="true">Lo más reciente va arriba.</p>
      {/* El marco solo se desplaza de costado si la tabla no entra. Solo entonces es una parada del
          tabulador, para que el teclado pueda desplazarlo (adentro no hay nada que reciba el foco). Si entra,
          que es lo normal a cualquier ancho, era una parada de más con un anillo alrededor de todo el
          registro, y un grupo con el mismo nombre que la región que lo contiene. */}
      <div
        className={desborda ? "eventos__marco eventos__marco--desborda" : "eventos__marco"}
        ref={marco}
        {...(desborda ? { tabIndex: 0, role: "group", "aria-label": "Registro de eventos" } : {})}
      >
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
                      <Silencio size={16} aria-hidden="true" />
                      sin eventos recibidos entre {horaCorta(entrada.desde)} y{" "}
                      {horaCorta(entrada.hasta)}
                    </td>
                  </tr>
                );
              }

              return (
                <Fila
                  key={entrada.clave}
                  evento={entrada.evento}
                  cortadaMs={cortes.get(entrada.evento.id)}
                  destacada={resaltada?.id === entrada.evento.id}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      {quedan > 0 ? (
        <div className="eventos__mas">
          <p className="eventos__vistos">
            Se ven los {enCifras(eventosVistos)} eventos más recientes de{" "}
            {enCifras(eventos.length)}.
          </p>
          <div className="eventos__botones">
            <button type="button" className="boton-secundario" onClick={() => mostrar(Math.max(0, ocultas - TANDA))}>
              Mostrar {enCifras(Math.min(TANDA, quedan))} más
            </button>
            <button type="button" className="boton-secundario" onClick={() => mostrar(0)}>
              Mostrar todos
            </button>
          </div>
        </div>
      ) : null}
      <AnuncioVivo aviso={anuncioVistos} etiqueta="Eventos a la vista" />
    </>
  );
}
