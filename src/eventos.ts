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
 * «4 s», «2 min 5 s», «2 h 15 min». Por debajo del segundo no vale la pena el
 * detalle.
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
  if (segundos < 1) return "menos de 1 s";
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) {
    const resto = segundos % 60;
    return resto === 0 ? `${minutos} min` : `${minutos} min ${resto} s`;
  }
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

const TIPOS_DE_PREGUNTA: Record<string, string> = {
  essay: "ensayo",
  multichoice: "opción múltiple",
  truefalse: "verdadero/falso",
  shortanswer: "respuesta corta",
  numerical: "numérica",
  match: "emparejar",
  gapselect: "completar con opciones",
  ddwtos: "arrastrar palabras",
  ddimageortext: "arrastrar sobre imagen",
  ddmarker: "marcar sobre imagen",
  multianswer: "respuesta incrustada",
  calculated: "calculada",
  calculatedmulti: "calculada de opción múltiple",
  calculatedsimple: "calculada simple",
  ordering: "ordenar",
};

/** «pregunta 3 (ensayo)», o lo que se pueda decir si falta alguno de los dos. */
function pregunta(datos: Datos): string {
  const posicion = numero(datos.slot);
  const crudo = typeof datos.qtype === "string" ? datos.qtype : null;
  // Un tipo de pregunta de un plugin de Moodle que este panel no conoce se
  // muestra igual, con los guiones bajos hechos espacios: es un dato del
  // examen y esconderlo sería peor que mostrarlo sin traducir.
  const tipo = crudo === null ? null : (TIPOS_DE_PREGUNTA[crudo] ?? crudo.replace(/_/g, " "));
  // El tipo se muestra aunque no se sepa de qué pregunta es: que falte el
  // número no vuelve inútil al otro dato.
  if (posicion === null) return tipo ? `pregunta de ${tipo}` : "";
  return tipo ? `pregunta ${posicion} (${tipo})` : `pregunta ${posicion}`;
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
 * Cuánto hacía que no se tecleaba en esta misma pregunta.
 *
 * El complemento lo mide entre ventanas, que es justo donde se perdía: la
 * ventana se descarta en cada vaciado y con ella el hueco entre la última tecla
 * de una y la primera de la siguiente.
 */
function desde(datos: Datos): string {
  const ms = numero(datos.gap_before_ms);
  // Por debajo de lo que el propio complemento considera una pausa (dos
  // segundos, `PAUSE_MS` en sig_input.js), el hueco no es un hecho: es que
  // siguió escribiendo y el resumen se cortó en el medio. En pantalla salía
  // «5 teclas, menos de 1 s desde el tecleo anterior», que ocupa medio renglón
  // para decir que no pasó nada.
  const PAUSA = 2000;
  return ms === null || ms < PAUSA ? "" : `${duracion(ms)} desde el tecleo anterior`;
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

/** «paró 3 veces» y, si el evento la trae, cuánto duró la más larga. */
function paradas(pausas: number, datos: Datos): string {
  const veces = `paró ${pausas} ${pausas === 1 ? "vez" : "veces"}`;
  const mayor = numero(datos.max_pause_ms);
  // Dicho entero y no «hasta 9 s»: las partes del detalle van separadas por
  // comas, así que un dato suelto al lado de otro se lee como uno más de la
  // lista y no como la aclaración del anterior.
  return mayor === null || mayor <= 0 ? veces : `${veces}, la más larga de ${duracion(mayor)}`;
}

/**
 * Con qué apunta el equipo del alumno.
 *
 * `is_touch` da verdadero en cualquier notebook con pantalla táctil, así que no
 * distingue una tablet. El puntero principal y si hay alguno fino sí, y son dos
 * campos separados porque una tablet con un mouse conectado tiene los dos.
 *
 * El segundo se calla cuando el primero ya lo dijo: en el equipo más común
 * —puntero principal fino— repetir «tiene mouse o trackpad» es el mismo hecho
 * dos veces, y son cuarenta renglones los que lo pagan.
 */
function punteros(datos: Datos): string[] {
  const grueso = typeof datos.pointer_coarse === "boolean" ? datos.pointer_coarse : null;
  const fino = typeof datos.any_pointer_fine === "boolean" ? datos.any_pointer_fine : null;

  // Un equipo sin pantalla táctil no puede apuntar con el dedo, así que decir
  // además «apunta con mouse o trackpad» es el mismo hecho escrito dos veces,
  // y es el caso de casi todas las sesiones. Con pantalla táctil sí distinguen:
  // ahí el puntero principal es lo que separa una tablet de una notebook.
  if (datos.is_touch === false && grueso !== true) return [];

  // Los dos campos juntos pueden decir cosas que no se sostienen entre sí: un
  // puntero principal que no es grueso, y a la vez ningún puntero fino en todo
  // el equipo. Ahí el par no afirma nada y la frase salía contradiciéndose sola
  // («apunta con mouse o trackpad, sin mouse ni trackpad»). No se elige cuál de
  // los dos creer: no se dice ninguno.
  if (grueso === false && fino === false) return [];

  if (grueso === null) {
    if (fino === null) return [];
    return [fino ? "tiene mouse o trackpad" : "sin mouse ni trackpad"];
  }

  if (!grueso) return ["apunta con mouse o trackpad"];

  // Con el dedo como puntero principal, que además haya uno fino es un dato
  // aparte y no una repetición: es la tablet con un mouse conectado.
  const conDedo = ["apunta con el dedo"];
  return fino === true ? [...conDedo, "tiene mouse o trackpad"] : conDedo;
}

export function describirEvento(evento: Pick<Evento, "type" | "data">): Descripcion {
  const d: Datos = evento.data && typeof evento.data === "object" ? evento.data : {};

  switch (evento.type) {
    case "client_profile": {
      // «Other» no es un navegador: es lo que manda el complemento cuando
      // ninguna de sus cinco expresiones reconoce el user agent. Pasa de
      // verdad, no es teoría: Chrome en iPhone manda CriOS y Firefox en iOS
      // FxiOS, y ninguno matchea. Traducirlo es lo mismo que se hace con el
      // identificador negativo de una sesión que no se pudo descifrar. Que el
      // campo no venga, en cambio, no habilita a decir nada.
      const familia = typeof d.browser_family === "string" ? d.browser_family : "";
      const navegador = familia === "Other" ? "" : familia;
      const version = numero(d.browser_major);
      return {
        icono: Navegador,
        titulo: "Navegador del alumno",
        detalle: unir([
          familia === "Other" && "navegador no identificado",
          navegador && version ? `${navegador} ${version}` : navegador,
          // Las tres ramas a propósito: con una sola comparación, el campo
          // ausente afirmaba que el equipo no tiene pantalla táctil, que es un
          // hecho que el evento no trae.
          d.is_touch === true ? "equipo con pantalla táctil" : d.is_touch === false ? "equipo sin pantalla táctil" : "",
          ...punteros(d),
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
      const pausas = numero(d.pauses) ?? 0;
      // Cada origen con su verbo, en vez de un total y un paréntesis que hay
      // que restar: «120 entradas (1 pegada)» obliga a hacer la cuenta para
      // saber cuánto escribió de verdad, y «entrada» no es una palabra que un
      // docente use. El complemento ya manda `typed`, que es exactamente lo
      // tecleado; si no viene, se cae al total.
      const tecleadas = numero(origen.typed);
      const desglosado = (tecleadas ?? 0) + pegadas + arrastradas + reemplazadas > 0;
      return {
        icono: Teclado,
        titulo: "Tecleo",
        detalle: unir([
          pregunta(d),
          desglosado
            ? unir([
                (tecleadas ?? 0) > 0 && plural(tecleadas ?? 0, "tecla", "teclas"),
                pegadas > 0 && `${plural(pegadas, "pegada", "pegadas")}`,
                arrastradas > 0 && `${plural(arrastradas, "arrastrada", "arrastradas")}`,
                reemplazadas > 0 && `${plural(reemplazadas, "autocompletada", "autocompletadas")}`,
              ])
            : inserciones > 0 && plural(inserciones, "entrada de texto", "entradas de texto"),
          borrados > 0 && plural(borrados, "borrado", "borrados"),
          pausas > 0 && paradas(pausas, d),
          desde(d),
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
      //   antes del tramo. Por eso ahí se escribe «desde hace».
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
      // el motor de análisis. En el tecleo sí se muestra (ver `desde()`)
      // porque ahí es lo único que dice cuánto se dejó de escribir en una
      // pregunta.
      //
      // Y si `moves` no es un número, no se dice «sin movimiento»: eso
      // afirmaría que el alumno no movió el mouse, cuando lo único que pasa es
      // que el dato no sirve.
      const detalle =
        movimientos === null
          ? rato
            ? `${rato} sin mover`
            : ""
          : movimientos === 0
            ? rato
              ? `sin movimiento desde hace ${rato}`
              : "sin movimiento"
            : unir([plural(movimientos, "movimiento", "movimientos"), rato && `${rato} sin mover`]);
      return { icono: Raton, titulo: "Mouse", detalle };
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
      return {
        icono: Cronometro,
        // «A la vista» y no «tiempo en la pregunta», por dos motivos. Uno: el
        // complemento mide cuánto estuvo VISIBLE en pantalla, no cuánto le
        // dedicó el alumno. Dos: el evento sale como mucho cada minuto y ahí
        // reinicia su cuenta, así que cada fila es un tramo y no el total;
        // cuatro filas seguidas de la misma pregunta son cuatro tramos.
        titulo: "Tiempo a la vista",
        detalle: unir([
          pregunta(d),
          // Negativo es imposible y el backend no mira adentro de `data`.
          // `duracion()` lo mostraba como «menos de 1 s», que es afirmar un
          // tiempo que el dato no sostiene; callarlo es más honesto.
          ms === null || ms < 0 ? "" : duracion(ms),
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
      const accion = d.action === "paste" ? "Pegó desde el portapapeles"
        : d.action === "cut" ? "Cortó al portapapeles"
        : d.action === "copy" ? "Copió al portapapeles"
        : "Usó el portapapeles";
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
          largo === null ? "" : plural(largo, "carácter", "caracteres"),
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

    case "resize": {
      const ancho = numero(d.w);
      const alto = numero(d.h);
      // Los píxeles, escritos. «1280 × 720» son dos números sin decir de qué,
      // y la cruz de multiplicar no todos los lectores de pantalla la
      // pronuncian: quedaba «mil doscientos ochenta setecientos veinte».
      //
      // Y si llegó un solo lado se muestra ese: descartar los dos sería
      // esconder un dato que sí está por culpa de otro que falta.
      const medidas =
        ancho !== null && alto !== null
          ? `${ancho} por ${alto} píxeles`
          : ancho !== null
            ? `${ancho} píxeles de ancho`
            : alto !== null
              ? `${alto} píxeles de alto`
              : "";
      // El primero de cada sesión no lo hizo el alumno: es el tamaño con el que arrancó.
      return {
        icono: Marco,
        titulo: d.initial === true ? "Tamaño de la ventana al empezar" : "Cambió el tamaño de la ventana",
        detalle: medidas,
      };
    }

    case "capture_status":
      // Lo genera el servidor de Moodle, no el navegador del alumno: es lo único que puede
      // afirmar que la captura no estuvo.
      return {
        icono: SinNada,
        titulo: "La captura no estuvo activa",
        detalle:
          d.state === "js_disabled"
            ? "una página del examen se cargó con JavaScript desactivado"
            : "una página del examen se cargó y la captura no arrancó",
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
      //   conexión» le atribuiría un corte que el dato no sostiene. Se cuenta
      //   lo que sí se sabe: que los eventos no se pudieron enviar.
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
                ? "Se reanudó el envío"
                : "No se pudieron enviar los eventos"
              : "Conexión";
      // Con el rótulo neutro, el icono tampoco se inclina.
      return {
        icono: titulo === "Conexión" ? Broadcast : volvio ? Wifi : WifiCortado,
        titulo,
        detalle: "",
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
