import type { Evento } from "./services/sesionesService";
import type { Icon } from "./iconos";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Broadcast,
  CornersIn,
  CornersOut,
  Check,
  Cronometro,
  Marco,
  Navegador,
  Ojo,
  OjoTachado,
  Portapapeles,
  Raton,
  SignIn,
  SignOut,
  SinNada,
  NubeCortada,
  Teclado,
  Wifi,
  WifiCortado,
} from "./iconos";

/**
 * Cómo se cuenta cada evento en castellano.
 *
 * El backend devuelve el tipo y un objeto con lo que se guardó, y eso no es
 * para leer. Acá se traduce a una frase corta, y nada más: no se compara con
 * nada, no se pondera y no se califica. Que el examen dejó de ser la ventana
 * activa se cuenta como «Pasó a otra ventana», no como una señal de nada.
 * Interpretarlo es trabajo del motor de análisis, con su explicación y su nivel
 * de riesgo, y mezclarlo acá haría que el docente leyera un juicio en lo que es
 * un registro.
 *
 * La regla: el nombre del tipo se traduce, porque es una etiqueta fija y la
 * misma siempre, y el detalle lleva los valores con su unidad y ninguna frase
 * escrita acá. Los nombres dicen qué pasó, no qué interfaz del navegador lo
 * avisó.
 *
 * No todo campo que llega se muestra. Uno que solo se entiende sabiendo cómo
 * trabaja el complemento no va: la pantalla no escribe el intervalo entre
 * teclas, el largo del tramo que resume cada evento (`window_ms`) ni cómo se
 * detectó el evento (`source`). Cuando mostrar todo
 * choca con que se entienda, gana que se entienda: el panel es para que un
 * docente decida, no para auditar la captura. Esos datos no se pierden, siguen
 * guardados y los lee el motor de análisis. La pregunta antes de agregar un
 * campo al detalle es si un docente que nunca leyó el código lo entiende solo.
 *
 * Lo que no se hace es explicar. Decir que un `visibility_hidden` es «cambió de
 * pestaña o minimizó» sería suponer qué hizo el alumno, y decir que un corte se
 * notó «porque dejaron de llegar los datos» sería el panel contando una
 * historia sobre el mecanismo. Nada de eso está en el evento. Si el docente va
 * a sacar una conclusión, que la saque del dato y no de nuestra redacción.
 *
 * El icono dice de qué clase es el evento, igual que su nombre escrito al lado.
 * Todos son del mismo trazo y del mismo tamaño, y ninguno es de la familia de
 * advertencia: si uno pesara más que otro, la pantalla estaría diciendo cuál
 * mirar primero, que es el juicio que todavía no le toca hacer.
 *
 * Todo lo que llega del navegador del alumno se lee como no confiable: si un
 * campo falta o trae otro tipo, la frase se arma con lo que haya y no se rompe.
 */

export interface Descripcion {
  titulo: string;
  detalle: string;
  icono: Icon;
}

type Datos = Record<string, unknown>;

function numero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function plural(cantidad: number, uno: string, varios: string): string {
  // Con separador de miles: «18400 caracteres» obliga a contar los dígitos, y
  // un pegado largo es justo el caso donde el número importa.
  return `${cantidad.toLocaleString("es-AR")} ${cantidad === 1 ? uno : varios}`;
}

/**
 * «14:05:32». La hora del servidor, al segundo.
 *
 * Los eventos de tecleo y de mouse salen cada cinco segundos, así que sin los
 * segundos media sesión se lee como si hubiera pasado a la misma hora.
 */
