import type { Evento } from "./services/sesionesService";

/**
 * Cómo se cuenta cada evento en castellano.
 *
 * El backend devuelve el tipo y un objeto con lo que se guardó, y eso no es
 * para leer. Acá se traduce a una frase corta, y nada más: no se compara con
 * nada, no se pondera y no se califica. Una salida de la ventana se cuenta
 * como «Salió de la ventana», no como una señal de nada. Interpretarlo es
 * trabajo del motor de análisis, con su explicación y su nivel de riesgo, y
 * mezclarlo acá haría que el docente leyera un juicio en lo que es un registro.
 *
 * Todo lo que llega del navegador del alumno se lee como no confiable: si un
 * campo falta o trae otro tipo, la frase se arma con lo que haya y no se rompe.
 */

export interface Descripcion {
  titulo: string;
  detalle: string;
}

type Datos = Record<string, unknown>;

function numero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function plural(cantidad: number, uno: string, varios: string): string {
  return `${cantidad} ${cantidad === 1 ? uno : varios}`;
}

/** «4 s», «2 min 5 s». Por debajo del segundo no vale la pena el detalle. */
export function duracion(ms: number): string {
  const segundos = Math.round(ms / 1000);
  if (segundos < 1) return "menos de 1 s";
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return resto === 0 ? `${minutos} min` : `${minutos} min ${resto} s`;
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
  const tipo = typeof datos.qtype === "string" ? (TIPOS_DE_PREGUNTA[datos.qtype] ?? datos.qtype) : null;
  if (posicion === null) return "";
  return tipo ? `pregunta ${posicion} (${tipo})` : `pregunta ${posicion}`;
}

function unir(partes: Array<string | false | null | undefined>): string {
  return partes.filter((p): p is string => Boolean(p)).join(" · ");
}

function afuera(datos: Datos): string {
  const ms = numero(datos.away_ms);
  return ms === null ? "" : `estuvo afuera ${duracion(ms)}`;
}

export function describirEvento(evento: Pick<Evento, "type" | "data">): Descripcion {
  const d: Datos = evento.data && typeof evento.data === "object" ? evento.data : {};

  switch (evento.type) {
    case "client_profile": {
      const navegador = typeof d.browser_family === "string" ? d.browser_family : "Navegador desconocido";
      const version = numero(d.browser_major);
      return {
        titulo: "Navegador del alumno",
        detalle: unir([
          version ? `${navegador} ${version}` : navegador,
          d.is_touch === true ? "pantalla táctil" : "sin pantalla táctil",
        ]),
      };
    }

    case "focus_lost":
      return { titulo: "Salió de la ventana", detalle: "" };
    case "focus_gained":
      return { titulo: "Volvió a la ventana", detalle: afuera(d) };
    case "visibility_hidden":
      return { titulo: "Dejó de ver la pestaña", detalle: "cambió de pestaña o minimizó" };
    case "visibility_visible":
      // "unload" es la pestaña cerrándose de verdad (pasó a otra pregunta,
      // por ejemplo), no un ocultamiento real que volvió: no hay "volvió".
      return d.reason === "unload"
        ? { titulo: "Cambió de página del examen", detalle: afuera(d) }
        : { titulo: "Volvió a ver la pestaña", detalle: afuera(d) };

    case "key_activity": {
      const inserciones = numero(d.inserts) ?? 0;
      const borrados = numero(d.deletes) ?? 0;
      const origen = (d.by_origin && typeof d.by_origin === "object" ? d.by_origin : {}) as Datos;
      const pegadas = numero(origen.paste) ?? 0;
      const arrastradas = numero(origen.drop) ?? 0;
      const reemplazadas = numero(origen.replacement) ?? 0;
      const pausas = numero(d.pauses) ?? 0;
      return {
        titulo: "Tecleo",
        detalle: unir([
          pregunta(d),
          plural(inserciones, "entrada", "entradas"),
          plural(borrados, "borrado", "borrados"),
          pegadas > 0 && `${plural(pegadas, "pegada", "pegadas")}`,
          arrastradas > 0 && `${plural(arrastradas, "arrastrada", "arrastradas")}`,
          reemplazadas > 0 && `${plural(reemplazadas, "autocompletada", "autocompletadas")}`,
          pausas > 0 && plural(pausas, "pausa", "pausas"),
        ]),
      };
    }

    case "mouse_activity": {
      const movimientos = numero(d.moves) ?? 0;
      const quieto = numero(d.idle_ms);
      return {
        titulo: "Mouse",
        detalle:
          movimientos === 0 && quieto !== null
            ? `sin movimiento durante ${duracion(quieto)}`
            : plural(movimientos, "movimiento", "movimientos"),
      };
    }
    case "mouse_leave":
      return { titulo: "El cursor salió de la ventana", detalle: "" };
    case "mouse_enter":
      return { titulo: "El cursor volvió a la ventana", detalle: "" };

    case "question_time": {
      const ms = numero(d.ms);
      return {
        titulo: "Pregunta a la vista",
        detalle: unir([pregunta(d), ms === null ? "" : duracion(ms)]),
      };
    }

    case "clipboard": {
      const accion = d.action === "paste" ? "Pegó" : d.action === "cut" ? "Cortó" : d.action === "copy" ? "Copió" : "Usó el portapapeles";
      const largo = numero(d.length);
      // Pegar un archivo o una imagen no es texto y no tiene largo.
      if (d.non_text === true) {
        return { titulo: `${accion} contenido que no es texto`, detalle: pregunta(d) };
      }
      // Solo se sabe cuánto; qué texto era no se guarda, y acá tampoco se pide.
      return {
        titulo: accion,
        detalle: unir([pregunta(d), largo === null ? "" : plural(largo, "carácter", "caracteres")]),
      };
    }

    case "fullscreen":
      return {
        titulo: d.on === true ? "Entró en pantalla completa" : "Salió de pantalla completa",
        detalle: d.source === "size" ? "detectado por el tamaño de la ventana" : "",
      };

    case "resize": {
      const ancho = numero(d.w);
      const alto = numero(d.h);
      const medidas = ancho !== null && alto !== null ? `${ancho} × ${alto}` : "";
      // El primero de cada sesión no lo hizo el alumno: es el tamaño con el que arrancó.
      return d.initial === true
        ? { titulo: "Tamaño de la ventana al empezar", detalle: medidas }
        : { titulo: "Cambió el tamaño de la ventana", detalle: medidas };
    }

    case "consent_accepted":
      return { titulo: "Aceptó el aviso de monitoreo", detalle: "" };

    case "connection":
      return {
        titulo: d.online === true ? "Se recuperó la conexión" : "Se perdió la conexión",
        // El navegador no siempre avisa que se cortó la red, así que el
        // complemento también lo deduce de los envíos que fallan. Se aclara
        // cuál de las dos fue, porque no dicen lo mismo.
        detalle: d.source === "send" ? "detectado porque fallaron los envíos" : "",
      };

    default:
      // Un tipo que este panel todavía no conoce se muestra tal cual, en vez de
      // esconderlo: es un dato que el docente tiene derecho a ver.
      return { titulo: evento.type, detalle: "" };
  }
}
