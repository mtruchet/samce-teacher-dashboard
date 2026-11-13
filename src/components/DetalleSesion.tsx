import { enCifras } from "../cifras";
import { avisoDeCaptura } from "../captura";
import { memo, useEffect, useRef, useState } from "react";
import {
  CADENCIA_MS,
  EVENTOS_POR_PAGINA,
  SesionVencida,
  traerEventos,
  type Evento,
  type SesionNumerada,
} from "../services/sesionesService";
import { horaCorta } from "../eventos";
import { seSigueConsultando } from "../seguimiento";

import { AnalisisSesionVista } from "./AnalisisSesion";
import { CronologiaSesion } from "./CronologiaSesion";
import { ListaEventos } from "./ListaEventos";
import { Transcurrido } from "./Transcurrido";
import { useAnalisisDeSesion } from "./useAnalisisDeSesion";
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
 * registro: ahí se sigue preguntando hasta que llegue (ver `esperaElAviso`, en `seguimiento.ts`).
 *
 * El registro solo muestra lo que se guardó y no calcula nada. Las alertas y el
 * estado del análisis van en su propio apartado («Análisis de la sesión»,
 * `AnalisisSesion`), arriba del registro y con su propia consulta: la de eventos
 * no trae alertas, y mezclarlas haría pasar un cálculo por un dato guardado.
 *
 * Dentro de la lámina del registro, arriba de la tabla, van los momentos para
 * revisar (`CronologiaSesion`): un índice de los pegados y las salidas de la
 * ventana o de la pantalla completa, que lleva a cada fila.
 *
 * Se monta una vez por sesión (el panel le pone `key` con el id de la sesión):
 * al pasar a otra sesión arranca de cero, sin arrastrar nada de la anterior.
 */

/* Cuánto se sigue preguntando después de que la sesión se cerró (`recienCerrada`) está en
   `seguimiento.ts`: el aviso de que una página corrió sin captura lo manda Moodle en una
   tarea programada que corre después de la entrega, así que llega tarde por construcción,
   y el apartado del análisis comparte la regla. */

/** «3/11/2026». El día del examen, como lo escribe un docente. */
function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "numeric", year: "numeric" });
}

/** «194 eventos», «1 evento». */
function cuentaDeEventos(n: number): string {
  return n === 1 ? "1 evento" : `${enCifras(n)} eventos`;
}

/**
 * Cuánto espera el registro a que llegue el análisis antes de dibujarse igual. Con un análisis que no contesta,
 * el docente no se queda sin el registro, que es lo que sí llegó.
 *
 * Ocho segundos y no tres: con tres, un análisis lento (un arranque en frío del servidor) dejaba dibujar el
 * registro y, al llegar, lo empujaba casi una pantalla hacia abajo con el docente ya leyéndolo, que es el salto
 * que había que sacar. Un análisis que falla no espera el plazo: el registro aparece apenas se sabe.
 */
export const PLAZO_DEL_ANALISIS_MS = 8000;

/** Tope de páginas por consulta, para que una sesión enorme no trabe el panel. */
const PAGINAS_MAXIMAS = 20;

/**
 * Cómo se llama en pantalla el estado de la sesión.
 *
 * Los tres que manda el backend, cada uno con su palabra. Son las mismas que
 * usa la lista de sesiones («sin entregar», «Rindiendo ahora», «Entregó»): dos
 * pantallas del mismo dato no pueden decir cosas distintas. Van con mayúscula
 * inicial porque encabezan la ficha. Un valor que este panel todavía no conozca
 * no dice nada, porque afirmar cualquiera de los polos es peor que no mostrar
 * el rótulo.
 */
