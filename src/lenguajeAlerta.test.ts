import { describe, expect, it } from "vitest";
import { horaCorta } from "./eventos";
import { ordenarExplicacion } from "./explicacion";
import {
  explicacionLegible,
  frasesTraducidas,
  horaDeLaAlerta,
  motivoCorto,
  motivoDeAlerta,
  nombreDeCifra,
  numeroDe,
  ordenarAlertas,
  traducirRenglon,
  valorLegible,
} from "./lenguajeAlerta";
import type { AlertaDeSesion } from "./services/sesionesService";

/*
 * Las explicaciones de las sesiones de referencia, copiadas tal como las guarda la base de la
 * réplica local (`session_alerts.explanation`, cuestionario «Segundo Parcial (réplica del campus)»).
 */
const MODELO_453 = [
  "Esta sesión se aparta levemente de lo habitual.",
  "Menos del 5 % de las sesiones esperadas llega a comportarse así.",
  "Lo que más pesó:",
  "• Pegado más largo: 301 caracteres (lo esperado: 0 caracteres)",
  "• Pegados por pregunta: 0,2 pegados por pregunta (lo esperado: 0 pegados por pregunta)",
  "• Tiempo habitual en una pregunta: 176 segundos (lo esperado: 67,8 segundos)",
  "Esto describe lo observado y no atribuye intención: la revisión es del docente.",
].join("\n");

const EVENTO_453 = [
  "Se pegó un bloque de 301 caracteres en una respuesta en la que no se había escrito nada antes.",
  "En el 99 % de las sesiones esperadas, ningún pegado sin escritura previa pasó de 241 caracteres.",
  "Esto describe lo observado y no atribuye intención: la revisión es del docente.",
].join("\n");

const MODELO_454 = [
  "Esta sesión se aparta mucho de lo habitual.",
  "Menos del 0,2 % de las sesiones esperadas llega a comportarse así.",
  "Lo que más pesó:",
  "• Proporción del tiempo fuera del examen: 28,8 % (lo esperado: 0 %)",
  "• Salidas a otra aplicación por minuto: 0,61 salidas por minuto (lo esperado: 0 salidas por minuto)",
  "• Salida más larga del examen: 45 segundos (lo esperado: 0 segundos)",
  "Esto describe lo observado y no atribuye intención: la revisión es del docente.",
].join("\n");

const REALES = [MODELO_453, EVENTO_453, MODELO_454];

/** Los `plain_name` de `samce-ml-engine/src/motor/variables.py`, copiados tal cual. */
const NOMBRES_DEL_MOTOR = [
  "Salidas a otra aplicación por minuto",
  "Salidas a otra pestaña por minuto",
  "Proporción del tiempo fuera del examen",
  "Salida más larga del examen",
  "Salidas de pantalla completa por minuto",
  "Reducciones de la ventana por minuto",
  "Velocidad de tecleo habitual",
  "Velocidad de tecleo máxima",
  "Tecleo más rápido respecto del habitual",
  "Pausas al teclear por minuto",
  "Pausa más larga al teclear",
  "Proporción de borrado",
  "Pegados por pregunta",
  "Pegado más largo",
  "Lo escrito antes del pegado más largo",
  "Proporción de texto pegado",
  "Acciones del portapapeles por minuto",
  "Acciones del portapapeles en el minuto más intenso",
  "Movimiento del mouse por minuto",
  "Proporción del tiempo con el mouse quieto 15 s o más",
  "Mayor tiempo con el mouse quieto",
  "Tiempo habitual en una pregunta",
  "Proporción de preguntas dejadas en menos de 5 s",
  "Ritmo del final respecto del comienzo",
  "Mayor inactividad",
  "Mayor tiempo sin recibir datos del examen",
  "Datos perdidos por cortes largos de conexión, por hora",
  "Cortes de conexión por hora",
  "Minutos observados",
  "Eventos válidos",
  "Eventos excluidos",
  "Eventos rechazados por el backend",
  "Proporción de eventos excluidos",
  "Aviso de captura que no arrancó",
  "Eventos de actividad",
  "Preguntas vistas",
];

/** Todo lo que la tarjeta de una alerta pone en pantalla, en un solo texto. */
function enPantalla(texto: string): string {
  const e = explicacionLegible(texto);
  return [
    e.titular,
    ...e.contexto,
    ...e.cifras.flatMap((c) => [c.nombre, c.observado.texto, c.esperado.texto]),
    ...e.viñetasSinForma,
    ...e.despues,
  ].join("\n");
}

