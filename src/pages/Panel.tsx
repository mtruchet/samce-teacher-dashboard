import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Broadcast, Examen, Materia } from "../iconos";
import { clearSession, esPanelGeneral, getStoredSession } from "../services/authService";
import {
  CADENCIA_MS,
  SESIONES_POR_PAGINA,
  SESIONES_TOPE,
  SesionVencida,
  traerExamenes,
  traerSesiones,
  type ExamenMonitoreado,
  type SesionDeExamen,
  type SesionNumerada,
  nombreDeAlumno,
} from "../services/sesionesService";
import { Arranque } from "../components/Arranque";
import { BarraPanel } from "../components/BarraPanel";
import { DetalleSesion } from "../components/DetalleSesion";
import { Fichas, type Ficha } from "../components/Fichas";
import { ListaSesiones } from "../components/ListaSesiones";
import { Migas, type Escalon } from "../components/Migas";
import { PulsoEnlace, type EstadoEnlace } from "../components/PulsoEnlace";
import { Pie } from "../components/Pie";
import { SinSesion } from "./SinSesion";
import { API_CONFIG } from "../config/api.config";
import "./Panel.css";

/**
 * El panel del docente.
 *
 * Muestra las sesiones que el backend registró de verdad: cuando un alumno
 * inicia el intento en el aula virtual, el complemento avisa y la sesión
 * aparece acá sola. Nada de lo que se ve está inventado.
 *
 * Se recorre por niveles —curso, examen, sesiones— en vez de volcar todo en una
 * sola tabla. Un docente con cuatro materias y dos parciales en cada una
 * tendría decenas de filas donde lo que busca se pierde; así cada pantalla
 * responde una sola pregunta, y el recuento de cada ficha dice si vale la pena
 * entrar. Cuando se entra desde un curso puntual ese escalón ya está resuelto
 * por el propio enlace, y el recorrido arranca en los exámenes.
 *
 * Falta una columna a propósito. El índice de integridad y el nivel de riesgo
 * viven en tablas que todavía no existen, y escribir «sin dato» tantas veces
 * como sesiones haya sería peor que no tener la columna: convierte el vacío en
 * ruido y enseña a ignorar justo la región donde después va a estar lo
 * importante.
 */

/**
 * Numera los intentos de cada alumno dentro de un examen, por orden de
 * comienzo. El cuestionario admite reintentos, así que sin esto dos filas del
 * mismo alumno quedan idénticas y no hay manera de saber cuál es cuál.
 */
function numerarIntentos(sesiones: SesionDeExamen[]): SesionNumerada[] {
  const porAlumno = new Map<number, SesionDeExamen[]>();
  for (const s of sesiones) {
    const suyas = porAlumno.get(s.moodle_user_id);
    if (suyas) suyas.push(s);
    else porAlumno.set(s.moodle_user_id, [s]);
  }

  const lugar = new Map<number, { intento: number; intentos: number }>();
  for (const suyas of porAlumno.values()) {
    suyas
      .sort((a, b) => a.started_at.localeCompare(b.started_at))
      .forEach((s, i) => lugar.set(s.id, { intento: i + 1, intentos: suyas.length }));
  }

  return sesiones.map((s) => ({ ...s, ...lugar.get(s.id)! }));
}

/**
 * Cuántas sesiones hay, por estado, en un conjunto de exámenes. Salen de los
 * recuentos que el backend manda con cada examen.
 *
 * Las abandonadas van aparte y no sumadas a las entregadas: el intento que
 * venció sin entregarse es lo contrario de una entrega.
 */
function contar(deLosExamenes: ExamenMonitoreado[]) {
  return {
    enCurso: deLosExamenes.reduce((n, e) => n + e.open_sessions, 0),
    entregadas: deLosExamenes.reduce((n, e) => n + e.closed_sessions, 0),
    sinEntregar: deLosExamenes.reduce((n, e) => n + e.abandoned_sessions, 0),
  };
}