function estado(status: SesionNumerada["status"]): string {
  const nombres: Record<string, string> = {
    open: "Rindiendo ahora",
    closed: "Entregó",
    abandoned: "Sin entregar",
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

function DetalleSesionSinMemo({ sesion, onVencida, onConsulta }: Props) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  // El análisis se consulta acá y no dentro de su apartado: el detalle tiene que saber cuándo llegó. Las dos
  // consultas salen juntas, pero el registro se dibuja recién cuando el análisis está (o falló, o pasó el
  // plazo). Con red lenta, el registro llegaba primero, se dibujaba arriba y el análisis aparecía después y
  // lo empujaba varios cientos de píxeles hacia abajo, con el docente ya leyéndolo.
  const estadoAnalisis = useAnalisisDeSesion(sesion, onVencida);
  const [plazoVencido, setPlazoVencido] = useState(false);
  useEffect(() => {
    const plazo = window.setTimeout(() => setPlazoVencido(true), PLAZO_DEL_ANALISIS_MS);
    return () => window.clearTimeout(plazo);
  }, []);
  const analisisResuelto = estadoAnalisis.analisis !== null || estadoAnalisis.sinConexion || plazoVencido;
  // El evento al que se pidió ir desde «Momentos para revisar».
  const [destacado, setDestacado] = useState<{ id: number; vez: number } | null>(null);
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
  // Si el ciclo va a volver a preguntar. Arranca con lo que ya se sabe de la sesión: con una cerrada hace rato,
  // arrancar en sí hacía que la cabecera dijera «En vivo» hasta que llegaba la primera respuesta. La primera
  // consulta sale igual, y el ciclo lo corrige cuando decide si programa otra.
  const [consultando, setConsultando] = useState(() => seSigueConsultando(sesion));
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
    // Al salir de la sesión, o al rearmarse el ciclo, el pedido en vuelo se cancela: con un registro largo son
    // varias páginas que se terminaban de descargar para tirarlas.
    const control = new AbortController();

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
          const lote = await traerEventos(examenId, sesionId, cursor, control.signal);
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
      const sigue = seSigueConsultando(
        { status: abierta ? "open" : "closed", closed_at: cierre, capture: { state: captura } },
        avisoRecibido.current
      );
      setConsultando(sigue);
      if (sigue) proxima = window.setTimeout(ciclo, CADENCIA_MS);
    };
    void ciclo();
    return () => {
      vigente = false;
      window.clearTimeout(proxima);
      control.abort();
    };
  }, [examenId, sesionId, abierta, cierre, captura]);

  const primerEvento = eventos[0];
  const ultimoEvento = eventos[eventos.length - 1];
  const rotulo = estado(sesion.status);
  const aviso = avisoDeCaptura(sesion.capture);
  // Un evento «Se perdió parte del registro» dice lo mismo que el aviso de captura, pero desde la página del
  // examen: la captura puede figurar como completa y faltar igual una parte. Con eso, «Momentos para revisar» no
  // puede afirmar sin salvedad que no pegó ni salió.
  const sePerdioParte = eventos.some((e) => e.type === "events_dropped");

  return (
    // Mientras se espera el análisis, el detalle ocupa la pantalla: así el pie no se asoma y vuelve a bajar
    // cuando llega todo. `aria-busy` y no `inert`: con `inert`, el foco caía al principio de la página.
    <div
      // Con el análisis ya dibujado pero los eventos en camino, el detalle conserva el alto de la pantalla: si no,
      // un análisis corto dejaba asomar el pie, que volvía a bajar de golpe al llegar el registro.
      className={analisisResuelto && cargando ? "detalle detalle--llenando" : "detalle"}
      aria-busy={!analisisResuelto || undefined}
    >
      {/* La ficha de la sesión. Quién es el alumno ya lo dicen el título de la
          pantalla y las migas; acá va lo que allá no entra, en una sola fila:
          si entregó, qué intento es, cuándo empezó y cuánto duró. El número
          del aula virtual no está: en la tabla de sesiones se lee porque
          cuelga del nombre, y acá quedaba suelto debajo del título. La
          duración no es un dato nuevo: es la misma que muestra la lista, con
          el mismo componente. Un intento sin entregar no la lleva, por lo
          mismo que en la lista: su cierre es cuando Moodle procesó el
          abandono, no cuando el alumno dejó de rendir. */}
      <div className="detalle__sesion">
        {rotulo ? (
          <span className={abierta ? "detalle__estado detalle__estado--vivo" : "detalle__estado"}>
            {rotulo}
          </span>
        ) : null}
        {sesion.intentos > 1 ? (
          <span className="detalle__dato cifra">Intento {sesion.intento} de {sesion.intentos}</span>
        ) : null}
        {/* Con la fecha (ronda 3): con varios parciales, «Empezó a las 09:11» no decía qué día. */}
        <span className="detalle__dato">
          Empezó el{" "}
          <time className="cifra" dateTime={sesion.started_at}>
            {fechaCorta(sesion.started_at)} a las {horaCorta(sesion.started_at)}
          </time>
        </span>
        {sesion.status === "closed" && sesion.closed_at ? (
          <span className="detalle__dato">
            Duró <Transcurrido inicio={sesion.started_at} cierre={sesion.closed_at} />
          </span>
        ) : null}
      </div>

      {aviso ? (
        <p className="detalle__captura" role="note">
          <strong>{aviso.corto}.</strong> {aviso.detalle}
        </p>
      ) : null}

      <AnalisisSesionVista sesion={sesion} estado={estadoAnalisis} />

      {/* El registro va en una lámina más liviana que la del análisis: el ojo
          tiene que caer primero en el análisis, y el registro queda para
          ubicar un momento. Y aparece después del análisis, nunca antes: se
          lee de arriba abajo, y lo de arriba no puede llegar tarde y empujar
          lo de abajo. Mientras tanto queda solo «Cargando el análisis…», un
          único aviso de espera en vez de dos. */}
      {analisisResuelto ? (
        <section className="lamina lamina--apoyo detalle__registro" aria-labelledby="registro-de-eventos-titulo">
          <header className="lamina__encabezado detalle__encabezado">
            <h2 className="lamina__titulo" id="registro-de-eventos-titulo">Registro de eventos</h2>
            {/* La cuenta y sus extremos van juntos, como una sola frase: en un teléfono bajan enteros a su
                propio renglón, y no partidos a la mitad. */}
            {recibido ? (
              <span className="detalle__cuenta">
                <span className="lamina__cuenta cifra">{cuentaDeEventos(eventos.length)}</span>
                {/* Los dos extremos son las marcas temporales de las filas de las
                    puntas, no una medida de la sesión: dicen hasta dónde llega el
                    registro, que es lo que hace falta para saber si lo que se está
                    mirando está completo. Sin segundos: las filas los tienen. */}
                {primerEvento ? (
                  <span className="detalle__extremos cifra">
                    {/* La coma no va oculta: sin ella, el lector leía la cuenta y los extremos pegados
                        («214 eventosde 04:32…»). */}
                    <span className="detalle__punto">, </span>
                    {/* Sin segundos, dos extremos del mismo minuto se leían «de 14:00 a 14:00». */}
                    {eventos.length === 1 ||
                    horaCorta(primerEvento.received_at) === horaCorta(ultimoEvento.received_at)
                      ? `a las ${horaCorta(primerEvento.received_at)}`
                      : `de ${horaCorta(primerEvento.received_at)} a ${horaCorta(ultimoEvento.received_at)}`}
                  </span>
                ) : null}
              </span>
            ) : (
              // Mientras los eventos no llegan, el lugar de la cuenta está guardado, vacío y oculto: la cuenta es
              // más alta que el título y se alinea por la línea de base, así que al aparecer bajaba el título
              // unos píxeles, y en un teléfono (donde va en su propio renglón) bajaba todo lo de abajo.
              <span className="detalle__cuenta detalle__cuenta--reservada" aria-hidden="true">
                <span className="lamina__cuenta cifra">{" "}</span>
              </span>
            )}
          </header>

          {/* Los avisos del registro van adentro de su lámina, debajo del encabezado: hablan solo del registro,
              y arriba del análisis cada corte de la conexión lo bajaba y lo volvía a subir. El de la captura
              sigue arriba, porque habla de toda la sesión. */}
          {incompleto ? (
            <p className="detalle__aviso" role="status">
              Esta sesión tiene más eventos de los que el panel puede mostrar de una vez. Se ven
              los {enCifras(eventos.length)} primeros, desde el comienzo del examen;
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

          {/* Los momentos para revisar son el índice del registro: van adentro de su lámina, entre el encabezado y
              la tabla, armados con los eventos que el detalle ya tiene, en el orden del registro (de lo más viejo a
              lo más nuevo), y cada uno lleva a su fila. Sin eventos no se dibuja (el registro ya lo dice), y cuando no
              hay momentos, lo que afirma depende de cuánto del registro se conoce. */}
          {recibido && eventos.length > 0 ? (
            <CronologiaSesion
              eventos={eventos}
              alcance={
                incompleto || aviso || sePerdioParte ? "parcial" : abierta ? "abierta" : "completo"
              }
              onIrAlEvento={(id) => setDestacado((d) => ({ id, vez: (d?.vez ?? 0) + 1 }))}
            />
          ) : null}

          {cargando ? (
            <p className="detalle__cargando" role="status">Cargando los eventos…</p>
          ) : !recibido ? null : (
            <ListaEventos
              eventos={eventos}
              destacado={destacado}
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
      ) : null}
    </div>
  );
}

/**
 * Si dos versiones de la sesión se ven igual en el detalle. El panel arma la sesión de nuevo con cada respuesta
 * de la lista, aunque no haya cambiado nada, y el detalle entero (el análisis, los momentos y hasta cientos de
 * filas del registro) se volvía a dibujar cada cinco segundos. Se comparan los datos que el detalle muestra o de
 * los que depende su consulta, y los avisos al panel por identidad: el panel los pasa estables, y uno nuevo
 * tiene que llegar a las referencias que lee el ciclo.
 */
function mismaSesion(a: Props, b: Props): boolean {
  const x = a.sesion;
  const y = b.sesion;
  return (
    x.id === y.id &&
    x.examenId === y.examenId &&
    x.status === y.status &&
    x.started_at === y.started_at &&
    x.closed_at === y.closed_at &&
    x.capture?.state === y.capture?.state &&
    x.capture?.gap_minutes === y.capture?.gap_minutes &&
    x.capture?.last_event_at === y.capture?.last_event_at &&
    x.intento === y.intento &&
    x.intentos === y.intentos &&
    a.onVencida === b.onVencida &&
    a.onConsulta === b.onConsulta
  );
}

export const DetalleSesion = memo(DetalleSesionSinMemo, mismaSesion);
