import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { enCifras } from "../cifras";
import { claveDelPedido, hayFiltro as hayFiltroEn, leerFiltros } from "../filtrosDeLaDireccion";
import { Broadcast, Examen, Materia } from "../iconos";
import { clearSession, esPanelGeneral, getStoredSession } from "../services/authService";
import {
  CADENCIA_MS,
  SESIONES_POR_PAGINA,
  SESIONES_TOPE,
  type ExamenMonitoreado,
  type SesionDeExamen,
  type SesionNumerada,
  nombreDeAlumno,
} from "../services/sesionesService";
import { Arranque } from "../components/Arranque";
import { BarraPanel } from "../components/BarraPanel";
import { DetalleSesion } from "../components/DetalleSesion";
import { Fichas, type Ficha } from "../components/Fichas";
import { AvisoAlertas } from "../components/AvisoAlertas";
import { AnuncioVivo } from "../components/AnuncioVivo";
import { useAnuncio } from "../components/useAnuncio";
import { FiltrosSesiones, type ControlBusqueda } from "../components/FiltrosSesiones";
import { GruposDeSesiones } from "../components/GruposDeSesiones";
import { ResultadoDelFiltro } from "../components/ResultadoDelFiltro";
import { textoDelResultado } from "../components/textoDelResultado";
import { ResumenEvaluacion } from "../components/ResumenEvaluacion";
import { Migas, type Escalon } from "../components/Migas";
import { PulsoEnlace, type EstadoEnlace } from "../components/PulsoEnlace";
import { Pie } from "../components/Pie";
import { SinSesion } from "./SinSesion";
import { useFiltrosDeLaDireccion } from "./useFiltrosDeLaDireccion";
import { useSesionesDelExamen } from "./useSesionesDelExamen";
import { seSigueConsultando } from "../seguimiento";
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
 * Arriba de la lista, una sola lámina de control: el resumen de la evaluación, la barra de filtros y, con un
 * filtro, «N de M sesiones» y «Quitar filtros». Los filtros viven en la dirección (`filtrosDeLaDireccion.ts`).
 *
 * La columna «Análisis» de la lista dice el nivel de riesgo de cada sesión, con
 * su marca, o el estado de su análisis si no tiene alertas («Sin alertas», «Sin
 * analizar», «No se pudo analizar» o «Análisis no disponible»). Nunca el índice
 * de integridad. Una alerta nueva se anuncia a los lectores de pantalla con una
 * frase corta (`AvisoAlertas`), sin releer la lista.
 */

/**
 * Cada cuánto se pregunta por la lista mientras el docente lee una sesión que ya no se consulta (cerrada hace
 * rato, sin aviso pendiente). De esa sesión no va a cambiar nada, y la lista de atrás no se ve: con la de cinco
 * segundos se descargaba la lista entera doce veces por minuto para nada. Al volver a la lista, se pregunta en
 * el momento y se retoma la de cinco segundos.
 */
const CADENCIA_QUIETA_MS = 30_000;

/**
 * Cuánto espera el anuncio del resultado de una búsqueda a que el docente termine de escribir (ver el efecto
 * del anuncio, en el panel).
 */
const ESPERA_DEL_ANUNCIO_MS = 900;

