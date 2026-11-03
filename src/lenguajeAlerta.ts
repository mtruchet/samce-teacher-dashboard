import { horaCorta } from "./eventos";
import { ordenarExplicacion } from "./explicacion";
import type { AlertaDeSesion } from "./services/sesionesService";

/**
 * Cómo se le cuenta una alerta a un docente (TT_S4_02).
 *
 * El motor escribe la explicación con sus propias palabras («sesiones esperadas», «Proporción
 * del tiempo fuera del examen», «0,61 salidas por minuto»). Son exactas, pero un docente que no
 * sabe nada de estadística las tiene que traducir en la cabeza. Este módulo hace esa traducción
 * con una regla que no se negocia: cada reemplazo se aplica solo si el renglón coincide
 * exactamente con lo que el motor escribe hoy, y si no coincide sale tal cual. Nunca se descarta
 * un renglón ni se cambia una cifra: se escribe el mismo valor de otra forma.
 *
 * El lugar correcto para escribir en lenguaje llano es el motor; cuando lo haga, estos patrones
 * dejan de coincidir y el panel muestra lo que el motor diga, sin tocar nada acá.
 *
 * Todo es puro, sin React, para poder probarlo con las explicaciones reales.
 */

// ---- Orden de las alertas --------------------------------------------------------------------

const PESO: Record<AlertaDeSesion["level"], number> = { low: 1, medium: 2, high: 3 };

/**
 * Las alertas de una sesión, de mayor a menor nivel; si empatan, primero la de la sesión en
 * conjunto. Son a lo sumo dos y de la misma sesión: ordenarlas no compara alumnos. No cambia el
 * arreglo que recibe.
 */
export function ordenarAlertas(alertas: AlertaDeSesion[]): AlertaDeSesion[] {
  return [...alertas].sort(
    (a, b) => PESO[b.level] - PESO[a.level] || Number(a.origin !== "model") - Number(b.origin !== "model")
  );
}

// ---- La hora de la alerta --------------------------------------------------------------------

export interface HoraDeAlerta {
  /** «Apareció a las» o «Con este nivel desde las». */
  texto: string;
  /** La marca de tiempo que se muestra, para el `dateTime`. */
  iso: string;
  /** Hora y minutos, sin segundos. */
  hora: string;
}

/** Por debajo de esto, `level_since` y `created_at` son el mismo momento. */
const MISMO_MOMENTO_MS = 2000;

/**
 * Qué hora mostrar en la cabecera de una alerta.
 *
 * Si el nivel nunca cambió, la alerta «apareció» a esa hora. Si subió, lo que importa es desde
 * cuándo tiene este nivel. Un backend que todavía no mande `level_since` usa la hora de creación.
 */
export function horaDeLaAlerta(alerta: Pick<AlertaDeSesion, "level_since" | "created_at">): HoraDeAlerta {
  const desde = alerta.level_since ?? alerta.created_at;
  const subio = Math.abs(Date.parse(desde) - Date.parse(alerta.created_at)) >= MISMO_MOMENTO_MS;
  return {
    texto: subio ? "Con este nivel desde las" : "Apareció a las",
    iso: desde,
    hora: horaCorta(desde),
  };
}

// ---- Números escritos como los escribe el motor ----------------------------------------------

/** Un número escrito en castellano («1.240», «67,8», «0,2») como número, o null. */
export function numeroDe(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/.test(limpio)) return null;
  return Number(limpio.replace(/\./g, "").replace(",", "."));
}