function alerta(cambios: Partial<AlertaDeSesion>): AlertaDeSesion {
  return {
    origin: "model",
    level: "low",
    explanation: "",
    level_since: "2026-11-03T12:42:50.906Z",
    created_at: "2026-11-03T12:42:50.906Z",
    updated_at: "2026-11-03T12:42:50.906Z",
    ...cambios,
  };
}

describe("traducirRenglon", () => {
  it("pasa los percentiles a «de cada 100» o «de cada 1.000», con la misma cifra", () => {
    expect(traducirRenglon("Menos del 5 % de las sesiones esperadas llega a comportarse así.")).toBe(
      "Menos de 5 de cada 100 sesiones habituales se comportan así."
    );
    expect(traducirRenglon("Menos del 1 % de las sesiones esperadas llega a comportarse así.")).toBe(
      "Menos de 1 de cada 100 sesiones habituales se comportan así."
    );
    expect(traducirRenglon("Menos del 0,2 % de las sesiones esperadas llega a comportarse así.")).toBe(
      "Menos de 2 de cada 1.000 sesiones habituales se comportan así."
    );
  });

  it("traduce el renglón del pegado sin perder el 99 ni el largo", () => {
    expect(
      traducirRenglon("En el 99 % de las sesiones esperadas, ningún pegado sin escritura previa pasó de 241 caracteres.")
    ).toBe("En 99 de cada 100 sesiones habituales, ningún pegado sin nada escrito antes pasó de 241 caracteres.");
  });

  it("traduce el renglón de la combinación", () => {
    expect(
      traducirRenglon(
        "Ninguna de estas variables se aparta por sí sola de lo esperado, pero la combinación de variables es poco habitual."
      )
    ).toBe("Ninguna de estas cifras se aparta por sí sola de lo habitual, pero juntas son poco comunes.");
  });

  it("un renglón que no coincide sale idéntico", () => {
    const otro = "Parte de lo que pesó depende de la conexión o de la captura, que pueden fallar sin que el alumno haga nada distinto.";
    expect(traducirRenglon(otro)).toBe(otro);
    // Casi igual pero no exacto: tampoco se toca (salvo «sesiones esperadas», que se nombra siempre igual).
    expect(traducirRenglon("Menos del 5 % de las sesiones llega a comportarse así.")).toBe(
      "Menos del 5 % de las sesiones llega a comportarse así."
    );
    expect(traducirRenglon("Se parece a menos del 1 % de las sesiones esperadas.")).toBe(
      "Se parece a menos del 1 % de las sesiones habituales."
    );
  });

  it("devuelve la misma cantidad de renglones, en el mismo orden", () => {
    const renglones = MODELO_454.split("\n");
    const traducidos = frasesTraducidas(renglones);
    expect(traducidos).toHaveLength(renglones.length);
    expect(traducidos[0]).toBe(renglones[0]);
    expect(traducidos[3]).toBe(renglones[3]);
  });
});

describe("explicacionLegible", () => {
  it.each(REALES)("no pierde ningún renglón: lo que entra es lo que sale, contando el cierre que se muda (%#)", (texto) => {
    const entrada = ordenarExplicacion(texto);
    const salida = explicacionLegible(texto);
    const cuenta = (e: { detalle?: string[]; contexto?: string[] }) => (e.detalle ?? e.contexto ?? []).length;
    const renglonesDeEntrada = texto.split("\n").length;
    const renglonesDeSalida =
      1 + cuenta(salida) + (salida.conEncabezado ? 1 : 0) + salida.cifras.length + salida.viñetasSinForma.length +
      salida.despues.length + (salida.cierre ? 1 : 0);
    expect(renglonesDeSalida).toBe(renglonesDeEntrada);
    expect(cuenta(entrada)).toBe(cuenta(salida));
    expect(salida.cierre).toBe("Esto describe lo observado y no atribuye intención: la revisión es del docente.");
  });

  it.each(REALES)("con las explicaciones reales no queda ninguna palabra técnica en pantalla (%#)", (texto) => {
    const pantalla = enPantalla(texto);
    expect(pantalla).not.toMatch(/sesiones esperadas|modelo|variable|índice|proporción|mediana|percentil|cálculo/i);
  });

  it("la 454 se lee en lenguaje llano", () => {
    const e = explicacionLegible(MODELO_454);
    expect(e.titular).toBe("Esta sesión se aparta mucho de lo habitual.");
    expect(e.contexto).toEqual(["Menos de 2 de cada 1.000 sesiones habituales se comportan así."]);
    expect(e.cifras.map((c) => [c.nombre, c.observado.texto, c.esperado.texto])).toEqual([
      ["Tiempo fuera del examen", "28,8 %", "0 %"],
      ["Salidas a otra aplicación", "unas 6 salidas cada 10 minutos", "0 salidas cada 10 minutos"],
      ["Salida más larga del examen", "45 s", "0 s"],
    ]);
  });

  it("la 453 se lee en lenguaje llano", () => {
    const e = explicacionLegible(MODELO_453);
    expect(e.cifras.map((c) => [c.nombre, c.observado.texto, c.esperado.texto])).toEqual([
      ["Pegado más largo", "301 caracteres", "0 caracteres"],
      ["Pegados", "2 pegados cada 10 preguntas", "0 pegados cada 10 preguntas"],
      ["Tiempo dedicado a cada pregunta", "2 min 56 s", "1 min 8 s"],
    ]);
    const evento = explicacionLegible(EVENTO_453);
    expect(evento.contexto).toEqual([
      "En 99 de cada 100 sesiones habituales, ningún pegado sin nada escrito antes pasó de 241 caracteres.",
    ]);
  });
});