export function horaExacta(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** «14:05». Sin segundos, para los extremos de un tramo. */
export function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * «4 segundos», «2 minutos y 5 segundos», «2 horas y 15 minutos». Por debajo
 * del segundo no vale la pena el detalle.
 *
 * Con las unidades escritas enteras: «4 s» y «2 min» son abreviaturas técnicas,
 * y los docentes que revisaron el detalle de la sesión no las leían de corrido.
 *
 * Pasa a horas con el mismo criterio que la columna «Transcurrido». El docente
 * ve las dos en pantallas consecutivas —de la lista de sesiones pasa al
 * registro— y medían distinto: un alumno que deja el
 * mouse quieto una hora y cuarto, o que pasa el examen tapado hora y media,
 * produce filas reales —el complemento repite el aviso de mouse quieto cada
 * minuto y ni `idle_ms` ni `away_ms` tienen tope—, y el registro las escribía
 * como «75 min» y «90 min» al lado de una duración que ya decía «1 h 15 min».
 * Pasada la hora se dejan los segundos: a esa escala no agregan nada.
 */
export function duracion(ms: number): string {
  const segundos = Math.round(ms / 1000);
  if (segundos < 1) return "menos de un segundo";
  if (segundos < 60) return unidad(segundos, "segundo", "segundos");
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) {
    const resto = segundos % 60;
    const enMinutos = unidad(minutos, "minuto", "minutos");
    return resto === 0 ? enMinutos : `${enMinutos} y ${unidad(resto, "segundo", "segundos")}`;
  }
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  const enHoras = unidad(horas, "hora", "horas");
  return resto === 0 ? enHoras : `${enHoras} y ${unidad(resto, "minuto", "minutos")}`;
}

