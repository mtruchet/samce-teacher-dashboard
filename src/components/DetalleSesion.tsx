import { avisoDeCaptura } from "../captura";
import { useEffect, useRef, useState } from "react";
import {
  CADENCIA_MS,
  EVENTOS_POR_PAGINA,
  SesionVencida,
  traerEventos,
  type Captura,
  type Evento,
  type SesionNumerada,
} from "../services/sesionesService";
import { horaExacta } from "../eventos";

import { ListaEventos } from "./ListaEventos";
import "./ListaSesiones.css";
import "./DetalleSesion.css";

/**
 * Lo que pasó durante el intento de un alumno.
 *
 * Trae los eventos de la sesión y, mientras la sesión sigue abierta, vuelve a
 * preguntar cada pocos segundos por lo nuevo, con el número del último que ya
 * tiene: no repite lo mostrado ni lo vuelve a descargar. Cuando la sesión se
 * cierra sigue preguntando unos minutos más, porque parte de lo último llega
 * después de la entrega, y ahí deja de preguntar. La excepción es una sesión
 * marcada con una página sin captura cuyo aviso todavía no está en el
 * registro: ahí se sigue preguntando hasta que llegue (ver `esperaElAviso`).
 *
 * Solo muestra lo que se guardó. No calcula nada: la página no tiene índice de
 * integridad, nivel de riesgo ni alertas, y no las tiene porque todavía no
 * existen, no porque falten en la pantalla.
 *
 * Se monta una vez por sesión (el panel le pone `key` con el id de la sesión):
 * al pasar a otra sesión arranca de cero, sin arrastrar nada de la anterior.
 */

/**
 * Cuánto se sigue preguntando después de que la sesión se cerró. El aviso de
 * que una página corrió sin captura lo manda Moodle en una tarea programada
 * que corre después de la entrega, así que llega tarde por construcción.
 */
const TRAS_EL_CIERRE_MS = 10 * 60 * 1000;

/** Si una sesión cerrada todavía puede recibir lo que Moodle manda tarde. */
function recienCerrada(closedAt: string | undefined): boolean {
  if (!closedAt) return false;
  const cierre = Date.parse(closedAt);
  return !Number.isNaN(cierre) && Date.now() - cierre < TRAS_EL_CIERRE_MS;
}

/**
 * Si la sesión dice que una página corrió sin captura, pero el aviso que lo
 * cuenta todavía no llegó al registro.
 *
 * Los diez minutos de `TRAS_EL_CIERRE_MS` no alcanzan siempre: Moodle manda el
 * aviso en una tarea que depende de su cron, y si el servidor de SAMCE no lo
 * acepta la reintenta cada vez más espaciada. La lista de sesiones, que se
 * sigue consultando, ya marca «Captura incompleta», y sin esto el registro
 * abierto se quedaba sin la fila que lo explica. Mientras falte, se sigue
 * preguntando.
 */
function esperaElAviso(captura: Captura["state"] | undefined, yaLlego: boolean): boolean {
  return (captura === "js_disabled" || captura === "no_start") && !yaLlego;
}
/** Tope de páginas por consulta, para que una sesión enorme no trabe el panel. */
const PAGINAS_MAXIMAS = 20;

/**
 * Cómo se llama en pantalla el estado de la sesión.
 *
 * Los tres que manda el backend, cada uno con su palabra. «sin entregar» es la
 * misma que usa la lista de sesiones: dos pantallas del mismo dato no pueden
 * decir cosas distintas. Un valor que este panel todavía no conozca no dice
 * nada, porque afirmar cualquiera de los polos es peor que no mostrar el rótulo.
 */
function estado(status: SesionNumerada["status"]): string {
  const nombres: Record<string, string> = {
    open: "rindiendo ahora",
    closed: "entregó",
    abandoned: "sin entregar",
  };
  return nombres[status] ?? "";
}