describe("valorLegible", () => {
  it("los segundos pasan a minutos y segundos desde 60", () => {
    expect(valorLegible("176 segundos", "67,8 segundos")).toEqual({
      observado: { texto: "2 min 56 s", numero: 176 },
      esperado: { texto: "1 min 8 s", numero: 67.8 },
    });
    expect(valorLegible("45 segundos", "0 segundos").observado.texto).toBe("45 s");
    expect(valorLegible("120 segundos", "0 segundos").observado.texto).toBe("2 min");
  });

  it("una tasa chica pasa a «cada 10», con la misma forma en los dos lados", () => {
    const v = valorLegible("0,61 salidas por minuto", "0 salidas por minuto");
    expect(v.observado.texto).toBe("unas 6 salidas cada 10 minutos");
    expect(v.esperado.texto).toBe("0 salidas cada 10 minutos");
    // Sin redondeo no hay «unos».
    expect(valorLegible("0,2 pegados por pregunta", "0 pegados por pregunta").observado.texto).toBe(
      "2 pegados cada 10 preguntas"
    );
    expect(valorLegible("0,23 pegados por pregunta", "0 pegados por pregunta").observado.texto).toBe(
      "unos 2 pegados cada 10 preguntas"
    );
    // Los números no cambian: es otra forma de escribir el mismo valor.
    expect(v.observado.numero).toBe(0.61);
  });

  it("una tasa con los dos lados de 1 o más sale como vino", () => {
    expect(valorLegible("2,5 salidas por minuto", "1,2 salidas por minuto").observado.texto).toBe("2,5 salidas por minuto");
  });

  it("los porcentajes y los caracteres no cambian", () => {
    expect(valorLegible("28,8 %", "0 %")).toEqual({
      observado: { texto: "28,8 %", numero: 28.8 },
      esperado: { texto: "0 %", numero: 0 },
    });
    expect(valorLegible("1.240 caracteres", "0 caracteres").observado).toEqual({ texto: "1.240 caracteres", numero: 1240 });
  });

  it("un valor que no es un número sale tal cual y sin número", () => {
    expect(valorLegible("sin datos", "0 caracteres").observado).toEqual({ texto: "sin datos", numero: null });
  });

  it("lee los números como los escribe el motor", () => {
    expect(numeroDe("1.240")).toBe(1240);
    expect(numeroDe("0,61")).toBe(0.61);
    expect(numeroDe("67,8")).toBe(67.8);
    expect(numeroDe("abc")).toBeNull();
  });
});

describe("nombreDeCifra", () => {
  it("reemplaza los nombres técnicos", () => {
    expect(nombreDeCifra("Proporción del tiempo fuera del examen")).toBe("Tiempo fuera del examen");
    expect(nombreDeCifra("Salidas a otra aplicación por minuto")).toBe("Salidas a otra aplicación");
    expect(nombreDeCifra("Pegados por pregunta")).toBe("Pegados");
    expect(nombreDeCifra("Tiempo habitual en una pregunta")).toBe("Tiempo dedicado a cada pregunta");
  });

  it("un nombre desconocido sale igual", () => {
    expect(nombreDeCifra("Una cifra nueva del motor")).toBe("Una cifra nueva del motor");
  });

  it.each(NOMBRES_DEL_MOTOR)("«%s» no queda con palabras técnicas", (nombre) => {
    expect(nombreDeCifra(nombre)).not.toMatch(/proporción|tasa|mediana|habitual|por minuto|por pregunta|por hora/i);
  });
});