/** «1 segundo», «4 segundos». */
function unidad(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * El tipo de pregunta como lo diría un docente, con su preposición: «de
 * desarrollo» y no «ensayo», que es el nombre del tipo en Moodle.
 */
const TIPOS_DE_PREGUNTA: Record<string, string> = {
  essay: "de desarrollo",
  multichoice: "de opción múltiple",
  truefalse: "de verdadero o falso",
  shortanswer: "de respuesta corta",
  numerical: "numérica",
  match: "de emparejar",
  gapselect: "de completar con opciones",
  ddwtos: "de arrastrar palabras",
  ddimageortext: "de arrastrar sobre una imagen",
  ddmarker: "de marcar sobre una imagen",
  multianswer: "con respuestas incrustadas",
  calculated: "calculada",
  calculatedmulti: "calculada de opción múltiple",
  calculatedsimple: "calculada simple",
  ordering: "de ordenar",
};

/**
 * «pregunta 3», o «pregunta de desarrollo» si falta el número.
 *
 * Sin el tipo cuando se sabe el número: «(de desarrollo)» se repetía en decenas de filas seguidas y los
 * docentes de la ronda 3 lo leían como ruido. El número alcanza para ubicar la pregunta en el examen.
 */
function pregunta(datos: Datos): string {
  const posicion = numero(datos.slot);
  const crudo = typeof datos.qtype === "string" ? datos.qtype : null;
  // Un tipo de pregunta de un plugin de Moodle que este panel no conoce se
  // muestra igual, con los guiones bajos hechos espacios: es un dato del
  // examen y esconderlo sería peor que mostrarlo sin traducir.
  const tipo = crudo === null ? null : (TIPOS_DE_PREGUNTA[crudo] ?? `de tipo ${crudo.replace(/_/g, " ")}`);
  // El tipo se muestra aunque no se sepa de qué pregunta es: que falte el
  // número no vuelve inútil al otro dato.
  if (posicion === null) return tipo ? `pregunta ${tipo}` : "";
  return `pregunta ${posicion}`;
}

/**
 * Las partes de un detalle, separadas por coma.
 *
 * Es una enumeración y se lee como tal. Un separador dibujado en el medio de
 * cada dato compite con el texto: hay que mirarlo para descartarlo, y en una
 * pantalla de cuarenta renglones eso se paga cuarenta veces.
 */
function unir(partes: Array<string | false | null | undefined>): string {
  return partes.filter((p): p is string => Boolean(p)).join(", ");
}

function afuera(datos: Datos): string {
  const ms = numero(datos.away_ms);
  // Un tiempo negativo es imposible y el backend no mira lo que hay adentro de
  // `data`: mostrarlo como «menos de 1 s» sería afirmar algo que el dato no
  // sostiene, y callarlo es más honesto que redondearlo.
  return ms === null || ms < 0 ? "" : `${duracion(ms)} afuera`;
}

/**
 * Cuántas preguntas estaban a la vista al mismo tiempo.
 *
 * Solo se dice cuando fue más de una, porque con una sola el número repite lo
 * que el nombre del evento ya dice.
 */
function juntas(datos: Datos): string {
  const cuantas = numero(datos.visible_count);
  // Sin repetir «preguntas»: el renglón ya arranca con «pregunta 4 (opción
  // múltiple)» y bajo un título que también decía «pregunta a la vista», así
  // que la misma palabra salía tres veces en la misma línea.
  return cuantas === null || cuantas <= 1 ? "" : `${cuantas} en pantalla a la vez`;
}

/**
 * «1 tecla presionada», «31 teclas presionadas». Con el participio: «pregunta 2, 1 tecla» quedaba
 * suelto y los docentes de la ronda 3 no sabían qué contaba.
 */
function teclas(n: number): string {
  return n === 1 ? "1 tecla presionada" : `${n.toLocaleString("es-AR")} teclas presionadas`;
}

/**
 * Desde qué clase de equipo abrió el examen: «una computadora», «un celular o
 * una tableta». Es lo que un docente entiende de los tres campos de punteros;
 * «equipo sin pantalla táctil» o «apunta con mouse o trackpad» eran el dato
 * técnico sin la conclusión obvia.
 *
 * `is_touch` da verdadero en cualquier notebook con pantalla táctil, así que no
 * distingue una tablet. El puntero principal y si hay alguno fino sí, y son dos
 * campos separados porque una tablet con un mouse conectado tiene los dos.
 *
 * El segundo se calla cuando el primero ya lo dijo: en el equipo más común
 * —puntero principal fino— repetir «tiene mouse o trackpad» es el mismo hecho
 * dos veces, y son cuarenta renglones los que lo pagan.
 */
function equipo(datos: Datos): string {
  const grueso = typeof datos.pointer_coarse === "boolean" ? datos.pointer_coarse : null;
  const fino = typeof datos.any_pointer_fine === "boolean" ? datos.any_pointer_fine : null;
  const tactil = typeof datos.is_touch === "boolean" ? datos.is_touch : null;

  // Los dos campos de punteros juntos pueden decir cosas que no se sostienen
  // entre sí: un puntero principal que no es grueso, y a la vez ningún puntero
  // fino en todo el equipo. Ahí no se elige cuál creer: no se dice nada.
  if (grueso === false && fino === false) return "";

  // Con el dedo como puntero principal es un celular o una tableta; que además
  // tenga uno fino es el mouse conectado, un dato aparte.
  if (grueso === true) {
    if (tactil === false) return "";
    return fino === true ? "un celular o una tableta, con mouse o trackpad" : "un celular o una tableta";
  }
  // `is_touch` da verdadero en cualquier notebook con pantalla táctil: con un
  // puntero principal fino, es una computadora.
  if (tactil === true) return grueso === false ? "una computadora con pantalla táctil" : "un equipo con pantalla táctil";
  // Las tres ramas a propósito: con una sola comparación, el campo ausente
  // afirmaba algo que el evento no trae.
  if (tactil === false || grueso === false) return "una computadora";
  return fino === true ? "un equipo con mouse o trackpad" : "";
}

/**
 * El largo de un texto copiado o pegado, en palabras: «unas 50 palabras».
 *
 * «301 caracteres» era justo la palabra que los docentes no entendían, y no les
 * decía cuánto era. Una palabra en castellano son unas seis letras contando el
 * espacio, así que es una cuenta aproximada y lo dice («unas»). No es un umbral:
 * no esconde ni elige nada, cambia la unidad del mismo dato.
 */
function palabras(letras: number): string {
  if (letras <= 0) return "";
  const n = Math.max(1, Math.round(letras / 6));
  return n === 1 ? "alrededor de una palabra" : `unas ${n.toLocaleString("es-AR")} palabras`;
}

/**
 * Lo que una fila sabe de las de al lado. Hoy, solo cuánto estuvo cortada la conexión, para la fila de
 * la vuelta (ver `cortesDeConexion`).
 */
export interface Contexto {
  cortadaMs?: number;
}

/**
 * Cuánto estuvo cortada la conexión, para cada evento de vuelta: `id` de la vuelta → milisegundos.
 *
 * El aviso del corte no puede salir mientras no hay conexión: llega junto con el de la vuelta, en el mismo
 * envío, y en el registro los dos quedaban con la misma hora del servidor. Así, «Se cortó la conexión» y
 * «Volvió la conexión» en el mismo segundo se leían como una falla del sistema (ronda 3). La duración no
 * sale de la hora del servidor, que en este caso mide la cola del navegador: sale de las dos horas del
 * reloj del alumno, que pueden estar corridas pero se corren igual, así que la resta vale. Es la
 * duración de un solo corte, como el tiempo afuera que trae cada vuelta a la ventana, y nunca una suma.
 *
 * Empareja cada vuelta con el corte anterior del mismo origen, en el orden en que se generaron (`seq`).
 * Una vuelta sin corte antes, o con una resta imposible, no lleva duración.
 */
export function cortesDeConexion(eventos: ReadonlyArray<Pick<Evento, "id" | "seq" | "type" | "data" | "occurred_at">>): Map<number, number> {
  const cortes = new Map<number, number>();
  const abiertos = new Map<string, number>();
  const enOrden = eventos.filter((e) => e.type === "connection").sort((a, b) => a.seq - b.seq);
  for (const e of enOrden) {
    const d: Datos = e.data && typeof e.data === "object" ? e.data : {};
    if (typeof d.online !== "boolean" || typeof d.source !== "string") continue;
    const hora = Date.parse(e.occurred_at);
    if (!Number.isFinite(hora)) continue;
    if (!d.online) {
      abiertos.set(d.source, hora);
      continue;
    }
    const desde = abiertos.get(d.source);
    abiertos.delete(d.source);
    if (desde !== undefined && hora >= desde) cortes.set(e.id, hora - desde);
  }
  return cortes;
}

export function describirEvento(evento: Pick<Evento, "type" | "data">, contexto: Contexto = {}): Descripcion {
  const d: Datos = evento.data && typeof evento.data === "object" ? evento.data : {};

  switch (evento.type) {
    case "client_profile": {
      // «Other» no es un navegador: es lo que manda el complemento cuando
      // ninguna de sus cinco expresiones reconoce el user agent. Pasa de
      // verdad, no es teoría: Chrome en iPhone manda CriOS y Firefox en iOS
      // FxiOS, y ninguno matchea. Traducirlo es lo mismo que se hace con el
      // identificador negativo de una sesión que no se pudo descifrar. Que el
      // campo no venga, en cambio, no habilita a decir nada.
      //
      // «Abrió el examen · desde una computadora, con Chrome»: sin la versión
      // del navegador ni «equipo sin pantalla táctil», que son datos técnicos
      // (ronda 2 de los docentes). La versión sigue guardada.
      const familia = typeof d.browser_family === "string" ? d.browser_family : "";
      const desdeDonde = equipo(d);
      return {
        icono: Navegador,
        titulo: "Abrió el examen",
        detalle: unir([
          desdeDonde && `desde ${desdeDonde}`,
          familia === "Other" ? "con un navegador que no se pudo identificar" : familia && `con ${familia}`,
        ]),
      };
    }

    // El complemento avisa lo que tuvo que tirar, para que un hueco en los
    // datos no se lea como que el alumno no hizo nada. Es el único evento que
    // habla del monitoreo y no del examen, y por eso importa que se vea.
    case "events_dropped": {
      // Solo cuántos. Por qué se perdieron (el navegador se quedó sin lugar o
      // el servicio no los aceptó) es información sobre el monitoreo, no
      // sobre el examen, y con esas palabras no se entendía.
      const total =
        numero(d.count) ?? ((numero(d.overflow) ?? 0) + (numero(d.rejected) ?? 0) || null);
      return {
        icono: NubeCortada,
        titulo: "Se perdió parte del registro",
        detalle: total === null ? "" : plural(total, "evento", "eventos"),
      };
    }

    // El registro de que el alumno aceptó el aviso de monitoreo antes de que
    // la captura arrancara. Es lo que pide el criterio 3 de HU11: la
    // aceptación, con su marca temporal. No trae datos: el dato es que pasó,
    // y cuándo.
    case "consent_accepted":
      return { icono: Check, titulo: "Aceptó el aviso de monitoreo", detalle: "" };

    // Los cuatro de acá abajo son dos pares distintos: uno es que el examen
    // dejó de ser la ventana activa, y el otro que dejó de estar visible en la
    // pantalla. El nombre lo dice, así el docente no tiene que conocer la
    // diferencia entre el foco y la visibilidad del navegador.
    case "focus_lost":
      return { icono: SignOut, titulo: "Pasó a otra ventana", detalle: "" };
    case "focus_gained":
      // Mismo criterio que en `mouse_enter`: sin el tiempo afuera no hubo salida
      // previa, y «volvió» afirmaría una ida que no ocurrió.
      return typeof d.away_ms === "number"
        ? { icono: SignIn, titulo: "Volvió a la ventana del examen", detalle: afuera(d) }
        : { icono: SignIn, titulo: "Entró en la ventana del examen", detalle: "" };
    case "visibility_hidden":
      return { icono: OjoTachado, titulo: "El examen dejó de verse en pantalla", detalle: "" };
    case "visibility_visible":
      // Con `reason: unload` el alumno NO volvió a ver nada: el complemento
      // cierra el tramo porque la página se está yendo, y sin esto cada
      // cambio de pregunta salía como una vuelta a la pestaña que nunca
      // ocurrió. El `away_ms` sigue siendo cuánto estuvo oculta.
      return d.reason === "unload"
        ? { icono: SignOut, titulo: "Cambió o cerró la página del examen", detalle: afuera(d) }
        : { icono: Ojo, titulo: "El examen volvió a verse en pantalla", detalle: afuera(d) };

    case "key_activity": {
      const inserciones = numero(d.inserts) ?? 0;
      const borrados = numero(d.deletes) ?? 0;
      const origen = (d.by_origin && typeof d.by_origin === "object" ? d.by_origin : {}) as Datos;
      const pegadas = numero(origen.paste) ?? 0;
      const arrastradas = numero(origen.drop) ?? 0;
      const reemplazadas = numero(origen.replacement) ?? 0;
      // Cada origen con su verbo, en vez de un total y un paréntesis que hay
      // que restar: «120 entradas (1 pegada)» obliga a hacer la cuenta para
      // saber cuánto escribió de verdad, y «entrada» no es una palabra que un
      // docente use. El complemento ya manda `typed`, que es exactamente lo
      // tecleado; si no viene, se cae al total.
      const tecleadas = numero(origen.typed);
      const desglosado = (tecleadas ?? 0) + pegadas + arrastradas + reemplazadas > 0;
      // Lo pegado no se nombra: la fila del pegado, en el mismo segundo, ya lo dice con su largo, y «Escribió ·
      // pegó un texto» al lado de «Pegó un texto» se leía como dos pegados (ronda 3). Si en el tramo solo entró
      // lo pegado, la fila no dice «Escribió», que contradecía a la de al lado: dice que la respuesta cambió.
      //
      // Sin las pausas ni el rato sin escribir de antes («hizo 1 pausa de 3 segundos», «después de 6 segundos
      // sin escribir»): los docentes de la ronda 3 no sabían leer esos números, y para decidir les alcanza con
      // saber en qué pregunta escribió y cuánto. Siguen guardados y los lee el motor de análisis.
      const soloPegado =
        desglosado && pegadas > 0 && (tecleadas ?? 0) === 0 && arrastradas === 0 && reemplazadas === 0 && borrados === 0;
      return {
        icono: Teclado,
        titulo: soloPegado ? "Cambió la respuesta" : "Escribió",
        detalle: unir([
          pregunta(d),
          desglosado
            ? unir([
                (tecleadas ?? 0) > 0 && teclas(tecleadas ?? 0),
                arrastradas > 0 &&
                  (arrastradas === 1 ? "arrastró un texto" : `arrastró ${plural(arrastradas, "texto", "textos")}`),
                reemplazadas > 0 && plural(reemplazadas, "palabra autocompletada", "palabras autocompletadas"),
              ])
            : inserciones > 0 && plural(inserciones, "entrada de texto", "entradas de texto"),
          borrados > 0 && (borrados === 1 ? "borró una vez" : `borró ${borrados.toLocaleString("es-AR")} veces`),
        ]),
      };
    }

    case "mouse_activity": {
      const movimientos = numero(d.moves);
      const quieto = numero(d.idle_ms);
      const rato = quieto !== null && quieto > 0 ? duracion(quieto) : null;

      // Qué es `idle_ms` depende de si hubo movimiento (sig_pointer.js):
      //
      // - Con movimientos, es la pausa más larga DENTRO del tramo que resume el
      //   evento, contando la del final. Nunca es más largo que el tramo.
      // - Sin movimientos (`moves: 0`), es el aviso de que el mouse quedó quieto:
      //   sale una sola vez, al pasar los 15 s que el complemento considera
      //   quietud, y cuenta desde el último movimiento real, que puede ser de
      //   antes del tramo. Se escribe igual, «1 minuto y 16 segundos sin
      //   mover»: «sin movimiento desde hace…» se leía raro en algo que ya pasó.
      //
      // El largo del tramo (`window_ms`) no se muestra: es un dato de cómo
      // resume el complemento, no del examen.
      //
      // El hueco anterior (`gap_before_ms`, el rato quieto desde el último
      // movimiento de un tramo anterior) tampoco se muestra, a propósito. Una
      // quietud larga ya queda marcada en el registro con el aviso «sin
      // movimiento desde hace 15 s», y la fila siguiente del mouse dice cuándo
      // se volvió a mover. Agregar el número daba una tercera cifra de quietud
      // en el mismo renglón que la pausa del tramo, y distinguir una de otra
      // obliga a saber que el complemento resume de a tramos, que es justo lo
      // que se decidió no pedirle al docente. El dato sigue guardado y lo lee
      // el motor de análisis. En el tecleo tampoco se muestra desde la ronda 3.
      //
      // Y si `moves` no es un número, no se dice «sin movimiento»: eso
      // afirmaría que el alumno no movió el mouse, cuando lo único que pasa es
      // que el dato no sirve.
      //
      // Con movimientos, la fila no lleva detalle (ronda 3): «3 movimientos, 4 segundos sin mover» ocupaba media
      // tabla y no le decía nada al docente. Cuántos movimientos hubo y la pausa dentro del tramo siguen
      // guardados. Un rato largo quieto no se pierde: tiene su propia fila, «El mouse quedó quieto», con cuánto.
      if (movimientos === 0) {
        return { icono: Raton, titulo: "El mouse quedó quieto", detalle: rato ?? "" };
      }
      return {
        icono: Raton,
        titulo: "Movimiento del mouse",
        detalle: movimientos === null && rato ? `${rato} sin mover` : "",
      };
    }
    case "mouse_leave":
      return { icono: ArrowUpRight, titulo: "El mouse salió del área del examen", detalle: "" };
    case "mouse_enter":
      // El complemento manda el tiempo afuera en el evento de vuelta, igual que
      // en el foco: así sobrevive aunque el de salida se haya perdido. Que no
      // venga significa que no hubo salida previa (la página cargó con el cursor
      // afuera), y ahí «volvió» mandaría al docente a buscar una salida que no
      // existe, o a suponer que se perdieron eventos.
      return typeof d.away_ms === "number"
        ? { icono: ArrowDownLeft, titulo: "El mouse volvió al área del examen", detalle: afuera(d) }
        : { icono: ArrowDownLeft, titulo: "El mouse entró en el área del examen", detalle: "" };

    case "question_time": {
      const ms = numero(d.ms);
      // Negativo es imposible y el backend no mira adentro de `data`.
      // `duracion()` lo mostraba como «menos de un segundo», que es afirmar un
      // tiempo que el dato no sostiene; callarlo es más honesto.
      const tiempo = ms === null || ms < 0 ? "" : duracion(ms);
      const cual = pregunta(d);
      return {
        icono: Cronometro,
        // «Tiempo en una pregunta» y no «Tiempo a la vista», que no se
        // entendía. El complemento mide cuánto estuvo la pregunta en pantalla,
        // y el evento sale como mucho cada minuto y ahí reinicia su cuenta, así
        // que cada fila es un tramo y no el total: cuatro filas seguidas de la
        // misma pregunta son cuatro tramos.
        titulo: "Tiempo en una pregunta",
        detalle: unir([
          // «sumó 47 segundos en la pregunta 5»: «sumó» dice que es un tramo que se agrega a los anteriores de la
          // misma pregunta y no el total. Con «1 minuto en la pregunta 5» repetido en filas seguidas, los docentes
          // de la ronda 3 no sabían si era un acumulado o un tramo.
          tiempo && cual ? `sumó ${tiempo} en la ${cual}` : tiempo ? `sumó ${tiempo}` : cual,
          // Cuántas preguntas había en pantalla en ese tramo. Con más de una,
          // el mismo segundo se le suma entero a cada una: el número está para
          // que eso se vea, no para que el panel lo reparta por su cuenta.
          juntas(d),
        ]),
      };
    }

    case "clipboard": {
      // Cada verbo lleva su objeto. «Copió» a secas, en un examen, no se lee
      // como el atajo del portapapeles sino como la acusación, y el evento no la
      // sostiene: solo dice que se apretó Ctrl+C, y lo copiado salió de la
      // propia página del examen.
      const verbo = d.action === "paste" ? "Pegó"
        : d.action === "cut" ? "Cortó"
        : d.action === "copy" ? "Copió"
        : "Usó";
      // Sin «portapapeles», que es una palabra técnica: «Pegó un texto». Lo
      // copiado sale de la propia página, y por eso lo dice («del examen»).
      const accion = d.action === "paste" ? "Pegó un texto"
        : d.action === "cut" ? "Cortó un texto"
        : d.action === "copy" ? "Copió un texto del examen"
        : "Copió o pegó un texto";
      const largo = numero(d.length);
      // Pegar un archivo o una imagen no es texto y no tiene largo.
      if (d.non_text === true) {
        return { icono: Portapapeles, titulo: `${verbo} contenido que no es texto`, detalle: pregunta(d) };
      }
      // Solo se sabe cuánto; qué texto era no se guarda, y acá tampoco se pide.
      return {
        icono: Portapapeles,
        titulo: accion,
        detalle: unir([
          pregunta(d),
          largo === null ? "" : palabras(largo),
        ]),
      };
    }

    case "fullscreen": {
      // El nombre depende de `on`, que es lo que dice de qué se trata. Si no
      // llega booleano, el dato no define nada y el rótulo no se inclina: con
      // `d.on === true` un `{}` salía como «Salió de pantalla completa», o sea
      // el panel registrando una salida que nadie capturó.
      const entro = typeof d.on === "boolean" ? d.on : null;
      // El complemento manda si se enteró por la interfaz del navegador o si
      // lo dedujo del tamaño de la ventana (`d.source`). Se guarda, pero no se
      // escribe: es información sobre el monitoreo, no sobre el examen.
      return {
        icono: entro === null ? Marco : entro ? CornersOut : CornersIn,
        titulo:
          entro === null
            ? "Pantalla completa"
            : entro
              ? "Entró en pantalla completa"
              : "Salió de pantalla completa",
        detalle: "",
      };
    }

    case "resize":
      // Sin los píxeles: «1360 por 860 píxeles» es un dato técnico que no le
      // sirve al docente para corregir, y para entenderlo hay que saber el
      // tamaño de la pantalla del alumno, que el evento no trae. Se guardan y
      // los lee el motor de análisis. El primero de cada sesión no lo hizo el
      // alumno: es la ventana con la que arrancó.
      return {
        icono: Marco,
        // «Ventana del examen al empezar» no decía qué se había registrado.
        titulo: d.initial === true ? "Se registró el tamaño de la ventana" : "Cambió el tamaño de la ventana",
        detalle: "",
      };

    case "capture_status":
      // Lo genera el servidor de Moodle, no el navegador del alumno: es lo único que puede
      // afirmar que la captura no estuvo. Sin «captura» ni «JavaScript» en pantalla: el docente
      // lee qué no quedó registrado y por qué, con palabras de todos los días.
      return {
        icono: SinNada,
        titulo: "No se registró lo que hizo en una página",
        detalle:
          d.state === "js_disabled"
            ? "el navegador tenía apagada una opción que hace falta para registrar"
            : "la página se abrió, pero no se empezó a registrar",
      };

    case "connection": {
      // Igual que `fullscreen`: sin el booleano que define el estado, el
      // rótulo del tipo y no el polo negativo. Una caída de conexión que nadie
      // registró, escrita como si fuera registro, es lo peor que puede hacer
      // esta pantalla.
      const volvio = typeof d.online === "boolean" ? d.online : null;
      // El complemento manda este evento desde dos lugares (`source`), y no
      // dicen lo mismo:
      //
      // - `browser`: el navegador del alumno avisó que se quedó sin red o que
      //   la recuperó. Ese sí es la conexión del alumno.
      // - `send`: fallaron varios envíos seguidos, o volvieron a salir. La
      //   falla puede ser del alumno, pero también de Moodle o del servidor de
      //   SAMCE con el alumno conectado, así que escribir «Se perdió la
      //   conexión» le atribuiría un corte que el dato no sostiene. Se dice
      //   «Se cortó la conexión», sin decir de quién: «No se pudieron enviar
      //   los eventos» hablaba del monitoreo y sonaba a falla (ronda 2).
      //
      // El `source` no se escribe: solo elige el
      // nombre. Si no llega, o llega un valor que el complemento no manda, no
      // se sabe cuál de los dos pasó y queda el rótulo neutro del tipo.
      const titulo =
        volvio === null
          ? "Conexión"
          : d.source === "browser"
            ? volvio
              ? "Se recuperó la conexión"
              : "Se perdió la conexión"
            : d.source === "send"
              ? volvio
                ? "Volvió la conexión"
                : "Se cortó la conexión"
              : "Conexión";
      // Con el rótulo neutro, el icono tampoco se inclina. La vuelta dice cuánto duró el corte, si se sabe:
      // «estuvo cortada menos de un segundo».
      const cortada = contexto.cortadaMs;
      return {
        icono: titulo === "Conexión" ? Broadcast : volvio ? Wifi : WifiCortado,
        titulo,
        detalle: volvio === true && cortada !== undefined && cortada >= 0 ? `estuvo cortada ${duracion(cortada)}` : "",
      };
    }

    default:
      // Un tipo que este panel todavía no conoce se muestra tal cual, en vez de
      // esconderlo: es un dato que el docente tiene derecho a ver. Y con los
      // datos crudos al lado, porque no hay forma de saber cuál importa.
      return {
        icono: SinNada,
        titulo: evento.type,
        detalle: Object.keys(d).length ? JSON.stringify(d) : "",
      };
  }
}

// ---- Momentos para revisar (HU05, criterio 3) -----------------------------------------------

/** Un evento crítico de la sesión: el evento al que lleva (su fila en el registro) y cómo se nombra. */
export interface EventoCritico {
  evento: Evento;
  titulo: string;
}

/** Un momento lleva el título de su fila: el mismo hecho se nombra igual en los dos lugares. */
function momento(evento: Evento): EventoCritico {
  return { evento, titulo: describirEvento(evento).titulo };
}

/**
 * Los eventos críticos de una sesión, en el orden del registro, que es el que reciben. Tres tipos fijos
 * (decisión 8 del Sprint 4): los pegados de texto, las salidas de la ventana o de la pestaña, y las salidas
 * de la pantalla completa. Quedan afuera los cortes de conexión, el tecleo, el mouse y los cambios de tamaño.
 *
 * Todo se une por posición en el orden del registro, nunca restando horas: al pasar a otra pestaña el
 * complemento emite una ocultación y una pérdida de foco sin una vuelta entre ellas, y son una sola salida.
 * Esa salida se nombra «El examen dejó de verse en pantalla» y lleva a la fila de la ocultación, llegue
 * primero o segunda: así el momento y su fila dicen lo mismo y llevan el mismo ícono. (La especificación de
 * HU05_T02 hablaba de saltar a la primera de las dos filas; se prefirió que el nombre coincida con la fila.)
 * Una salida de pantalla completa es un `fullscreen` con `on: false` cuyo `fullscreen` anterior no fue
 * también `on: false`.
 *
 * El título de cada momento es siempre el de `describirEvento` del evento que guarda.
 */
export function eventosCriticos(eventos: ReadonlyArray<Evento>): EventoCritico[] {
  const criticos: EventoCritico[] = [];
  // La salida a otra ventana o pestaña que todavía no tuvo su vuelta, para unirle la otra mitad.
  let salidaAbierta: { indice: number; tipo: string } | null = null;
  let ultimoFullscreen: boolean | null = null;

  for (const evento of eventos) {
    const d = (evento.data ?? {}) as Record<string, unknown>;
    switch (evento.type) {
      case "clipboard":
        // El mismo título que la fila del registro: un pegado que no es texto dice «Pegó contenido que no es texto».
        if (d.action === "paste") criticos.push(momento(evento));
        break;
      case "focus_lost":
      case "visibility_hidden": {
        if (salidaAbierta && salidaAbierta.tipo !== evento.type) {
          // La otra mitad de la misma salida: un solo momento, el de la ocultación, que es el que la nombra.
          if (evento.type === "visibility_hidden") criticos[salidaAbierta.indice] = momento(evento);
          salidaAbierta = null;
          break;
        }
        criticos.push(momento(evento));
        salidaAbierta = { indice: criticos.length - 1, tipo: evento.type };
        break;
      }
      case "focus_gained":
      case "visibility_visible":
        salidaAbierta = null;
        break;
      case "fullscreen": {
        if (typeof d.on !== "boolean") break;
        if (d.on === false && ultimoFullscreen !== false) criticos.push(momento(evento));
        ultimoFullscreen = d.on;
        break;
      }
    }
  }
  return criticos;
}