function escribir(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

// ---- Las frases del motor --------------------------------------------------------------------

const PERCENTIL = /^Menos del ([\d.,]+) % de las sesiones esperadas llega a comportarse así\.$/;
const PEGADO_P99 =
  /^En el 99 % de las sesiones esperadas, ningún pegado sin escritura previa pasó de ([\d.,]+) caracteres\.$/;
const COMBINACION =
  "Ninguna de estas variables se aparta por sí sola de lo esperado, pero la combinación de variables es poco habitual.";

/** «Menos del 0,2 %» como «Menos de 2 de cada 1.000»: la misma cifra, en personas y no en por ciento. */
function deCadaTanto(porcentaje: number): string {
  let cuantos = porcentaje;
  let deCada = 100;
  // Se agranda la base hasta que el número sea entero o al menos 1: 0,2 % es 2 de cada 1.000.
  while ((cuantos < 1 || !Number.isInteger(Math.round(cuantos * 1e6) / 1e6)) && deCada < 1e6) {
    cuantos *= 10;
    deCada *= 10;
  }
  return `${escribir(Math.round(cuantos * 1e6) / 1e6)} de cada ${escribir(deCada)}`;
}

/**
 * Un renglón de la explicación en lenguaje llano.
 *
 * Solo traduce las frases que el motor escribe hoy, si coinciden exactas. Cualquier otro renglón
 * sale igual, salvo la expresión «sesiones esperadas», que se nombra «sesiones habituales»: es la
 * misma referencia, y en pantalla siempre se la llama igual.
 */
export function traducirRenglon(renglon: string): string {
  const percentil = PERCENTIL.exec(renglon);
  if (percentil) {
    const p = numeroDe(percentil[1]);
    if (p !== null && p > 0) return `Menos de ${deCadaTanto(p)} sesiones habituales se comportan así.`;
  }
  const pegado = PEGADO_P99.exec(renglon);
  if (pegado) {
    return `En 99 de cada 100 sesiones habituales, ningún pegado sin nada escrito antes pasó de ${pegado[1]} caracteres.`;
  }
  if (renglon === COMBINACION) {
    return "Ninguna de estas cifras se aparta por sí sola de lo habitual, pero juntas son poco comunes.";
  }
  return renglon.replace(/sesiones esperadas/g, "sesiones habituales");
}

/** Los renglones traducidos, uno por uno: la misma cantidad y en el mismo orden. */
export function frasesTraducidas(renglones: string[]): string[] {
  return renglones.map(traducirRenglon);
}

// ---- Los nombres de las cifras ---------------------------------------------------------------

interface NombreLlano {
  nombre: string;
  /** El artículo que lleva en una frase («sobre todo el tiempo fuera del examen»). Vacío si ya lo trae. */
  articulo: string;
}

/**
 * Los `plain_name` de las variables del motor (`samce-ml-engine/src/motor/variables.py`), con el
 * nombre que se muestra. Se reemplazan los que suenan técnicos —«proporción», «por minuto», «por
 * pregunta», «por hora», «habitual»— y el resto queda como lo escribe el motor. «Habitual» sale
 * porque en la comparación «Una sesión habitual» es la otra sesión, no la de este alumno.
 *
 * Que el nombre pierda «por minuto» no pierde la unidad: el valor la sigue diciendo.
 */
const NOMBRES: Record<string, NombreLlano> = {
  "Salidas a otra aplicación por minuto": { nombre: "Salidas a otra aplicación", articulo: "las" },
  "Salidas a otra pestaña por minuto": { nombre: "Salidas a otra pestaña", articulo: "las" },
  "Proporción del tiempo fuera del examen": { nombre: "Tiempo fuera del examen", articulo: "el" },
  "Salida más larga del examen": { nombre: "Salida más larga del examen", articulo: "la" },
  "Salidas de pantalla completa por minuto": { nombre: "Salidas de pantalla completa", articulo: "las" },
  "Reducciones de la ventana por minuto": { nombre: "Veces que se achicó la ventana", articulo: "las" },
  "Velocidad de tecleo habitual": { nombre: "Velocidad de tecleo sostenida", articulo: "la" },
  "Velocidad de tecleo máxima": { nombre: "Velocidad de tecleo máxima", articulo: "la" },
  "Tecleo más rápido respecto del habitual": { nombre: "Tecleo más rápido frente al ritmo propio", articulo: "el" },
  "Pausas al teclear por minuto": { nombre: "Pausas al teclear", articulo: "las" },
  "Pausa más larga al teclear": { nombre: "Pausa más larga al teclear", articulo: "la" },
  "Proporción de borrado": { nombre: "Parte de lo escrito que se borró", articulo: "la" },
  "Pegados por pregunta": { nombre: "Pegados", articulo: "los" },
  "Pegado más largo": { nombre: "Pegado más largo", articulo: "el" },
  "Lo escrito antes del pegado más largo": { nombre: "Lo escrito antes del pegado más largo", articulo: "" },
  "Proporción de texto pegado": { nombre: "Parte del texto que entró pegado", articulo: "la" },
  "Acciones del portapapeles por minuto": { nombre: "Veces que se copió, cortó o pegó", articulo: "las" },
  "Acciones del portapapeles en el minuto más intenso": {
    nombre: "Veces que se copió, cortó o pegó en el minuto más intenso", articulo: "las",
  },
  "Movimiento del mouse por minuto": { nombre: "Movimiento del mouse", articulo: "el" },
  "Proporción del tiempo con el mouse quieto 15 s o más": {
    nombre: "Tiempo con el mouse quieto 15 s o más", articulo: "el",
  },
  "Mayor tiempo con el mouse quieto": { nombre: "Mayor tiempo con el mouse quieto", articulo: "el" },
  "Tiempo habitual en una pregunta": { nombre: "Tiempo dedicado a cada pregunta", articulo: "el" },
  "Proporción de preguntas dejadas en menos de 5 s": { nombre: "Preguntas dejadas en menos de 5 s", articulo: "las" },
  "Ritmo del final respecto del comienzo": { nombre: "Ritmo del final respecto del comienzo", articulo: "el" },
  "Mayor inactividad": { nombre: "Mayor inactividad", articulo: "la" },
  "Mayor tiempo sin recibir datos del examen": { nombre: "Mayor tiempo sin recibir datos del examen", articulo: "el" },
  "Datos perdidos por cortes largos de conexión, por hora": {
    nombre: "Datos perdidos por cortes largos de conexión", articulo: "los",
  },
  "Cortes de conexión por hora": { nombre: "Cortes de conexión", articulo: "los" },
  "Minutos observados": { nombre: "Minutos observados", articulo: "los" },
  "Eventos válidos": { nombre: "Eventos válidos", articulo: "los" },
  "Eventos excluidos": { nombre: "Eventos excluidos", articulo: "los" },
  "Eventos rechazados por el backend": { nombre: "Eventos rechazados al guardarlos", articulo: "los" },
  "Proporción de eventos excluidos": { nombre: "Parte de los eventos que se descartaron", articulo: "la" },
  "Aviso de captura que no arrancó": { nombre: "Aviso de captura que no arrancó", articulo: "el" },
  "Eventos de actividad": { nombre: "Eventos de actividad", articulo: "los" },
  "Preguntas vistas": { nombre: "Preguntas vistas", articulo: "las" },
};

/** El nombre de una cifra para el docente. Un nombre que no está en la tabla sale como vino. */
export function nombreDeCifra(nombreDelMotor: string): string {
  return NOMBRES[nombreDelMotor]?.nombre ?? nombreDelMotor;
}

/** La cifra dentro de una frase, con su artículo y en minúscula, o null si no se conoce su artículo. */
function cifraEnFrase(nombreDelMotor: string): string | null {
  const llano = NOMBRES[nombreDelMotor];
  if (!llano) return null;
  const nombre = llano.nombre.charAt(0).toLowerCase() + llano.nombre.slice(1);
  return llano.articulo ? `${llano.articulo} ${nombre}` : nombre;
}

// ---- Los valores ------------------------------------------------------------------------------

export interface ValorLegible {
  /** Cómo se escribe en pantalla. */
  texto: string;
  /** El número, para dibujar la barra; null si no se pudo leer. */
  numero: number | null;
}

interface Partido {
  numero: number;
  unidad: string;
}

function partir(valor: string): Partido | null {
  const partes = /^(-?[\d.,]+)\s*(.*)$/.exec(valor.trim());
  if (!partes) return null;
  const numero = numeroDe(partes[1]);
  return numero === null ? null : { numero, unidad: partes[2].trim() };
}

/** 176 → «2 min 56 s», 67,8 → «1 min 8 s», 45 → «45 s». */
function enMinutos(segundos: number): string {
  const total = Math.round(segundos);
  if (total < 60) return `${total} s`;
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  return resto === 0 ? `${minutos} min` : `${minutos} min ${resto} s`;
}

const TASA = /^(.+) por (minuto|pregunta)$/;

function femenino(sustantivo: string): boolean {
  return /as$|ones$/.test(sustantivo);
}

function singular(sustantivo: string): string {
  return sustantivo.replace(/ciones$/, "ción").replace(/s$/, "");
}

/**
 * Una tasa chica, en una base que se imagina: 0,61 salidas por minuto es «unas 6 salidas cada 10
 * minutos». «unas» o «unos» solo si hubo que redondear.
 */
function enCadaDiez(numero: number, sustantivo: string, base: "minuto" | "pregunta"): string {
  const cuantos = numero * 10;
  const redondo = Math.round(cuantos);
  const redondeado = Math.abs(cuantos - redondo) > 1e-9;
  const cada = base === "minuto" ? "cada 10 minutos" : "cada 10 preguntas";
  if (redondo === 0 && redondeado) return `menos de 1 ${singular(sustantivo)} ${cada}`;
  if (redondo === 1) return `${redondeado ? "cerca de " : ""}1 ${singular(sustantivo)} ${cada}`;
  const aprox = redondeado ? (femenino(sustantivo) ? "unas " : "unos ") : "";
  return `${aprox}${escribir(redondo)} ${sustantivo} ${cada}`;
}

/**
 * Los dos lados de una cifra («Esta sesión» y «Una sesión habitual») escritos para el docente.
 *
 * Los dos con la misma regla, para que se sigan pudiendo comparar entre sí. No cambia ningún valor:
 * los segundos pasan a minutos y segundos, y una tasa por minuto o por pregunta con algún lado
 * menor a 1 pasa a «cada 10». Lo demás (porcentajes, caracteres) sale como vino.
 */
export function valorLegible(observado: string, esperado: string): { observado: ValorLegible; esperado: ValorLegible } {
  const a = partir(observado);
  const b = partir(esperado);
  const tal = (texto: string, p: Partido | null): ValorLegible => ({ texto, numero: p ? p.numero : null });

  if (a && b && a.unidad === "segundos" && b.unidad === "segundos") {
    return {
      observado: { texto: enMinutos(a.numero), numero: a.numero },
      esperado: { texto: enMinutos(b.numero), numero: b.numero },
    };
  }
  const tasa = a && b && a.unidad === b.unidad ? TASA.exec(a.unidad) : null;
  if (a && b && tasa && Math.min(a.numero, b.numero) < 1) {
    const base = tasa[2] as "minuto" | "pregunta";
    return {
      observado: { texto: enCadaDiez(a.numero, tasa[1], base), numero: a.numero },
      esperado: { texto: enCadaDiez(b.numero, tasa[1], base), numero: b.numero },
    };
  }
  return { observado: tal(observado, a), esperado: tal(esperado, b) };
}

// ---- La explicación entera, lista para mostrar -----------------------------------------------

export interface CifraLegible {
  /** El nombre como lo escribió el motor, para la clave de la fila. */
  clave: string;
  nombre: string;
  observado: ValorLegible;
  esperado: ValorLegible;
}

export interface ExplicacionLegible {
  titular: string;
  /** Los renglones que aclaran el titular, ya traducidos. */
  contexto: string[];
  /** «Lo que más pesó» como cifras comparables, o vacío. */
  cifras: CifraLegible[];
  /** Si la lista del motor trajo encabezado («Lo que más pesó:»). */
  conEncabezado: boolean;
  /** Las viñetas que no tienen la forma esperada, tal cual (traducidas si corresponde). */
  viñetasSinForma: string[];
  /** Los renglones que siguen a la lista, ya traducidos. */
  despues: string[];
  /** La aclaración final. No se muestra en la tarjeta: se muda a la nota única de arriba. */
  cierre: string | null;
  /** Si la explicación venía en un solo párrafo, sin estructura. */
  sinEstructura: boolean;
}

/** La explicación de una alerta, ordenada (`ordenarExplicacion`) y en lenguaje llano. */
export function explicacionLegible(texto: string): ExplicacionLegible {
  const e = ordenarExplicacion(texto);
  const hayLista = e.variables.length > 0 || e.viñetasSinForma.length > 0;
  return {
    titular: traducirRenglon(e.titular),
    contexto: frasesTraducidas(e.detalle),
    cifras: e.variables.map((v) => ({
      clave: v.etiqueta,
      nombre: nombreDeCifra(v.etiqueta),
      ...valorLegible(v.observado, v.esperado),
    })),
    conEncabezado: e.encabezadoDeLista !== null,
    viñetasSinForma: frasesTraducidas(e.viñetasSinForma),
    despues: frasesTraducidas(e.despues),
    cierre: e.cierre,
    sinEstructura: e.detalle.length === 0 && !hayLista && e.despues.length === 0 && e.cierre === null,
  };
}

// ---- Los motivos del resumen -----------------------------------------------------------------

const PEGADO = /^Se pegó un bloque de ([\d.]+) caracteres/;

/**
 * Por qué apareció una alerta, en una frase corta para el resumen de arriba. No dice el nivel:
 * un nivel en el resumen sería el nivel de la sesión, que es de HU03.
 */
export function motivoDeAlerta(alerta: Pick<AlertaDeSesion, "origin" | "explanation">): string {
  const e = ordenarExplicacion(alerta.explanation);
  if (alerta.origin === "model") {
    const primera = e.variables.length > 0 ? cifraEnFrase(e.variables[0].etiqueta) : null;
    return primera
      ? `Por cómo se desarrolló la sesión en conjunto, sobre todo ${primera}`
      : "Por cómo se desarrolló la sesión en conjunto";
  }
  const pegado = PEGADO.exec(e.titular);
  return pegado ? `Por un texto pegado de ${pegado[1]} caracteres` : "Por un momento puntual de la sesión";
}

/**
 * Lo que hace falta para analizar una sesión sin evidencia suficiente: lo que el motor escribe
 * después de los dos puntos, con mayúscula inicial. Sin dos puntos, el motivo entero.
 */
export function motivoCorto(motivo: string | null): string | null {
  if (!motivo) return null;
  const dosPuntos = motivo.indexOf(":");
  if (dosPuntos === -1) return motivo.trim();
  const resto = motivo.slice(dosPuntos + 1).trim();
  return resto ? resto.charAt(0).toUpperCase() + resto.slice(1) : motivo.trim();
}