interface Props {
  sesion: SesionNumerada;
  /** El token dejó de valer: no se arregla reintentando, lo resuelve el panel. */
  onVencida: () => void;
  /**
   * Avisa si el registro se sigue consultando y si la última consulta falló.
   * Lo usa el panel para que su cabecera no diga «se actualiza» sobre un
   * registro que ya no se pide, ni «en vivo» sobre uno que no se pudo traer.
   */
  onConsulta?: (sigue: boolean, fallo: boolean) => void;
}

export function DetalleSesion({ sesion, onVencida, onConsulta }: Props) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  // La consulta corta a las `PAGINAS_MAXIMAS`, y sin esto el corte era mudo:
  // la pantalla mostraba una parte del registro y el contador decía que eso
  // era todo. Un registro incompleto que no se anuncia es peor que uno corto.
  const [incompleto, setIncompleto] = useState(false);
  // El último `id` (orden de llegada) que ya se tiene. Va en una referencia y no en el estado
  // porque la consulta lo lee y lo escribe, y si estuviera en el estado, cada
  // respuesta rearmaría el efecto y volvería a consultar de inmediato.
  const ultimo = useRef(0);
  // Los avisos al panel también van en referencias, y por lo mismo: el panel
  // se redibuja con cada respuesta de su propia consulta y le pasa funciones
  // nuevas cada vez. Si el efecto dependiera de ellas, se reiniciaría en cada
  // redibujo y volvería a pedir todo el registro.
  const alVencer = useRef(onVencida);
  const alConsultar = useRef(onConsulta);
  useEffect(() => {
    alVencer.current = onVencida;
    alConsultar.current = onConsulta;
  });
  // Si el ciclo va a volver a preguntar. Arranca en sí: la primera consulta
  // sale siempre, y el ciclo lo corrige cuando decide si programa otra.
  const [consultando, setConsultando] = useState(true);
  const [sinConexion, setSinConexion] = useState(false);
  // El fallo también se avisa: si no, con la lista de sesiones respondiendo,
  // la cabecera decía «En vivo» justo encima del aviso de que el registro no
  // se pudo actualizar, y las dos cosas no pueden ser ciertas a la vez.
  useEffect(() => {
    alConsultar.current?.(consultando, sinConexion);
  }, [consultando, sinConexion]);
  // Si el aviso de una página sin captura ya está en el registro. Va en una
  // referencia porque lo lee el ciclo, que no debe rearmarse con cada evento.
  const avisoRecibido = useRef(false);
  const examenId = sesion.examenId;
  const sesionId = sesion.id;
  const captura = sesion.capture?.state;
  // Sirve para saber si hay que seguir preguntando por eventos nuevos, y nada
  // más. El rótulo NO sale de acá: con un booleano, `abandoned` caía en el
  // «else» y esta pantalla decía «entregó» de un intento que justamente no se
  // entregó, contradiciendo a la lista, que del mismo dato dice «sin entregar».
  const abierta = sesion.status === "open";
  const cierre = sesion.closed_at;

  // Si alguna consulta de esta sesión llegó bien. Sin esto, una primera
  // consulta fallida mostraba el contador en 0 y «todavía no hay eventos»,
  // cuando lo único que se sabía es que el servidor no contestó.
  const [recibido, setRecibido] = useState(false);
  // Mientras no llegó nada y la primera consulta no falló.
  const cargando = !recibido && !sinConexion;

  useEffect(() => {
    let vigente = true;
    let proxima: number | undefined;

    async function consultar() {
      try {
        const nuevos: Evento[] = [];
        // El cursor va en una variable local y se asienta recién al final,
        // junto con las filas. Avanzándolo página por página, una consulta que
        // fallaba a mitad de la paginación lo dejaba adelantado sobre eventos
        // que nunca se habían mostrado: la vuelta siguiente pedía desde ahí y
        // el tramo del medio no aparecía nunca más, en silencio.
        let cursor = ultimo.current;
        let quedaban = false;
        for (let pagina = 0; pagina < PAGINAS_MAXIMAS; pagina++) {
          const lote = await traerEventos(examenId, sesionId, cursor);
          if (!vigente) return;
          nuevos.push(...lote);
          // El cursor es el `id` (orden de llegada) y no el `seq` (que arma el
          // navegador): con `seq` se perdían los eventos que llegaban tarde con
          // un valor menor al último visto, y no volvían a aparecer nunca.
          if (lote.length > 0) cursor = Math.max(cursor, ...lote.map((e) => e.id));
          if (lote.length < EVENTOS_POR_PAGINA) break;
          // La última vuelta vino llena: hay más del otro lado del tope.
          quedaban = pagina === PAGINAS_MAXIMAS - 1;
        }
        // Nunca para atrás: una respuesta vieja que llega tarde no puede hacer
        // que se relea todo desde el principio.
        ultimo.current = Math.max(ultimo.current, cursor);
        if (nuevos.some((e) => e.type === "capture_status")) avisoRecibido.current = true;
        if (nuevos.length > 0) {
          // Se deduplica por `id` y se ordena con el mismo reloj que se
          // muestra: la hora de llegada al servidor, y dentro de un mismo envío
          // (que comparte esa hora) por `seq`, el orden en que ocurrieron.
          // Ordenar solo por `seq`, que arma el reloj de la computadora del
          // alumno, y mostrar la hora del servidor daba horas desordenadas,
          // huecos de silencio falsos y extremos «de X a Y» invertidos cuando
          // un evento llegaba tarde. Así, un evento tardío queda donde llegó,
          // que es la hora que dice.
          setEventos((actuales) => {
            const vistos = new Set(actuales.map((e) => e.id));
            const frescos = nuevos.filter((e) => !vistos.has(e.id));
            return frescos.length
              ? [...actuales, ...frescos].sort(
                  (a, b) =>
                    Date.parse(a.received_at) - Date.parse(b.received_at) || a.seq - b.seq || a.id - b.id
                )
              : actuales;
          });
        }
        setIncompleto(quedaban);
        setSinConexion(false);
        setRecibido(true);
      } catch (error) {
        if (!vigente) return;
        if (error instanceof SesionVencida) {
          alVencer.current();
          return;
        }
        // Se conserva lo último que llegó y se reintenta: seguir mostrándolo
        // como si fuera de ahora sería mentir, así que se avisa.
        setSinConexion(true);
      }
    }

    // Con la sesión abierta se vuelve a preguntar, y la próxima consulta se
    // programa cuando termina la anterior: con un intervalo fijo, una respuesta
    // lenta se superponía con la siguiente. Al cerrarse la sesión el efecto se
    // rearma sin vaciar nada y sigue preguntando desde el último evento que ya
    // tenía, durante `TRAS_EL_CIERRE_MS`, para que aparezca lo que Moodle
    // manda después de la entrega. Y más allá de eso, mientras la sesión esté
    // marcada sin captura y el aviso no haya llegado. Si la marca aparece
    // cuando el ciclo ya había parado, el efecto se rearma (depende de
    // `captura`) y vuelve a preguntar.
    const ciclo = async () => {
      await consultar();
      if (!vigente) return;
      const sigue = abierta || recienCerrada(cierre) || esperaElAviso(captura, avisoRecibido.current);
      setConsultando(sigue);
      if (sigue) proxima = window.setTimeout(ciclo, CADENCIA_MS);
    };
    void ciclo();
    return () => {
      vigente = false;
      window.clearTimeout(proxima);
    };
  }, [examenId, sesionId, abierta, cierre, captura]);

  const primerEvento = eventos[0];
  const ultimoEvento = eventos[eventos.length - 1];
  const rotulo = estado(sesion.status);
  const aviso = avisoDeCaptura(sesion.capture);

  return (
    <div className="detalle">
      {/* Quién es el alumno ya lo dicen el título de la pantalla y las migas.
          Acá va lo que allá no entra, y nada más. El número del aula virtual no
          está: en la tabla de sesiones se lee porque cuelga del nombre, y acá
          quedaba suelto debajo del título, repitiéndolo cuando el alumno no
          tiene nombre y sin decir nada cuando sí lo tiene. El estado va
          apartado a la derecha porque es lo único que cambia solo mientras la
          pantalla está abierta. */}
      <div className="detalle__sesion">
        <span className="detalle__datos">
          {sesion.intentos > 1 ? (
            <span className="cifra">intento {sesion.intento} de {sesion.intentos}</span>
          ) : null}
        </span>
        {rotulo ? (
          <span className={abierta ? "detalle__estado detalle__estado--vivo" : "detalle__estado"}>
            {rotulo}
          </span>
        ) : null}
      </div>

      {aviso ? (
        <p className="detalle__captura" role="note">
          <strong>{aviso.corto}.</strong> {aviso.detalle}
        </p>
      ) : null}

      {incompleto ? (
        <p className="detalle__aviso" role="status">
          Esta sesión tiene más eventos de los que el panel puede mostrar de una vez. Se ven
          los {eventos.length.toLocaleString("es-AR")} primeros, desde el comienzo del examen;
          todavía falta lo más reciente.
        </p>
      ) : null}

      {/* Cuando el ciclo ya no pregunta más, prometer que se sigue intentando
          sería afirmar algo que el código no hace. Salir de la sesión y volver
          a entrar sí dispara una consulta nueva, porque el efecto depende de
          `sesionId`. */}
      {sinConexion ? (
        <p className="detalle__aviso" role="status">
          {consultando
            ? "No se pudo actualizar el registro. Se sigue intentando, y lo que se ve es lo último que llegó."
            : "No se pudo actualizar el registro. Lo que se ve es lo último que llegó. Volvé a entrar a la sesión para pedirlo de nuevo."}
        </p>
      ) : null}

      <section className="lista">
        <header className="lista__encabezado">
          <h2 className="lista__titulo">Registro de eventos</h2>
          {recibido ? <span className="lista__cuenta cifra">{eventos.length}</span> : null}
          {/* Los dos extremos son las marcas temporales de las filas de las
              puntas, no una medida de la sesión: dicen hasta dónde llega el
              registro, que es lo que hace falta para saber si lo que se está
              mirando está completo. */}
          {primerEvento ? (
            <span className="detalle__extremos cifra">
              de {horaExacta(primerEvento.received_at)} a {horaExacta(ultimoEvento.received_at)}
            </span>
          ) : null}
        </header>

        {cargando ? (
          <p className="detalle__cargando" role="status">Cargando los eventos…</p>
        ) : !recibido ? null : (
          <ListaEventos
            eventos={eventos}
            vacio={
              <p className="panel__vacio">
                {/* Tres casos y no dos. Que no haya llegado nada se decide con
                    `consultando`, no con `abierta`: el ciclo sigue preguntando
                    unos minutos después del cierre y, si falta el aviso de una
                    página sin captura, sin plazo — decir ahí que no quedó
                    ninguno contradice al encabezado, que marca «En vivo».
                    Y con el intento ya entregado no se puede prometer que los
                    eventos aparecen al abrirse la página: esa página ya se
                    cerró, y lo único que puede llegar es lo que venía tarde. */}
                {!consultando
                  ? "No quedó ningún evento registrado en esta sesión."
                  : abierta
                    ? "Todavía no hay eventos registrados para esta sesión. Aparecen solos en cuanto se abre la página del examen."
                    : "Todavía no hay eventos registrados para esta sesión. El intento ya se entregó, así que solo puede aparecer lo que haya quedado en camino."}
              </p>
            }
          />
        )}
      </section>
    </div>
  );
}