describe("ordenarAlertas", () => {
  it("un momento puntual alto va antes que la sesión en conjunto baja", () => {
    const ordenadas = ordenarAlertas([alerta({ origin: "model", level: "low" }), alerta({ origin: "event", level: "high" })]);
    expect(ordenadas.map((a) => a.origin)).toEqual(["event", "model"]);
  });

  it("con el mismo nivel, primero la sesión en conjunto", () => {
    const ordenadas = ordenarAlertas([alerta({ origin: "event", level: "low" }), alerta({ origin: "model", level: "low" })]);
    expect(ordenadas.map((a) => a.origin)).toEqual(["model", "event"]);
  });

  it("no cambia el arreglo que recibe", () => {
    const original = [alerta({ origin: "model", level: "low" }), alerta({ origin: "event", level: "high" })];
    ordenarAlertas(original);
    expect(original.map((a) => a.origin)).toEqual(["model", "event"]);
  });
});

describe("horaDeLaAlerta", () => {
  it("«Apareció a las» si el nivel no cambió desde que apareció", () => {
    const h = horaDeLaAlerta({ created_at: "2026-11-03T12:36:55.872Z", level_since: "2026-11-03T12:36:56.500Z" });
    expect(h.texto).toBe("Apareció a las");
    expect(h.hora).toBe(horaCorta("2026-11-03T12:36:56.500Z"));
    expect(h.hora).not.toMatch(/:\d\d:\d\d/);
  });

  it("«Con este nivel desde las» si el nivel subió", () => {
    const h = horaDeLaAlerta({ created_at: "2026-11-03T12:36:00.000Z", level_since: "2026-11-03T12:42:00.000Z" });
    expect(h.texto).toBe("Con este nivel desde las");
    expect(h.iso).toBe("2026-11-03T12:42:00.000Z");
  });

  it("sin `level_since` usa la hora de creación", () => {
    const h = horaDeLaAlerta({ created_at: "2026-11-03T12:36:00.000Z", level_since: undefined as unknown as string });
    expect(h.texto).toBe("Apareció a las");
    expect(h.iso).toBe("2026-11-03T12:36:00.000Z");
  });
});

describe("motivoDeAlerta", () => {
  it("la sesión en conjunto nombra la cifra que más pesó, con su artículo", () => {
    expect(motivoDeAlerta({ origin: "model", explanation: MODELO_454 })).toBe(
      "Por cómo se desarrolló la sesión en conjunto, sobre todo el tiempo fuera del examen"
    );
    expect(motivoDeAlerta({ origin: "model", explanation: MODELO_453 })).toBe(
      "Por cómo se desarrolló la sesión en conjunto, sobre todo el pegado más largo"
    );
  });

  it("sin cifras legibles, solo la sesión en conjunto", () => {
    expect(motivoDeAlerta({ origin: "model", explanation: "Esta sesión se aparta de lo habitual." })).toBe(
      "Por cómo se desarrolló la sesión en conjunto"
    );
  });

  it("un pegado dice cuántos caracteres", () => {
    expect(motivoDeAlerta({ origin: "event", explanation: EVENTO_453 })).toBe("Por un texto pegado de 301 caracteres");
    expect(motivoDeAlerta({ origin: "event", explanation: "Se pegó un bloque de 4.370 caracteres." })).toBe(
      "Por un texto pegado de 4.370 caracteres"
    );
  });

  it("otro hecho puntual, sin inventar de qué se trata", () => {
    expect(motivoDeAlerta({ origin: "event", explanation: "Algo puntual." })).toBe("Por un momento puntual de la sesión");
  });

  it("nunca dice el nivel", () => {
    for (const texto of REALES) {
      expect(motivoDeAlerta({ origin: "model", explanation: texto })).not.toMatch(/nivel|bajo|medio|alto/i);
    }
  });
});

describe("motivoCorto", () => {
  it("con dos puntos, lo que sigue con mayúscula inicial", () => {
    expect(
      motivoCorto(
        "Hay muy poca actividad registrada para analizar la sesión: se necesitan al menos 1 minuto observado y 5 eventos de actividad."
      )
    ).toBe("Se necesitan al menos 1 minuto observado y 5 eventos de actividad.");
  });

  it("sin dos puntos, el motivo entero", () => {
    expect(motivoCorto("Hay muy poca actividad registrada.")).toBe("Hay muy poca actividad registrada.");
  });

  it("sin motivo, nada", () => {
    expect(motivoCorto(null)).toBeNull();
  });
});
