import { describe, expect, it } from "vitest";
import { describirEvento, duracion } from "./eventos";

const de = (type: string, data: Record<string, unknown> = {}) => describirEvento({ type, data });

describe("duracion", () => {
  it("cuenta en segundos y en minutos", () => {
    expect(duracion(400)).toBe("menos de 1 s");
    expect(duracion(4000)).toBe("4 s");
    expect(duracion(59_400)).toBe("59 s");
    expect(duracion(60_000)).toBe("1 min");
    expect(duracion(125_000)).toBe("2 min 5 s");
    // Pasada la hora, el mismo formato que la columna «Transcurrido». Llegan
    // valores así: el aviso de mouse quieto se repite cada minuto mientras no
    // se mueva, y ni `idle_ms` ni `away_ms` tienen tope.
    expect(duracion(3_600_000)).toBe("1 h");
    expect(duracion(4_500_000)).toBe("1 h 15 min");
    expect(duracion(7_200_000)).toBe("2 h");
    expect(duracion(9_000_000)).toBe("2 h 30 min");
  });
});

describe("describirEvento", () => {
  it("cuenta el foco y la visibilidad, con cuánto duró la salida", () => {
    expect(de("focus_lost")).toMatchObject({ titulo: "Pasó a otra ventana", detalle: "" });
    expect(de("focus_gained", { away_ms: 4000 })).toMatchObject({ titulo: "Volvió a la ventana del examen", detalle: "4 s afuera" });
    expect(de("visibility_hidden").titulo).toBe("El examen dejó de verse en pantalla");
    expect(de("visibility_visible", { away_ms: 125_000 }).detalle).toBe("2 min 5 s afuera");
  });

  it("cuenta el tecleo con la pregunta y el origen, sin ningún texto", () => {
    const evento = de("key_activity", {
      slot: 3,
      qtype: "essay",
      inserts: 12,
      deletes: 1,
      by_origin: { typed: 9, paste: 2, drop: 0, replacement: 1 },
      pauses: 2,
    });

    expect(evento.titulo).toBe("Tecleo");
    // Cada origen con su verbo: un total con el desglose entre paréntesis
    // obligaba a restar para saber cuánto escribió de verdad.
    expect(evento.detalle).toBe(
      "pregunta 3 (ensayo), 9 teclas, 2 pegadas, 1 autocompletada, 1 borrado, paró 2 veces"
    );
  });

  it("no menciona lo que no pasó", () => {
    // Los borrados se cuentan como las pegadas y las pausas: sólo si los hubo.
    // Un «0 borrados» repetido en las mil quinientas filas de tecleo de una
    // sesión es ruido que hay que leer para descartar.
    const detalle = de("key_activity", { inserts: 1, deletes: 0, by_origin: { paste: 0 }, pauses: 0 }).detalle;

    expect(detalle).toBe("1 entrada de texto");
  });

  // El backend sólo exige que `data` sea un objeto JSON de hasta 2048 bytes:
  // no mira lo que hay adentro. Un valor imposible o de otro tipo llega igual,
  // y presentarlo como si fuera bueno sería afirmar algo que el dato no dice.
  it("calla lo que no puede afirmar, en vez de redondearlo", () => {
    expect(de("focus_gained", { away_ms: -5 }).detalle).toBe("");
    expect(de("visibility_visible", { away_ms: "un rato" }).detalle).toBe("");
    // «Sin movimiento» diría que el alumno no movió el mouse; lo único cierto
    // es que el dato no sirve.
    expect(de("mouse_activity", { moves: "muchos" }).detalle).toBe("");
    expect(de("mouse_activity", { moves: "muchos", idle_ms: 8000 }).detalle).toBe("8 s sin mover");
    expect(de("mouse_activity", {}).detalle).toBe("");
  });

  it("cuenta el pegado solo por su longitud", () => {
    expect(de("clipboard", { action: "paste", length: 340, slot: 1, qtype: "essay" })).toMatchObject({
      titulo: "Pegó desde el portapapeles",
      detalle: "pregunta 1 (ensayo), 340 caracteres",
    });
    expect(de("clipboard", { action: "copy", length: 1 }).detalle).toBe("1 carácter");
    expect(de("clipboard", { action: "cut", length: 5 }).titulo).toBe("Cortó al portapapeles");
  });

  // El complemento cierra el tramo oculto cuando la página se va de verdad
  // (`pagehide`), para no dejar un `visibility_hidden` huérfano en cada cambio
  // de pregunta. Pero ahí el alumno no volvió a ver nada: la página se fue.
  it("con reason unload no dice que volvió, porque no volvió", () => {
    expect(de("visibility_visible", { away_ms: 2000, reason: "unload" })).toMatchObject({
      titulo: "Cambió o cerró la página del examen",
      detalle: "2 s afuera",
    });
    expect(de("visibility_visible", { away_ms: 2000 }).titulo).toBe("El examen volvió a verse en pantalla");
  });

  // El registro de la aceptación del aviso, que es lo que pide HU11. No trae
  // datos: el dato es que pasó, y cuándo.
  it("cuenta la aceptación del aviso de monitoreo", () => {
    expect(de("consent_accepted")).toMatchObject({
      titulo: "Aceptó el aviso de monitoreo",
      detalle: "",
    });
  });

  it("cuenta el mouse: los movimientos y también el rato quieto", () => {
    // El rato más largo sin mover llega en todos los eventos de mouse y antes
    // se descartaba cuando hubo movimientos, que es el caso normal.
    //
    // Y se dice distinto según la rama, porque el complemento mide dos cosas
    // distintas con el mismo campo: con movimientos es el hueco más largo de
    // ese tramo, sin movimientos es cuánto hace que no se mueve, contado desde
    // el último movimiento real y no desde que empezó el tramo.
    expect(de("mouse_activity", { moves: 14, idle_ms: 9000 }).detalle).toBe("14 movimientos, 9 s sin mover");
    expect(de("mouse_activity", { moves: 14, idle_ms: 0 }).detalle).toBe("14 movimientos");
    expect(de("mouse_activity", { moves: 1 }).detalle).toBe("1 movimiento");
    expect(de("mouse_activity", { moves: 0, idle_ms: 20_000 }).detalle).toBe("sin movimiento desde hace 20 s");
    expect(de("mouse_leave").titulo).toBe("El mouse salió del área del examen");
    expect(de("mouse_enter", { away_ms: 9000 }).titulo).toBe("El mouse volvió al área del examen");
  });

  it("cuenta cuánto estuvo a la vista cada pregunta", () => {
    expect(de("question_time", { slot: 2, qtype: "multichoice", ms: 42_000 })).toMatchObject({
      titulo: "Tiempo a la vista",
      detalle: "pregunta 2 (opción múltiple), 42 s",
    });
  });

  // El «cómo se supo» salió de la lista el 24/09/2026: el complemento marca si
  // se enteró por el navegador o si lo dedujo del tamaño de la ventana, y eso
  // es información sobre el monitoreo y no sobre el examen. El campo sigue
  // llegando y guardándose; lo que cambió es que la pantalla no lo escribe.
  it("cuenta la pantalla completa sin explicar cómo se detectó", () => {
    expect(de("fullscreen", { on: true, source: "api" })).toMatchObject({
      titulo: "Entró en pantalla completa",
      detalle: "",
    });
    expect(de("fullscreen", { on: false, source: "size" })).toMatchObject({
      titulo: "Salió de pantalla completa",
      detalle: "",
    });
  });

  it("cuenta el tamaño de la ventana y la conexión", () => {
    // Con la unidad escrita y sin la cruz de multiplicar: «1920 × 1080» son
    // dos números sin decir de qué, y hay lectores de pantalla que se comen el
    // símbolo y leen las dos cifras de corrido.
    expect(de("resize", { w: 1920, h: 1080 }).detalle).toBe("1920 por 1080 píxeles");
    // Un lado solo se muestra igual: que falte uno no vuelve inútil al otro.
    expect(de("resize", { w: 1920 }).detalle).toBe("1920 píxeles de ancho");
    expect(de("resize", { h: 1080 }).detalle).toBe("1080 píxeles de alto");
    expect(de("resize", {}).detalle).toBe("");
    expect(de("connection", { online: false, source: "browser" }).titulo).toBe("Se perdió la conexión");
    expect(de("connection", { online: true, source: "browser" }).titulo).toBe("Se recuperó la conexión");
  });

  // Sin el campo que dice de qué se trata, el nombre no se inclina para
  // ningún lado: el rótulo neutro del tipo, y la fuente que sí llegó. Antes,
  // un evento sin `on` o sin `online` salía como «Salió de pantalla completa»
  // o «Se perdió la conexión»: un hecho que nadie registró, escrito como si
  // lo estuviera. El caso del string "true" es el más filoso, porque el dato
  // dice una cosa y la pantalla escribía la contraria.
  it("sin el campo que define el estado, usa el nombre neutro del tipo", () => {
    expect(de("fullscreen", { source: "api" })).toMatchObject({ titulo: "Pantalla completa", detalle: "" });
    expect(de("fullscreen")).toMatchObject({ titulo: "Pantalla completa", detalle: "" });
    expect(de("fullscreen", { on: "true", source: "api" }).titulo).toBe("Pantalla completa");
    expect(de("connection", { source: "send" })).toMatchObject({ titulo: "Conexión", detalle: "" });
    expect(de("connection")).toMatchObject({ titulo: "Conexión", detalle: "" });
    expect(de("connection", { online: 1, source: "browser" }).titulo).toBe("Conexión");
  });

  // «Other» es el centinela del complemento cuando no reconoce el user agent,
  // no el nombre de un navegador: se traduce, igual que el identificador
  // negativo de una sesión que no se pudo descifrar.
  it("no muestra el centinela del navegador tal cual", () => {
    expect(de("client_profile", { browser_family: "Other", browser_major: 0 }).detalle)
      .toBe("navegador no identificado");
    expect(de("client_profile", { browser_family: "Other", browser_major: 0, is_touch: true }).detalle)
      .toBe("navegador no identificado, equipo con pantalla táctil");
    expect(de("client_profile", { browser_family: "Chrome", browser_major: 153 }).detalle)
      .toBe("Chrome 153");
  });

  // Un evento sin el campo no puede afirmar que el equipo no tiene pantalla
  // táctil: eso lo dice `is_touch: false`, no la ausencia del campo.
  it("no afirma nada sobre la pantalla táctil si el campo no llegó", () => {
    expect(de("client_profile", {}).detalle).toBe("");
    expect(de("client_profile", { browser_family: "Chrome", browser_major: 128, is_touch: false }).detalle)
      .toBe("Chrome 128, equipo sin pantalla táctil");
  });

  // La fuente no se escribe, pero elige el nombre. Con `send` la falla puede
  // ser del servidor con el alumno conectado, así que no se le atribuye a él
  // un corte de conexión: se dice que los eventos no se pudieron enviar. Sin
  // una fuente conocida no se sabe cuál de las dos pasó.
  it("no le atribuye al alumno una falla del envío", () => {
    expect(de("connection", { online: false, source: "send" })).toMatchObject({
      titulo: "No se pudieron enviar los eventos",
      detalle: "",
    });
    expect(de("connection", { online: true, source: "send" })).toMatchObject({
      titulo: "Se reanudó el envío",
      detalle: "",
    });
    expect(de("connection", { online: false, source: "browser" }).detalle).toBe("");
    expect(de("connection", { online: false })).toMatchObject({ titulo: "Conexión", detalle: "" });
    expect(de("connection", { online: true, source: "otra" }).titulo).toBe("Conexión");
  });

  it("cuenta el navegador sin el user agent", () => {
    expect(de("client_profile", { browser_family: "Chrome", browser_major: 126, is_touch: false })).toMatchObject({
      titulo: "Navegador del alumno",
      detalle: "Chrome 126, equipo sin pantalla táctil",
    });
    expect(de("client_profile", { browser_family: "Safari", browser_major: 0, is_touch: true }).detalle).toBe(
      "Safari, equipo con pantalla táctil"
    );
  });

  it("muestra un tipo desconocido tal cual, en vez de esconderlo", () => {
    expect(de("algo_nuevo")).toMatchObject({ titulo: "algo_nuevo", detalle: "" });
    expect(de("algo_nuevo", { lo_que_sea: 7 })).toMatchObject({
      titulo: "algo_nuevo",
      detalle: '{"lo_que_sea":7}',
    });
  });

  it("no se rompe con datos que faltan o vienen con otro tipo", () => {
    expect(() => de("key_activity", { inserts: "muchas", by_origin: null })).not.toThrow();
    expect(() => describirEvento({ type: "resize", data: null as unknown as Record<string, unknown> })).not.toThrow();
    expect(de("focus_gained", { away_ms: "mucho" }).detalle).toBe("");
    expect(de("question_time", { slot: "tres" }).detalle).toBe("");
  });

  it("un tipo de pregunta que no conoce lo muestra como viene", () => {
    expect(de("question_time", { slot: 1, qtype: "stack", ms: 3000 }).detalle).toBe("pregunta 1 (stack), 3 s");
  });

  // El largo del tramo que resume cada evento (`window_ms`) llega y no se
  // muestra: el docente no sabe que el complemento resume de a cinco segundos,
  // así que «1 movimiento en 5 s, hasta 26 s sin mover» son dos números que a
  // la vista no cierran. El dato queda guardado y lo lee el análisis.
  it("no muestra el largo del tramo que resume cada evento", () => {
    expect(de("key_activity", { by_origin: { typed: 38 }, window_ms: 5000 }).detalle)
      .toBe("38 teclas");
    expect(de("mouse_activity", { moves: 12, idle_ms: 0, window_ms: 800 }).detalle)
      .toBe("12 movimientos");
    // El caso que salía sin cerrar: «sin movimiento, 4 min 20 s, en 5 s». El
    // tramo dura 5 s y el rato quieto son 4 minutos, porque se cuenta desde el
    // último movimiento y no desde que empezó el tramo.
    expect(de("mouse_activity", { moves: 0, idle_ms: 260_000, window_ms: 5000 }).detalle)
      .toBe("sin movimiento desde hace 4 min 20 s");
  });

  it("cuenta cuánto hacía que no se tecleaba en esa pregunta", () => {
    // Por debajo de dos segundos no se dice: es que siguió escribiendo y el
    // resumen se cortó en el medio, no un hueco que el docente tenga que ver.
    expect(de("key_activity", { by_origin: { typed: 5 }, gap_before_ms: 800 }).detalle)
      .toBe("5 teclas");
    expect(de("key_activity", { slot: 2, by_origin: { typed: 4 }, gap_before_ms: 47_000 }).detalle)
      .toBe("pregunta 2, 4 teclas, 47 s desde el tecleo anterior");
  });

  it("cuenta cuánto duró la pausa más larga, además de cuántas hubo", () => {
    expect(de("key_activity", { by_origin: { typed: 9 }, pauses: 3, max_pause_ms: 12_000 }).detalle)
      .toBe("9 teclas, paró 3 veces, la más larga de 12 s");
    // Sin el campo, sigue diciendo sólo cuántas: inventar un «hasta 0 s» sería
    // afirmar una duración que el evento no trae.
    expect(de("key_activity", { by_origin: { typed: 9 }, pauses: 3 }).detalle)
      .toBe("9 teclas, paró 3 veces");
  });

  it("cuenta cuántas preguntas había a la vista, sólo cuando fue más de una", () => {
    expect(de("question_time", { slot: 1, ms: 45_000, visible_count: 4 }).detalle)
      .toBe("pregunta 1, 45 s, 4 en pantalla a la vez");
    expect(de("question_time", { slot: 1, ms: 45_000, visible_count: 1 }).detalle)
      .toBe("pregunta 1, 45 s");
  });

  it("cuenta el tiempo que el puntero estuvo fuera de la página", () => {
    expect(de("mouse_enter", { away_ms: 9000 }).detalle).toBe("9 s afuera");
    expect(de("mouse_enter").detalle).toBe("");
  });

  // Sin el tiempo afuera no hubo salida previa: la página cargó con el cursor o
  // el foco afuera. Decir «volvió» mandaba al docente a buscar una ida que nunca
  // ocurrió, o a suponer que se habían perdido eventos.
  it("sin una salida previa dice que entró, no que volvió", () => {
    expect(de("mouse_enter").titulo).toBe("El mouse entró en el área del examen");
    expect(de("focus_gained").titulo).toBe("Entró en la ventana del examen");
    expect(de("mouse_enter", { away_ms: 9000 }).titulo).toBe("El mouse volvió al área del examen");
    expect(de("focus_gained", { away_ms: 4000 }).titulo).toBe("Volvió a la ventana del examen");
  });

  it("cuenta con qué apunta el equipo, sin repetir el mismo hecho dos veces", () => {
    // El equipo más común: puntero principal fino. «tiene mouse o trackpad»
    // sería el mismo dato otra vez, y son cuarenta renglones los que lo pagan.
    expect(de("client_profile", { pointer_coarse: false, any_pointer_fine: true }).detalle)
      .toBe("apunta con mouse o trackpad");
    // Una tablet con un mouse conectado: los dos campos dicen cosas distintas.
    expect(de("client_profile", { pointer_coarse: true, any_pointer_fine: true }).detalle)
      .toBe("apunta con el dedo, tiene mouse o trackpad");
  });

  // El único evento que habla del monitoreo y no del examen. Sin él, un hueco
  // en el registro se lee como que el alumno no hizo nada.
  it("cuenta los eventos que el complemento tuvo que descartar", () => {
    // Solo cuántos: el porqué es información sobre el monitoreo.
    expect(de("events_dropped", { count: 7, overflow: 5, rejected: 2 }).detalle).toBe("7 eventos");
    expect(de("events_dropped", { overflow: 5 }).detalle).toBe("5 eventos");
    expect(de("events_dropped", { count: 7 }).titulo).toBe("Se perdió parte del registro");
  });

  // Con `unload` el tramo menor a un segundo también se cuenta: el mismo
  // evento sale al entregar y al cerrar la pestaña, y adónde fue el alumno es
  // justo lo que el dato no dice.
  it("con reason unload y menos de un segundo afuera lo dice así", () => {
    expect(de("visibility_visible", { away_ms: 400, reason: "unload" }).detalle).toBe("menos de 1 s afuera");
  });

  // El intervalo entre teclas dejó de mostrarse el 24/09/2026: en pantalla
  // («140 ms entre teclas, de 137 a 143») no se entendía y no es algo que el
  // docente use para decidir. Se sigue guardando, y es el motor de análisis
  // el que lo lee.
  it("no muestra el intervalo entre teclas", () => {
    const detalle = de("key_activity", {
      by_origin: { typed: 36 }, interval_ms: { min: 137, median: 140, max: 143 },
    }).detalle;

    expect(detalle).toBe("36 teclas");
    expect(detalle).not.toMatch(/ms/);
  });

  // El panel registra, no juzga: ninguna frase califica lo que el alumno hizo.
  //
  // La lista cubre las dieciocho ramas de `describirEvento`, no solo las que
  // parecen delicadas: antes miraba siete, y el caso más frecuente del
  // portapapeles —«Copió» a secas, que en un examen se lee como la acusación y
  // no como el atajo— quedaba justo afuera. El vocabulario es el mismo que usa
  // CP13 sobre la pantalla entera, para que la suite no deje pasar lo que el
  // caso formal frena.
  it("ninguna frase juzga al alumno", () => {
    const todos = [
      de("focus_lost"), de("focus_gained"), de("focus_gained", { away_ms: 4000 }),
      de("visibility_hidden"), de("visibility_visible", { away_ms: 3000 }),
      de("visibility_visible", { reason: "unload" }),
      de("clipboard", { action: "paste", length: 900 }), de("clipboard", { action: "copy", length: 27 }),
      de("clipboard", { action: "cut", length: 27 }), de("clipboard", { action: "copy", non_text: true }),
      de("mouse_leave"), de("mouse_enter"), de("mouse_enter", { away_ms: 9000 }),
      de("mouse_activity", { moves: 0, idle_ms: 260_000 }),
      de("key_activity", { by_origin: { typed: 38, pasted: 2 } }),
      de("question_time", { slot: 1, qtype: "essay", ms: 47_000 }),
      de("fullscreen", { on: false }), de("fullscreen", { on: true }),
      de("connection", { online: false, source: "browser" }), de("connection", { online: false, source: "send" }),
      de("connection", { online: true }),
      de("resize", { w: 900, h: 700 }), de("resize", { w: 1280, h: 720, initial: true }),
      de("client_profile", { pointer: "mouse" }), de("events_dropped", { count: 3 }),
      de("capture_status", { state: "js_disabled" }), de("capture_status", { state: "no_start" }),
      de("consent_accepted"), de("un_tipo_que_no_existe" as never, { algo: 1 }),
    ];

    const juzga = /sospech|irregular|riesgo|integridad|alerta|puntaje|copi[oó] de|trampa|fraude/i;
    todos.forEach((e) => expect(`${e.titulo} ${e.detalle}`).not.toMatch(juzga));
  });

  it("el tamaño inicial de la ventana no se lee como una acción del alumno", () => {
    expect(de("resize", { w: 1280, h: 720, initial: true })).toMatchObject({ titulo: "Tamaño de la ventana al empezar", detalle: "1280 por 720 píxeles" });
    expect(de("resize", { w: 900, h: 700 }).titulo).toBe("Cambió el tamaño de la ventana");
  });

  it("pegar un archivo o una imagen no dice cero caracteres", () => {
    const r = de("clipboard", { action: "paste", non_text: true, slot: 2, qtype: "essay" });
    expect(r.titulo).toBe("Pegó contenido que no es texto");
    expect(r.detalle).not.toMatch(/carácter/);
  });

  it("el aviso del servidor de que la captura no estuvo se explica según el motivo", () => {
    expect(de("capture_status", { state: "js_disabled" })).toMatchObject({
      titulo: "La captura no estuvo activa",
      detalle: "una página del examen se cargó con JavaScript desactivado",
    });
    expect(de("capture_status", { state: "no_start" }).detalle).toContain("la captura no arrancó");
  });
});