/** El título del documento fuera de una vista con nombre, el mismo de index.html. */
const TITULO_DEL_PANEL = "SAMCE — Panel Docente";

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

  // Los filtros de la lista (HU04) también viven en la dirección: sobreviven a la actualización
  // automática, al botón Atrás y a la vuelta por las migas, y un enlace copiado abre la misma vista.
  const { filtros, claveFiltros, hayFiltro, aplicarFiltros, quitarFiltros, conservarFiltros } =
    useFiltrosDeLaDireccion();
  // Lo que de verdad se le pide al backend, como texto (ver `claveDelPedido`). Los filtros siguen en la
  // dirección y vuelven al volver a la lista. Como es texto, abrir o cerrar una sesión sin filtros no cambia
  // la consulta y no vuelve a pedir la lista.
  const clavePedido = claveDelPedido(filtros, Boolean(sesionElegida));

  // Cuántas «páginas» de 50 sesiones se pidieron, y de qué examen. Al cambiar
  // de examen (o volver a entrar a uno) vuelve a 1 en el mismo render, con el
  // ajuste de estado durante el render que React admite para esto: hacerlo
  // con un efecto largaba primero una consulta con el número viejo, que se
  // descartaba y se rehacía enseguida.
  // Un cambio de filtro también vuelve a la primera página.
  const vistaDeLista = `${examenElegido}|${claveFiltros}`;
  const [paginasDe, setPaginasDe] = useState({ vista: vistaDeLista, n: 1 });
  if (paginasDe.vista !== vistaDeLista) setPaginasDe({ vista: vistaDeLista, n: 1 });
  const paginas = paginasDe.vista === vistaDeLista ? paginasDe.n : 1;
  const pedirOtraPagina = useCallback(
    () => setPaginasDe({ vista: vistaDeLista, n: paginas + 1 }),
    [vistaDeLista, paginas]
  );
  // Cómo está el registro que se está mirando: si se sigue pidiendo y si la
  // última consulta falló. Lo avisa `DetalleSesion`, que es quien pregunta y
  // decide cuándo deja de hacerlo. Se guarda de qué sesión es, para que al
  // entrar a otra no quede heredado de la anterior.
  const [registro, setRegistro] = useState<{ sesion: string | null; sigue: boolean; fallo: boolean } | null>(
    null
  );
  // Si se está leyendo una sesión que ya no se consulta: la lista se pide más espaciada (`CADENCIA_QUIETA_MS`).
  // Se decide más abajo, con la sesión ya identificada, y se ajusta en el mismo render.
  const [ritmoQuieto, setRitmoQuieto] = useState(false);
  // El ciclo de consultas: los exámenes y las sesiones del examen elegido (`useSesionesDelExamen`).
  const { examenes, cargadas, alDia, enlace, marca, recibido, vencida, vencer } = useSesionesDelExamen(
    examenElegido,
    clavePedido,
    paginas,
    ritmoQuieto ? CADENCIA_QUIETA_MS : CADENCIA_MS
  );
  // Mientras no llegó nada y la primera consulta no falló.
  const cargando = !recibido && enlace === "vivo";

  const general = ingreso ? esPanelGeneral(ingreso) : false;

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
      // Los filtros se conservan mientras no cambie el examen (la miga del examen, la vuelta del
      // detalle, la corrección de la dirección). Otra evaluación abre sin filtros y con el orden
      // predeterminado: la elección no se guarda como preferencia.
      setParametros(conservarFiltros(siguiente), { replace: reemplazar });
    },
    [setParametros, conservarFiltros]
  );

  function salir() {
    clearSession();
    navigate("/", { replace: true });
  }

  // Dónde estaba la página al abrir una sesión desde la lista, para volver al mismo lugar.
  const lugar = useRef<{ sesion: string; y: number } | null>(null);
  // El lugar de la página lo decide el panel (ver el efecto del foco, abajo). Con la restauración del
  // navegador, al volver con Atrás la página llegaba al lugar guardado y un instante después el navegador la
  // corría a la altura que había anotado él, unos píxeles más abajo.
  useEffect(() => {
    const antes = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = antes;
    };
  }, []);

  function verEventos(s: SesionNumerada) {
    lugar.current = { sesion: String(s.id), y: window.scrollY };
    // El estado del registro anterior no vale para este: si quedara, la
    // cabecera mostraría un instante «Intento terminado» de la otra visita.
    setRegistro(null);
    irA({ curso: cursoElegido, examen: examenElegido, sesion: String(s.id) });
  }

  // Estable mientras no cambie la sesión: el detalle no se vuelve a dibujar si no cambió nada (`mismaSesion`).
  const alConsultarElRegistro = useCallback(
    (sigue: boolean, fallo: boolean) => setRegistro({ sesion: sesionElegida, sigue, fallo }),
    [sesionElegida]
  );

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
  // Si el backend ya numeró los intentos (HU04), se usa eso: los cuenta sobre toda la evaluación,
  // antes de filtrar, así una búsqueda que deja el segundo intento lo sigue llamando «2 de 3».
  const delExamen: SesionNumerada[] = delEsteExamen.every((s) => s.attempt_number && s.attempts_total)
    ? delEsteExamen.map((s) => ({ ...s, intento: s.attempt_number!, intentos: s.attempts_total! }))
    : delEsteExamen.length >= totalDelExamen
      ? numerarIntentos(delEsteExamen)
      : delEsteExamen.map((s) => ({ ...s, intento: 1, intentos: 1 }));
  // La lista se dibuja con la vista de la respuesta que se muestra, no con la de la dirección. Entre que el
  // docente toca una tarjeta y llega la respuesta, la lista sigue siendo la anterior entera: sin esto, la
  // tarjeta quedaba marcada sobre las filas sin filtrar, los grupos se armaban como si estuvieran filtradas y
  // «Ver más sesiones» aparecía o desaparecía con un total que no era el de esas filas.
  const claveMostrada = cargadas ? cargadas.vista.slice(cargadas.vista.indexOf("|") + 1) : clavePedido;
  const conFiltroMostrado = hayFiltroEn(leerFiltros(new URLSearchParams(claveMostrada))) && !sesionElegida;
  // Con un filtro, el total que vale es el que dice el backend para el filtro, no el del examen.
  const conFiltro = hayFiltro && !sesionElegida;
  // «N de M» vale solo si la respuesta es del pedido de esta vista. Al volver del detalle (que pide sin
  // filtrar) la última respuesta es de todo el examen, y mostrar su total daba «M de M» hasta la siguiente.
  const respuestaDelFiltro = conFiltro && cargadas?.vista === vistaDeLista && cargadas.total != null;
  const totalDeLaVista = respuestaDelFiltro ? cargadas.total! : totalDelExamen;
  const totalMostrado = conFiltroMostrado && cargadas?.total != null ? cargadas.total : totalDelExamen;
  // M de «N de M sesiones» (D3) sale del resumen de la misma respuesta que N y las siete tarjetas, así los
  // tres números son del mismo momento. Los recuentos de la ficha del examen quedan para un backend sin resumen.
  const totalDeLaEvaluacion = cargadas?.resumen?.total ?? totalDelExamen;
  // «N de M sesiones» se ve siempre al día, pero se anuncia una sola vez por vista y solo cuando la vista
  // vino de una acción del docente (la barra, una tarjeta). Dos referencias, cada una con su caso:
  // - `porAccion` se prende con la acción y se apaga al anunciar: abrir un enlace que ya trae un filtro, o
  //   volver con Atrás o del detalle, llegan sin acción y no se anuncian.
  // - `vistaAnunciada` es la vista de la última respuesta atendida: el refresco de la misma vista (aunque
  //   cambie la cifra) no se vuelve a atender, ni para anunciar ni para vaciar.
  // Una vista nueva sin acción, o la lista sin filtro, vacían la región: si conservara la frase de antes, quien
  // recorre la página con el lector encontraría una cifra que ya no es la de la pantalla. Cada anuncio va en
  // un nodo nuevo, así volver a un filtro con la misma cifra también se lee. Va en un efecto, no en el render.
  //
  // `porAccion` también dice de dónde vino la acción. La búsqueda se pide sola mientras el docente escribe, y
  // cada pausa corta daba un resultado intermedio («3 de 30», «1 de 30») que el lector leía encima del
  // siguiente. Su anuncio espera `ESPERA_DEL_ANUNCIO_MS` y se descarta si antes llega otra vista; el de las
  // tarjetas y los selectores sigue siendo inmediato. Lo que se ve no espera nada.
  const [anuncioFiltro, anunciarFiltro, silenciarFiltro] = useAnuncio();
  const porAccion = useRef<false | "control" | "busqueda">(false);
  const vistaAnunciada = useRef("");
  const anuncioEnEspera = useRef<{ vista: string; temporizador: number } | null>(null);
  const cuantasDelFiltro = respuestaDelFiltro ? cargadas.total! : null;
  useEffect(() => {
    // El anuncio que esperaba es de otra vista: ya no es lo que hay en pantalla.
    if (anuncioEnEspera.current && (!conFiltro || anuncioEnEspera.current.vista !== vistaDeLista)) {
      window.clearTimeout(anuncioEnEspera.current.temporizador);
      anuncioEnEspera.current = null;
    }
    if (!conFiltro) {
      vistaAnunciada.current = "";
      porAccion.current = false;
      silenciarFiltro();
      return;
    }
    if (cuantasDelFiltro === null || vistaAnunciada.current === vistaDeLista) return;
    // La cifra que vino de la memoria de la vista es de antes: se anuncia la de la respuesta nueva.
    if (!alDia) return;
    vistaAnunciada.current = vistaDeLista;
    const origen = porAccion.current;
    if (!origen) {
      silenciarFiltro();
      return;
    }
    porAccion.current = false;
    const texto = textoDelResultado(cuantasDelFiltro, totalDeLaEvaluacion);
    if (origen !== "busqueda") {
      anunciarFiltro(texto);
      return;
    }
    const vista = vistaDeLista;
    anuncioEnEspera.current = {
      vista,
      temporizador: window.setTimeout(() => {
        anuncioEnEspera.current = null;
        anunciarFiltro(texto);
      }, ESPERA_DEL_ANUNCIO_MS),
    };
  }, [conFiltro, cuantasDelFiltro, vistaDeLista, totalDeLaEvaluacion, alDia, anunciarFiltro, silenciarFiltro]);
  useEffect(() => () => window.clearTimeout(anuncioEnEspera.current?.temporizador), []);

  /**
   * Un cambio de filtro del docente: si la dirección cambió, la vista que viene se anuncia. Lo que manda la
   * búsqueda trae solo `q`; las tarjetas, aunque la borren, traen también los demás filtros.
   */
  const filtrar = useCallback(
    (parciales: Parameters<typeof aplicarFiltros>[0]) => {
      const soloBusqueda = Object.keys(parciales).every((clave) => clave === "q");
      if (aplicarFiltros(parciales)) porAccion.current = soloBusqueda ? "busqueda" : "control";
    },
    [aplicarFiltros]
  );

  // «Quitar filtros» desaparece con el renglón de resultado, y el foco quedaba en el cuerpo de la página: se
  // lleva al primer control de la barra, que siempre existe (WCAG 2.4.3).
  const selectorDeNivel = useRef<HTMLSelectElement>(null);
  // Una tarjeta o «Quitar filtros» borran la búsqueda, pero la que el docente estaba tecleando todavía no
  // llegó a la dirección: hay que descartarla, o la espera la suma después y el resultado deja de coincidir
  // con el número de la tarjeta.
  const busqueda = useRef<ControlBusqueda>(null);
  // Si el campo de búsqueda dice algo que la lista todavía no buscó (lo avisa `FiltrosSesiones`).
  const [busquedaEnEspera, setBusquedaEnEspera] = useState(false);
  const filtrarDesdeElResumen = useCallback(
    (parciales: Parameters<typeof aplicarFiltros>[0]) => {
      if ("q" in parciales) busqueda.current?.cancelarBusqueda();
      filtrar(parciales);
    },
    [filtrar]
  );
  const quitar = useCallback(() => {
    busqueda.current?.cancelarBusqueda();
    porAccion.current = false;
    quitarFiltros();
    selectorDeNivel.current?.focus();
  }, [quitarFiltros]);

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
    const quedanMas = cuantasCargadas < totalDeLaVista && paginas * SESIONES_POR_PAGINA < SESIONES_TOPE;
    // La página pedida ya llegó entera: hay que pedir la siguiente.
    const paginaLlegada = cuantasCargadas >= paginas * SESIONES_POR_PAGINA;
    if (quedanMas && paginaLlegada) {
      pedirOtraPagina();
    } else if (!quedanMas && (!recordada || paginas * SESIONES_POR_PAGINA >= SESIONES_TOPE)) {
      irA({ curso: cursoElegido, examen: examenElegido }, true);
    }
  }, [buscandoSesion, cuantasCargadas, totalDeLaVista, paginas, recordada, pedirOtraPagina, irA, cursoElegido, examenElegido]);

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
  const quieto = nivel === "eventos" && sesionMostrada !== undefined && !seSigueConsultando(sesionMostrada);
  if (quieto !== ritmoQuieto) setRitmoQuieto(quieto);

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

  // El título del documento dice la vista, como el h1: con uno solo para todo el panel, el lector de
  // pantalla no anunciaba el paso de la lista al detalle, y las pestañas no se distinguían.
  useEffect(() => {
    document.title = titulo ? `${titulo} — SAMCE` : TITULO_DEL_PANEL;
  }, [titulo]);
  useEffect(() => () => void (document.title = TITULO_DEL_PANEL), []);

  // El foco acompaña el cambio de vista (WCAG 2.4.3): toda vista nueva que viene de una acción del docente
  // (abrir una sesión, tocar una miga, elegir un examen) empieza arriba, con el foco en el h1, así el lector la
  // anuncia y el teclado sigue desde ahí; el botón que la abrió ya no existe y el foco quedaba en el cuerpo de
  // la página. Al volver del detalle a la lista (Atrás, la miga), en cambio, va al «Ver» de la sesión de la
  // que salió, para no perder el lugar en una lista larga; sin ese botón (un filtro la dejó afuera), al h1.
  // Solo en el cambio, nunca en la primera carga ni con el refresco ni al filtrar.
  //
  // La página se sube antes de enfocar: si el docente había bajado por la lista, el primer dibujo del detalle es
  // más corto y el navegador recortaba el desplazamiento en vez de llevarlo a cero; el h1 ya se veía, así que
  // el foco no lo movía, y las migas quedaban debajo de la barra.
  const titular = useRef<HTMLHeadingElement>(null);
  const anterior = useRef<{ clave: string; nivel: string; sesion: string | null } | null>(null);
  const listo = !(cargando || esperandoSesiones) && recibido;
  // La sesión cuenta solo en el detalle: mientras se busca una sesión que no llegó, la vista sigue siendo la
  // lista y no es una vista nueva.
  const claveDeLaVista = [nivel, cursoElegido, examenElegido, nivel === "eventos" ? sesionElegida : ""].join("|");
  // Va antes de pintar (efecto de diseño): con un efecto común, el primer cuadro de la lista se pintaba arriba
  // de todo y recién el siguiente volvía al lugar, y se veía el salto.
  useLayoutEffect(() => {
    if (!listo) return;
    const antes = anterior.current;
    anterior.current = { clave: claveDeLaVista, nivel, sesion: sesionElegida };
    if (!antes || antes.clave === claveDeLaVista) return;
    if (nivel === "sesiones" && antes.nivel === "eventos") {
      const ver = antes.sesion
        ? document.querySelector<HTMLButtonElement>(`button[data-sesion="${CSS.escape(antes.sesion)}"]`)
        : null;
      if (ver) {
        // Vuelve al mismo lugar en que estaba la página al abrir la sesión, de una vez. Antes el foco movía la
        // página hasta el «Ver», y con el desplazamiento suave de la página se la veía deslizarse sola
        // cientos de píxeles. Si se volvió por otro camino (un enlace, la recarga), el «Ver» va al centro.
        if (lugar.current?.sesion === antes.sesion) window.scrollTo({ top: lugar.current.y, behavior: "instant" });
        else {
          const r = ver.getBoundingClientRect();
          window.scrollTo({ top: window.scrollY + r.top + r.height / 2 - window.innerHeight / 2, behavior: "instant" });
        }
        ver.focus({ preventScroll: true });
        lugar.current = null;
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    titular.current?.focus({ preventScroll: true });
  }, [listo, claveDeLaVista, nivel, sesionElegida]);

  // El «Ver» que tenía el foco, para no perderlo con la actualización automática. Cuando una sesión pasa de «En
  // curso» a «Finalizadas» (el alumno entregó), su fila se dibuja de nuevo en la otra tabla, el botón enfocado
  // desaparece y el foco caía al cuerpo de la página: con el teclado o el lector, el docente perdía el lugar sin
  // haber hecho nada. Después de cada dibujo, si eso pasó, el foco va al «Ver» de la misma sesión en su lugar
  // nuevo, sin mover la página.
  //
  // Solo si el botón ya no está en la página: si sigue ahí y el foco está en el cuerpo, fue el docente el que
  // hizo clic en un lugar vacío, y no hay que devolvérselo.
  const verEnfocado = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const ver = verEnfocado.current;
    if (!ver || ver.isConnected || document.activeElement !== document.body) return;
    const nuevo = document.querySelector<HTMLButtonElement>(`button[data-sesion="${CSS.escape(ver.dataset.sesion ?? "")}"]`);
    if (nuevo) nuevo.focus({ preventScroll: true });
    else verEnfocado.current = null;
  });

  // Sin sesión no hay nada que supervisar: se explica y se lo devuelve al
  // campus, igual que a quien llega de un favorito viejo.
  if (vencida) return <SinSesion motivo="vencida" />;

  const enCurso = delExamen.filter((s) => s.status === "open");
  // La lista que se ve no es todavía la de la vista pedida (un filtro recién tocado, la vuelta del detalle).
  // También mientras la búsqueda espera que el docente deje de escribir: el campo ya dice otra cosa.
  const pendiente = nivel === "sesiones" && recibido && !sesionesAjenas && (!alDia || busquedaEnEspera);
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
  // «En vivo» encima del aviso de que no se pudo actualizar. Antes de que el
  // registro avise, se decide con lo que ya se sabe de la sesión: si no, al
  // entrar a una sesión cerrada hace rato decía «En vivo» hasta la primera
  // respuesta, y en un teléfono el pulso que desaparecía subía todo 35 px.
  const delRegistro = nivel === "eventos" && registro?.sesion === sesionElegida ? registro : null;
  const registroQuieto = delRegistro ? !delRegistro.sigue : quieto;
  const estadoPulso: EstadoEnlace =
    enlace !== "vivo"
      ? enlace
      : registroQuieto
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

      <main
        className="marco marco--panel panel"
        id="sesiones"
        onFocus={(e) => {
          const enfocado = e.target as HTMLElement;
          verEnfocado.current = enfocado.dataset.sesion ? enfocado : null;
        }}
      >
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
                {/* tabIndex -1: recibe el foco al abrir una sesión, sin ser una parada del tabulador. */}
                <h1 className="panel__curso" ref={titular} tabIndex={-1}>{titulo}</h1>
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
                onConsulta={alConsultarElRegistro}
                onVencida={vencer}
              />
            ) : sesionesAjenas ? (
              <p className="panel__vacio" role="status">
                Las sesiones de este examen todavía no se pudieron traer. Se sigue intentando.
              </p>
            ) : (
              <>
                {/* La memoria del anuncio se vacía con el examen y con los filtros: una
                    sesión que entra a la lista por un filtro no es una alerta nueva. La clave es
                    la de la respuesta que se está mostrando y no la de la dirección: con la de
                    la dirección, al quitar un filtro se memorizaba la lista vieja con la clave
                    nueva y la respuesta sin filtro anunciaba como nuevas las alertas que el
                    filtro ocultaba (HU04_T02, P14). */}
                <AvisoAlertas sesiones={delExamen} clave={cargadas?.vista ?? ""} />
                {/* Una sola lámina de control: el resumen de la evaluación (con un backend sin el resumen
                    no se dibuja), la barra y el renglón del resultado, que está siempre (vacío sin filtro) para
                    que la lámina mida lo mismo con o sin filtro. Cada tarjeta filtra con la misma función que la
                    barra. */}
                <section className="lamina control" aria-label="Resumen y filtros de la evaluación">
                  {cargadas?.resumen ? (
                    <ResumenEvaluacion resumen={cargadas.resumen} filtros={filtros} onFiltrar={filtrarDesdeElResumen} />
                  ) : null}
                  <FiltrosSesiones
                    filtros={filtros}
                    onCambio={filtrar}
                    nivelRef={selectorDeNivel}
                    controlRef={busqueda}
                    onEspera={setBusquedaEnEspera}
                  />
                  <ResultadoDelFiltro
                    conFiltro={conFiltro}
                    cuantas={cuantasDelFiltro}
                    deCuantas={totalDeLaEvaluacion}
                    onQuitar={quitar}
                  />
                  <AnuncioVivo aviso={anuncioFiltro} etiqueta="Resultado del filtro" />
                </section>

                {/* Los grupos y «Ver más» son de la respuesta que se muestra. Mientras la de la vista pedida
                    no llega, se atenúan y se marcan como ocupados (aria-busy). No van inertes: el foco que
                    estaba en un «Ver» caería al cuerpo de la página, y las filas que se ven son sesiones
                    reales de una misma respuesta. */}
                <div className="panel__listas" aria-busy={pendiente || undefined}>
                  <GruposDeSesiones
                    enCurso={enCurso}
                    finalizadas={finalizadas}
                    conFiltro={conFiltroMostrado}
                    todasCargadas={delExamen.length >= totalMostrado}
                    recuento={{ enCurso: recuento.enCurso, finalizadas: totalFinalizadas }}
                    vista={cargadas?.vista}
                    onVerEventos={verEventos}
                  />

                  {/* «Ver más» solo si el examen tiene más sesiones de las que se ven, y
                      mientras el backend pueda devolver más (tope por pedido). El total sale
                      de los recuentos del examen, no de si la última página vino llena: eso
                      era una suposición, y con el tope exacto de 1000 dejaba el botón sin
                      traer nada, o lo escondía aunque quedaran sesiones por ver. */}
                  {delExamen.length < totalMostrado && paginas * SESIONES_POR_PAGINA < SESIONES_TOPE ? (
                    <button
                      type="button"
                      className="boton-secundario panel__ver-mas"
                      onClick={pedirOtraPagina}
                    >
                      Ver más sesiones
                    </button>
                  ) : null}
                </div>
                {/* Llegó el tope del backend: no hay forma de traer más desde esta
                    pantalla, y ofrecer un botón que no trae nada es peor que decirlo. */}
                {totalDelExamen > SESIONES_TOPE && delExamen.length >= SESIONES_TOPE ? (
                  <p className="panel__tope" role="status">
                    Se muestran las {enCifras(SESIONES_TOPE)} sesiones más recientes
                    de {enCifras(totalDelExamen)}.
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