export function Panel() {
  const navigate = useNavigate();
  // El ingreso del docente al panel (su token, sus cursos). Se llama así y no
  // «sesión» para no confundirlo con las sesiones de examen de los alumnos.
  // Se lee una sola vez, al entrar: `getStoredSession` parsea el JSON guardado
  // y devuelve un objeto nuevo cada vez que se la llama, y leída en cada render
  // cualquier cálculo que dependa de ella se rehace sin motivo. Mientras el
  // panel está abierto no cambia: si cambiara, sería porque se salió, y
  // entonces esta pantalla ya no está.
  const [ingreso] = useState(getStoredSession);

  // En qué nivel está parado vive en la dirección y no en un estado interno:
  // así el botón de volver del navegador funciona, y recargar en medio de un
  // examen devuelve a la misma pantalla en vez de al principio.
  const [parametros, setParametros] = useSearchParams();
  const cursoElegido = parametros.get("curso");
  const examenElegido = parametros.get("examen");
  const sesionElegida = parametros.get("sesion");

  const [examenes, setExamenes] = useState<ExamenMonitoreado[]>([]);
  // Solo las sesiones del examen que se está mirando, con el examen del que
  // son: las de los demás no se piden.
  const [cargadas, setCargadas] = useState<{ examenId: number; lista: SesionDeExamen[] } | null>(null);
  // Cuántas «páginas» de 50 sesiones se pidieron, y de qué examen. Al cambiar
  // de examen (o volver a entrar a uno) vuelve a 1 en el mismo render, con el
  // ajuste de estado durante el render que React admite para esto: hacerlo
  // con un efecto largaba primero una consulta con el número viejo, que se
  // descartaba y se rehacía enseguida.
  const [paginasDe, setPaginasDe] = useState({ examen: examenElegido, n: 1 });
  if (paginasDe.examen !== examenElegido) setPaginasDe({ examen: examenElegido, n: 1 });
  const paginas = paginasDe.examen === examenElegido ? paginasDe.n : 1;
  const pedirOtraPagina = useCallback(
    () => setPaginasDe({ examen: examenElegido, n: paginas + 1 }),
    [examenElegido, paginas]
  );
  const [enlace, setEnlace] = useState<EstadoEnlace>("vivo");
  // Cómo está el registro que se está mirando: si se sigue pidiendo y si la
  // última consulta falló. Lo avisa `DetalleSesion`, que es quien pregunta y
  // decide cuándo deja de hacerlo. Se guarda de qué sesión es, para que al
  // entrar a otra no quede heredado de la anterior.
  const [registro, setRegistro] = useState<{ sesion: string | null; sigue: boolean; fallo: boolean } | null>(
    null
  );
  const [marca, setMarca] = useState(0);
  const [vencida, setVencida] = useState(false);
  // Si alguna consulta llegó bien. Sin esto, una primera consulta fallida
  // dejaba la lista de exámenes vacía y la pantalla afirmaba «todavía no hay
  // ningún examen en curso», cuando lo único que se sabía es que el servidor
  // no había contestado.
  const [recibido, setRecibido] = useState(false);
  // Mientras no llegó nada y la primera consulta no falló.
  const cargando = !recibido && enlace === "vivo";

  const general = ingreso ? esPanelGeneral(ingreso) : false;

  // El token dejó de valer: no se arregla reintentando.
  const vencer = useCallback(() => {
    clearSession();
    setVencida(true);
  }, []);

  /**
   * Cuál es la consulta que vale. Sube con cada pedido, y el que vuelve con un
   * número viejo se descarta sin tocar la pantalla.
   *
   * Hacen falta dos llamadas al servidor y el docente puede cambiar de examen
   * entre una y la otra, o mientras el refresco de los cinco segundos está en
   * vuelo. Sin esto, la respuesta que llega tarde pisa la lista con las
   * sesiones del examen anterior, y como también pisa `cargadas`, la pantalla
   * queda convencida de que esas son las del examen que se está mirando.
   */
  const pedido = useRef(0);

  const consultar = useCallback(async () => {
    const mio = ++pedido.current;
    try {
      const lista = await traerExamenes();
      if (mio !== pedido.current) return;

      // Las sesiones se piden solo del examen que la dirección tiene elegido, y
      // solo si es de uno de los cursos del docente (la lista ya viene filtrada
      // por el backend según su token).
      const elegido = examenElegido ? lista.find((e) => String(e.id) === examenElegido) : undefined;
      const delElegido = elegido
        ? (await traerSesiones(elegido.id, paginas * SESIONES_POR_PAGINA)).map((s) => ({
            ...s,
            examenId: elegido.id,
          }))
        : [];

      if (mio !== pedido.current) return;

      setExamenes(lista);
      setRecibido(true);
      setCargadas(elegido ? { examenId: elegido.id, lista: delElegido } : null);
      setEnlace("vivo");
      setMarca((m) => m + 1);
    } catch (error) {
      // Que el token haya vencido no es un problema de red, y tratarlo como
      // tal es lo peor que puede hacer el panel: se queda mostrando «sin
      // conexión, reintentando» encima de una lista que ya no se actualiza,
      // mientras puede haber alumnos rindiendo de los que no se entera.
      if (mio !== pedido.current) return;

      if (error instanceof SesionVencida) {
        vencer();
        return;
      }

      // Cualquier otro fallo sí se reintenta, y se conserva lo último que
      // llegó. Seguir mostrándolo como si fuera de ahora sería mentir, así que
      // el estado del canal lo dice.
      setEnlace("sin-conexion");
    }
  }, [examenElegido, paginas, vencer]);

  useEffect(() => {
    if (vencida) return;

    // La próxima consulta se programa recién cuando termina la anterior. Con un
    // intervalo fijo, un servidor que tardaba más de cinco segundos recibía un
    // pedido nuevo antes de contestar el anterior, cada respuesta llegaba ya
    // descartada por vieja, y el panel seguía diciendo «En vivo» sin mostrar
    // nada nuevo.
    let activo = true;
    let proxima: number | undefined;
    const ciclo = async () => {
      await consultar();
      if (activo) proxima = window.setTimeout(ciclo, CADENCIA_MS);
    };
    void ciclo();
    return () => {
      activo = false;
      window.clearTimeout(proxima);
    };
  }, [consultar, vencida]);

  // `reemplazar` es para cuando el panel corrige la dirección solo, sin que el
  // docente haya hecho nada: esa corrección no puede quedar en el historial,
  // porque «Atrás» volvería a la dirección mala y el panel lo mandaría otra
  // vez adelante, sin salida.
  const irA = useCallback(
    (destino: { curso?: string | null; examen?: string | null; sesion?: string }, reemplazar = false) => {
      const siguiente = new URLSearchParams();
      if (destino.curso) siguiente.set("curso", destino.curso);
      if (destino.examen) siguiente.set("examen", destino.examen);
      if (destino.sesion) siguiente.set("sesion", destino.sesion);
      setParametros(siguiente, { replace: reemplazar });
    },
    [setParametros]
  );

  function salir() {
    clearSession();
    navigate("/", { replace: true });
  }

  function verEventos(s: SesionNumerada) {
    // El estado del registro anterior no vale para este: si quedara, la
    // cabecera mostraría un instante «Intento terminado» de la otra visita.
    setRegistro(null);
    irA({ curso: cursoElegido, examen: examenElegido, sesion: String(s.id) });
  }

  // Salen del token y no de los exámenes: así aparecen también los cursos donde
  // todavía nadie rindió, que son la mayoría fuera de la época de parciales.
  const fichasDeCursos: Ficha[] = useMemo(
    () =>
      (ingreso?.courses ?? []).map((c) => ({
        clave: String(c.id),
        nombre: c.name,
        ...contar(examenes.filter((e) => e.moodle_course_id === c.id)),
      })),
    [ingreso?.courses, examenes]
  );

  // La dirección se puede escribir a mano, quedar en un favorito o venir de
  // antes de cambiar de modo. Se valida contra lo que el docente tiene de
  // verdad, y si no cierra, se lo devuelve al nivel de arriba en vez de dejarlo
  // en una pantalla vacía sin manera de volver.
  //
  // Sólo se valida con el canal vivo: si el backend no contestó, la lista de
  // exámenes está vacía por el corte y no porque el examen no exista, y sacar
  // al docente de lo que está mirando en medio de un examen sería peor que
  // esperar a que vuelva la conexión.
  const datosAlDia = enlace === "vivo";
  const cursoDelToken = general
    ? ingreso?.courses?.find((c) => String(c.id) === cursoElegido)
    : undefined;
  const cursoValido = general ? (datosAlDia ? Boolean(cursoDelToken) : Boolean(cursoElegido)) : true;

  const cursoActual = general ? Number(cursoElegido) : (ingreso?.courseId ?? 0);
  const nombreCursoActual = general ? (cursoDelToken?.name ?? "") : (ingreso?.courseName ?? "");

  const fichasDeExamenes: Ficha[] = useMemo(
    () =>
      examenes
        .filter((e) => e.moodle_course_id === cursoActual)
        .map((e) => ({
          clave: String(e.id),
          nombre: e.name,
          ...contar([e]),
        })),
    [examenes, cursoActual]
  );

  // Las sesiones que hay en memoria no son del examen elegido: pasa al elegir
  // uno nuevo, hasta que el servidor contesta. Mostrarlas daba «no hay
  // sesiones vigentes» en un examen con alumnos rindiendo.
  const sesionesAjenas = Boolean(examenElegido) && cargadas?.examenId !== Number(examenElegido);
  // Recién elegido un examen que existe, sus sesiones todavía no llegaron: sin
  // esto se ve un instante «no hay sesiones vigentes» que no es cierto.
  const esperandoSesiones =
    datosAlDia && sesionesAjenas && examenes.some((e) => String(e.id) === examenElegido);
  const examenDelCurso = examenes.find(
    (e) => String(e.id) === examenElegido && e.moodle_course_id === cursoActual
  );
  const nombreExamenActual = examenDelCurso?.name ?? "";
  // Cuántas sesiones tiene el examen, según los recuentos del backend.
  const recuento = contar(examenDelCurso ? [examenDelCurso] : []);
  const totalFinalizadas = recuento.entregadas + recuento.sinEntregar;
  const totalDelExamen = recuento.enCurso + totalFinalizadas;
  const examenValido = datosAlDia ? Boolean(examenDelCurso) : Boolean(examenElegido);

  // «intento N de M» se cuenta sobre las sesiones cargadas, así que solo se
  // muestra cuando están todas. Con la lista cortada, el intento anterior de un
  // alumno puede estar en la página que no se pidió y el número saldría mal.
  const delEsteExamen = sesionesAjenas || !cargadas ? [] : cargadas.lista;
  const delExamen: SesionNumerada[] =
    delEsteExamen.length >= totalDelExamen
      ? numerarIntentos(delEsteExamen)
      : delEsteExamen.map((s) => ({ ...s, intento: 1, intentos: 1 }));

  // La sesión se busca entre las del examen, que son las que el backend
  // devolvió para este docente. Una dirección con una sesión que no está ahí
  // —de otro examen, o a mano— cae a la lista de sesiones en vez de mostrar
  // una pantalla que el backend igual rechazaría.
  const sesionDelExamen = delExamen.find((s) => String(s.id) === sesionElegida);

  // La última vez que se vio la sesión elegida. Las sesiones llegan paginadas,
  // las abiertas primero: cuando el alumno entrega, o cuando empiezan alumnos
  // nuevos, la sesión que el docente está mirando puede quedar fuera de la
  // página cargada, y sin esto el registro se cerraba solo en medio de la
  // lectura. Se la sigue mostrando con el último dato conocido mientras se
  // piden más páginas para encontrarla.
  const vista = useRef<{ id: string; examen: string | null; sesion: SesionNumerada } | null>(null);
  if (sesionDelExamen && sesionElegida) {
    vista.current = { id: sesionElegida, examen: examenElegido, sesion: sesionDelExamen };
  }
  const recordada =
    vista.current && vista.current.id === sesionElegida && vista.current.examen === examenElegido
      ? vista.current.sesion
      : undefined;
  const sesionMostrada = sesionDelExamen ?? recordada;

  // Si la sesión elegida no está entre las cargadas, se piden más páginas hasta
  // encontrarla. Si con todas cargadas no aparece y nunca se la vio, se saca de
  // la dirección: quedaba colgada y, cuando «Ver más» la traía, la pantalla
  // saltaba sola al registro sin que el docente hiciera nada.
  //
  // Si ya se la había visto, se la sigue mostrando mientras se busca: la lista
  // y los recuentos llegan en dos pedidos, y un alumno que empieza entre uno y
  // otro puede empujarla fuera de la página con un recuento que todavía no lo
  // cuenta. Recién con el tope del backend alcanzado se vuelve a la lista: ahí
  // ya no hay forma de traerla, y mostrarla quieta la dejaba congelada.
  const buscandoSesion =
    datosAlDia && recibido && Boolean(sesionElegida) && !sesionDelExamen &&
    examenValido && !sesionesAjenas;
  const cuantasCargadas = delEsteExamen.length;
  useEffect(() => {
    if (!buscandoSesion) return;
    const quedanMas = cuantasCargadas < totalDelExamen && paginas * SESIONES_POR_PAGINA < SESIONES_TOPE;
    // La página pedida ya llegó entera: hay que pedir la siguiente.
    const paginaLlegada = cuantasCargadas >= paginas * SESIONES_POR_PAGINA;
    if (quedanMas && paginaLlegada) {
      pedirOtraPagina();
    } else if (!quedanMas && (!recordada || paginas * SESIONES_POR_PAGINA >= SESIONES_TOPE)) {
      irA({ curso: cursoElegido, examen: examenElegido }, true);
    }
  }, [buscandoSesion, cuantasCargadas, totalDelExamen, paginas, recordada, pedirOtraPagina, irA, cursoElegido, examenElegido]);

  // Qué pantalla toca. El escalón de cursos sólo existe en el panel general: si
  // se entró desde un curso, el propio enlace ya lo eligió.
  const nivel =
    general && !cursoValido
      ? "cursos"
      : !examenValido
        ? "examenes"
        : sesionMostrada
          ? "eventos"
          : "sesiones";

  const escalones: Escalon[] = [];
  if (general) {
    escalones.push({
      nombre: "Todos mis cursos",
      volver: nivel === "cursos" ? undefined : () => irA({}),
    });
  }
  if (nivel !== "cursos" && nombreCursoActual) {
    escalones.push({
      nombre: nombreCursoActual,
      volver:
        nivel === "sesiones" || nivel === "eventos"
          ? () => irA({ curso: cursoElegido })
          : undefined,
    });
  }
  if ((nivel === "sesiones" || nivel === "eventos") && nombreExamenActual) {
    escalones.push({
      nombre: nombreExamenActual,
      volver:
        nivel === "eventos"
          ? () => irA({ curso: cursoElegido, examen: examenElegido })
          : undefined,
    });
  }
  const nombreDelAlumno = sesionMostrada ? nombreDeAlumno(sesionMostrada) : "";
  if (nivel === "eventos") {
    escalones.push({ nombre: nombreDelAlumno });
  }

  const titulo =
    nivel === "cursos"
      ? "Todos mis cursos"
      : nivel === "examenes"
        ? nombreCursoActual
        : nivel === "eventos"
          ? nombreDelAlumno
          : nombreExamenActual;

  // Sin sesión no hay nada que supervisar: se explica y se lo devuelve al
  // campus, igual que a quien llega de un favorito viejo.
  if (vencida) return <SinSesion motivo="vencida" />;

  const enCurso = delExamen.filter((s) => s.status === "open");
  const finalizadas = delExamen.filter((s) => s.status !== "open");

  // La pantalla de escucha es para cuando no hay absolutamente nada que
  // recorrer. Con fichas para elegir, aunque estén en cero, el docente tiene
  // algo que hacer y hay que dejarlo hacerlo.
  const nadaQueMostrar =
    nivel === "cursos" ? fichasDeCursos.length === 0 : nivel === "examenes" && fichasDeExamenes.length === 0;

  // En el registro de un intento, el pulso habla de lo que el docente mira y
  // no solo de la lista de sesiones, que se sigue pidiendo por detrás. Un
  // corte de la lista se avisa primero, porque deja todo lo demás sin
  // actualizar. Después, un registro que ya no se consulta dice que quedó
  // quieto: prometer «se actualiza» sería falso aunque la última consulta
  // hubiera fallado, y el aviso del registro ya explica cómo volver a pedirlo.
  // Y un registro que se sigue consultando pero no contesta no puede decir
  // «En vivo» encima del aviso de que no se pudo actualizar.
  const delRegistro = nivel === "eventos" && registro?.sesion === sesionElegida ? registro : null;
  const estadoPulso: EstadoEnlace =
    enlace !== "vivo"
      ? enlace
      : delRegistro && !delRegistro.sigue
        ? "quieto"
        : delRegistro?.fallo
          ? "sin-conexion"
          : "vivo";

  return (
    <>
      <a className="salto" href="#sesiones">Ir al contenido</a>

      <BarraPanel
        docente={ingreso?.displayName || (ingreso?.username ?? "")}
        // El atajo del encabezado siempre lleva a todos sus cursos. En el panel
        // general ya están adentro del token, así que es un salto interno; desde
        // un curso el token autoriza esa materia sola, y la lista completa la
        // firma el campus: es un enlace y no una llamada a la API porque el
        // docente tiene su sesión de Moodle abierta y vuelve con un token nuevo.
        cursos={
          general
            ? { onInicio: () => irA({}) }
            : { href: `${API_CONFIG.MOODLE_URL}${API_CONFIG.MOODLE_LAUNCH_GENERAL}` }
        }
        onSalir={salir}
      />

      <main className="marco marco--panel panel" id="sesiones">
        {cargando || esperandoSesiones ? (
          // El mismo pulso que ya estaba girando antes de que React montara. Un
          // dibujo nuevo acá se leería como que algo terminó y algo distinto
          // empezó, cuando en realidad es la misma espera.
          <Arranque encajado />
        ) : (
          <>
            <div className="panel__cabecera">
              <Migas escalones={escalones} />

              <div className="panel__encabezado">
                {/* El salto a todos sus cursos vive en el encabezado de la
                    barra, que es donde se lo busca y donde está en los dos
                    modos. Acá abajo repetía lo mismo dos veces en pantalla. */}
                <h1 className="panel__curso">{titulo}</h1>
                {/* Qué estado muestra y en qué orden se decide está junto a
                    `estadoPulso`, arriba. */}
                <PulsoEnlace estado={estadoPulso} marca={marca} />
              </div>
            </div>

            {!recibido ? (
              <p className="panel__vacio" role="status">
                Todavía no se pudo traer la información del servidor. Se sigue intentando.
              </p>
            ) : nadaQueMostrar ? (
              <section className="espera">
                <div className="espera__senal" aria-hidden="true">
                  <span className="espera__onda" />
                  <span className="espera__onda" />
                  <Broadcast size={30} weight="duotone" />
                </div>

                <div className="espera__texto">
                  {/* El título de la pantalla ya lo pone la cabecera, así que
                      acá va un segundo nivel: dos h1 en la misma página dejan
                      sin saber cuál es el asunto. */}
                  <h2 className="espera__titulo">Escuchando el aula virtual</h2>
                  <p className="espera__bajada">
                    Todavía no hay ningún examen en curso. En cuanto un alumno inicie el intento,
                    la sesión queda registrada sola: no hay que activar nada por examen ni por
                    alumno. Antes de empezar, el alumno lee el aviso de monitoreo.
                  </p>
                </div>
              </section>
            ) : nivel === "cursos" ? (
              <Fichas
                fichas={fichasDeCursos}
                icono={Materia}
                rotulo="Tus cursos"
                onElegir={(curso) => irA({ curso })}
              />
            ) : nivel === "examenes" ? (
              <Fichas
                fichas={fichasDeExamenes}
                icono={Examen}
                rotulo="Exámenes del curso"
                onElegir={(examen) => irA({ curso: cursoElegido, examen })}
              />
            ) : nivel === "eventos" && sesionMostrada ? (
              <DetalleSesion
                key={sesionMostrada.id}
                sesion={sesionMostrada}
                onConsulta={(sigue, fallo) => setRegistro({ sesion: sesionElegida, sigue, fallo })}
                onVencida={vencer}
              />
            ) : sesionesAjenas ? (
              <p className="panel__vacio" role="status">
                Las sesiones de este examen todavía no se pudieron traer. Se sigue intentando.
              </p>
            ) : (
              <>
                {/* El recuento de cada grupo es el del examen, no el de las filas
                    cargadas: con la lista paginada, contar filas daba un número
                    distinto del de la ficha del examen. */}
                <ListaSesiones
                  titulo="En curso"
                  sesiones={enCurso}
                  total={recuento.enCurso}
                  vacio={<p className="panel__vacio">No hay sesiones de examen vigentes.</p>}
                  onVerEventos={verEventos}
                />

                {finalizadas.length > 0 || totalFinalizadas > 0 ? (
                  <ListaSesiones
                    titulo="Finalizadas"
                    sesiones={finalizadas}
                    total={totalFinalizadas}
                    cerradas
                    vacio={<p className="panel__vacio">Se ven con «Ver más sesiones».</p>}
                    onVerEventos={verEventos}
                  />
                ) : null}

                {/* «Ver más» solo si el examen tiene más sesiones de las que se ven, y
                    mientras el backend pueda devolver más (tope por pedido). El total sale
                    de los recuentos del examen, no de si la última página vino llena: eso
                    era una suposición, y con el tope exacto de 1000 dejaba el botón sin
                    traer nada, o lo escondía aunque quedaran sesiones por ver. */}
                {delExamen.length < totalDelExamen && paginas * SESIONES_POR_PAGINA < SESIONES_TOPE ? (
                  <button
                    type="button"
                    className="panel__ver-mas"
                    onClick={pedirOtraPagina}
                  >
                    Ver más sesiones
                  </button>
                ) : null}
                {/* Llegó el tope del backend: no hay forma de traer más desde esta
                    pantalla, y ofrecer un botón que no trae nada es peor que decirlo. */}
                {totalDelExamen > SESIONES_TOPE && delExamen.length >= SESIONES_TOPE ? (
                  <p className="panel__tope" role="status">
                    Se muestran las {SESIONES_TOPE.toLocaleString("es-AR")} sesiones más recientes
                    de {totalDelExamen.toLocaleString("es-AR")}.
                  </p>
                ) : null}
              </>
            )}
          </>
        )}
      </main>

      <Pie ancho="panel">
        <h2 className="pie__titulo">Cómo funciona</h2>
        <ul>
          <li className="pie__rol">
            <span className="pie__cargo">Se registra solo</span>
            El aula virtual avisa en cuanto un alumno abre el examen
          </li>
          <li className="pie__rol">
            <span className="pie__cargo">Sin preparar nada</span>
            No hay que activarlo por examen ni por alumno
          </li>
          <li className="pie__rol">
            <span className="pie__cargo">Sin instalar nada</span>
            El alumno lee un aviso y rinde en el aula virtual de siempre
          </li>
        </ul>
      </Pie>
    </>
  );
}
