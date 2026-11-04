import { describe, expect, it } from "vitest";
import { cortesDeConexion, describirEvento, duracion } from "./eventos";

const de = (type: string, data: Record<string, unknown> = {}) => describirEvento({ type, data });

describe("duracion", () => {
  it("cuenta en segundos y en minutos, con las unidades escritas enteras", () => {
    expect(duracion(400)).toBe("menos de un segundo");
    expect(duracion(1000)).toBe("1 segundo");
    expect(duracion(4000)).toBe("4 segundos");
    expect(duracion(59_400)).toBe("59 segundos");
    expect(duracion(60_000)).toBe("1 minuto");
    expect(duracion(61_000)).toBe("1 minuto y 1 segundo");
    expect(duracion(125_000)).toBe("2 minutos y 5 segundos");
    // Pasada la hora se dejan los segundos, como en la columna «Transcurrido».
    // Llegan valores así: el aviso de mouse quieto se repite cada minuto
    // mientras no se mueva, y ni `idle_ms` ni `away_ms` tienen tope.
    expect(duracion(3_600_000)).toBe("1 hora");
    expect(duracion(4_500_000)).toBe("1 hora y 15 minutos");
    expect(duracion(7_200_000)).toBe("2 horas");
    expect(duracion(9_000_000)).toBe("2 horas y 30 minutos");
  });

  it("nunca abrevia las unidades", () => {
    for (const ms of [400, 4000, 60_000, 125_000, 4_500_000]) {
      expect(duracion(ms)).not.toMatch(/\b(s|min|h)\b/);
    }
  });
});

describe("describirEvento", () => {
  it("cuenta el foco y la visibilidad, con cuánto duró la salida", () => {
    expect(de("focus_lost")).toMatchObject({ titulo: "Pasó a otra ventana", detalle: "" });
    expect(de("focus_gained", { away_ms: 4000 })).toMatchObject({ titulo: "Volvió a la ventana del examen", detalle: "4 segundos afuera" });
    expect(de("visibility_hidden").titulo).toBe("El examen dejó de verse en pantalla");
    expect(de("visibility_visible", { away_ms: 125_000 }).detalle).toBe("2 minutos y 5 segundos afuera");
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

    expect(evento.titulo).toBe("Escribió");
    // Cada origen con su verbo: un total con el desglose entre paréntesis
    // obligaba a restar para saber cuánto escribió de verdad. Sin el tipo de
    // pregunta, sin lo pegado (lo dice su propia fila) y sin las pausas (ronda 3).
    expect(evento.detalle).toBe("pregunta 3, 9 teclas presionadas, 1 palabra autocompletada, borró una vez");
    expect(de("key_activity", { by_origin: { typed: 31 }, deletes: 2 }).detalle).toBe("31 teclas presionadas, borró 2 veces");
  });

  it("lo pegado no se repite en la fila del tecleo, y si solo entró lo pegado no dice «Escribió» (453)", () => {
    // Ronda 3: a las 09:35:08 de la 453 estaban «Escribió · pregunta 3 (de desarrollo), pegó un texto» y
    // «Pegó un texto · pregunta 3 (de desarrollo), unas 50 palabras», y se leían como dos pegados.
    const fila = de("key_activity", { slot: 3, qtype: "essay", inserts: 1, by_origin: { typed: 0, paste: 1 } });
    expect(fila).toMatchObject({ titulo: "Cambió la respuesta", detalle: "pregunta 3" });
    expect(fila.detalle).not.toMatch(/peg/);
    // Con teclas además de lo pegado, sigue siendo «Escribió», con las teclas.
    expect(de("key_activity", { slot: 3, by_origin: { typed: 4, paste: 1 } })).toMatchObject({
      titulo: "Escribió",
      detalle: "pregunta 3, 4 teclas presionadas",
    });
    expect(de("key_activity", { by_origin: { drop: 1 } }).detalle).toBe("arrastró un texto");
    expect(de("key_activity", { by_origin: { drop: 3 } }).detalle).toBe("arrastró 3 textos");
  });

  it("no menciona lo que no pasó", () => {
    // Los borrados se cuentan como lo arrastrado: sólo si los hubo.
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
    expect(de("mouse_activity", { moves: "muchos", idle_ms: 8000 }).detalle).toBe("8 segundos sin mover");
    expect(de("mouse_activity", { moves: "muchos" }).titulo).toBe("Movimiento del mouse");
    expect(de("mouse_activity", {}).detalle).toBe("");
  });

  it("cuenta el pegado solo por su largo, en palabras y sin «portapapeles» ni «caracteres»", () => {
    // La 453: 301 letras son unas 50 palabras.
    expect(de("clipboard", { action: "paste", length: 301, slot: 3, qtype: "essay" })).toMatchObject({
      titulo: "Pegó un texto",
      detalle: "pregunta 3, unas 50 palabras",
    });
    expect(de("clipboard", { action: "paste", length: 340, slot: 1, qtype: "essay" }).detalle)
      .toBe("pregunta 1, unas 57 palabras");
    expect(de("clipboard", { action: "paste", length: 18_400 }).detalle).toBe("unas 3.067 palabras");
    expect(de("clipboard", { action: "copy", length: 1 }).detalle).toBe("alrededor de una palabra");
    expect(de("clipboard", { action: "copy", length: 8 }).detalle).toBe("alrededor de una palabra");
    expect(de("clipboard", { action: "copy", length: 9 }).detalle).toBe("unas 2 palabras");
    // Un largo de cero no dice «0 palabras»: no dice nada.
    expect(de("clipboard", { action: "paste", length: 0 }).detalle).toBe("");
    expect(de("clipboard", { action: "copy", length: 27 }).titulo).toBe("Copió un texto del examen");
    expect(de("clipboard", { action: "cut", length: 5 }).titulo).toBe("Cortó un texto");
    expect(de("clipboard", { length: 5 }).titulo).toBe("Copió o pegó un texto");
    for (const accion of ["paste", "copy", "cut", "otra"]) {
      const e = de("clipboard", { action: accion, length: 301 });
      expect(`${e.titulo} ${e.detalle}`).not.toMatch(/portapapeles|car[aá]cter/);
    }
  });

  // El complemento cierra el tramo oculto cuando la página se va de verdad
  // (`pagehide`), para no dejar un `visibility_hidden` huérfano en cada cambio
  // de pregunta. Pero ahí el alumno no volvió a ver nada: la página se fue.
  it("con reason unload no dice que volvió, porque no volvió", () => {
    expect(de("visibility_visible", { away_ms: 2000, reason: "unload" })).toMatchObject({
      titulo: "Cambió o cerró la página del examen",
      detalle: "2 segundos afuera",
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

  it("cuenta el mouse: sin cifras cuando se movió, y con cuánto cuando quedó quieto", () => {
    // Ronda 3: «3 movimientos, 4 segundos sin mover» ocupaba media tabla y no le decía nada al docente. Con
    // movimientos, la fila dice solo que se movió; los números siguen guardados.
    expect(de("mouse_activity", { moves: 14, idle_ms: 9000 })).toMatchObject({ titulo: "Movimiento del mouse", detalle: "" });
    expect(de("mouse_activity", { moves: 14, idle_ms: 0 }).detalle).toBe("");
    expect(de("mouse_activity", { moves: 1 }).detalle).toBe("");
    // Sin movimientos es el aviso de que quedó quieto, contado desde el último movimiento real: tiene su propio nombre.
    expect(de("mouse_activity", { moves: 0, idle_ms: 20_000 })).toMatchObject({
      titulo: "El mouse quedó quieto",
      detalle: "20 segundos",
    });
    expect(de("mouse_activity", { moves: 0, idle_ms: 76_000 }).detalle).toBe("1 minuto y 16 segundos");
    expect(de("mouse_activity", { moves: 0 })).toMatchObject({ titulo: "El mouse quedó quieto", detalle: "" });
    expect(de("mouse_leave").titulo).toBe("El mouse salió del área del examen");
    expect(de("mouse_enter", { away_ms: 9000 }).titulo).toBe("El mouse volvió al área del examen");
  });

  it("cuenta cuánto estuvo en cada pregunta como un tramo que se suma, no como el total", () => {
    // Ronda 3: «1 minuto en la pregunta 5» en dos filas seguidas no decía si era un acumulado o un tramo.
    expect(de("question_time", { slot: 2, qtype: "multichoice", ms: 42_000 })).toMatchObject({
      titulo: "Tiempo en una pregunta",
      detalle: "sumó 42 segundos en la pregunta 2",
    });
    expect(de("question_time", { slot: 5, qtype: "essay", ms: 47_000 }).detalle).toBe("sumó 47 segundos en la pregunta 5");
    // Sin el tiempo, o sin la pregunta, lo que haya.
    expect(de("question_time", { slot: 5 }).detalle).toBe("pregunta 5");
    expect(de("question_time", { ms: 3000 }).detalle).toBe("sumó 3 segundos");
    // Sin el número, el tipo sigue sirviendo para ubicarla.
    expect(de("question_time", { qtype: "numerical", ms: 3000 }).detalle).toBe("sumó 3 segundos en la pregunta numérica");
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

  it("cuenta el cambio de tamaño de la ventana sin píxeles, y la conexión", () => {
    // «1920 por 1080 píxeles» es técnico y no le sirve al docente para
    // corregir: el dato se guarda y lo lee el motor de análisis.
    expect(de("resize", { w: 1920, h: 1080 })).toMatchObject({ titulo: "Cambió el tamaño de la ventana", detalle: "" });
    expect(de("resize", { w: 1920 }).detalle).toBe("");
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
      .toBe("con un navegador que no se pudo identificar");
    expect(de("client_profile", { browser_family: "Other", browser_major: 0, is_touch: true }).detalle)
      .toBe("desde un equipo con pantalla táctil, con un navegador que no se pudo identificar");
    // Sin la versión del navegador: es un dato técnico.
    expect(de("client_profile", { browser_family: "Chrome", browser_major: 153 }).detalle)
      .toBe("con Chrome");
  });

  // Un evento sin el campo no puede afirmar que el equipo no tiene pantalla
  // táctil: eso lo dice `is_touch: false`, no la ausencia del campo.
  it("no afirma nada sobre el equipo si los campos no llegaron", () => {
    expect(de("client_profile", {}).detalle).toBe("");
    expect(de("client_profile", { browser_family: "Chrome", browser_major: 128, is_touch: false }).detalle)
      .toBe("desde una computadora, con Chrome");
  });

  // La fuente no se escribe, pero elige el nombre. Con `send` la falla puede
  // ser del servidor con el alumno conectado, así que no se le atribuye a él
  // un corte: se dice que se cortó la conexión, sin decir de quién, y no «No se
  // pudieron enviar los eventos», que hablaba del monitoreo y sonaba a falla.
  // Sin una fuente conocida no se sabe cuál de las dos pasó.
  it("no le atribuye al alumno una falla del envío", () => {
    expect(de("connection", { online: false, source: "send" })).toMatchObject({
      titulo: "Se cortó la conexión",
      detalle: "",
    });
    expect(de("connection", { online: true, source: "send" })).toMatchObject({
      titulo: "Volvió la conexión",
      detalle: "",
    });
    expect(de("connection", { online: false, source: "browser" }).titulo).toBe("Se perdió la conexión");
    expect(de("connection", { online: false, source: "browser" }).detalle).toBe("");
    expect(de("connection", { online: false })).toMatchObject({ titulo: "Conexión", detalle: "" });
    expect(de("connection", { online: true, source: "otra" }).titulo).toBe("Conexión");
  });

  // Ronda 3: en la 454, «Se cortó la conexión» y «Volvió la conexión» salían en el mismo segundo y se leían
  // como una falla del sistema. La vuelta dice cuánto duró el corte, con las dos horas del reloj del alumno.
  it("la vuelta de la conexión dice cuánto estuvo cortada", () => {
    expect(describirEvento({ type: "connection", data: { online: true, source: "send" } }, { cortadaMs: 7162 }))
      .toMatchObject({ titulo: "Volvió la conexión", detalle: "estuvo cortada 7 segundos" });
    expect(describirEvento({ type: "connection", data: { online: true, source: "send" } }, { cortadaMs: 300 }).detalle)
      .toBe("estuvo cortada menos de un segundo");
    // El corte no lleva duración: todavía no se sabe cuánto va a durar cuando se registra.
    expect(describirEvento({ type: "connection", data: { online: false, source: "send" } }, { cortadaMs: 7162 }).detalle)
      .toBe("");
    expect(describirEvento({ type: "connection", data: { online: true, source: "browser" } }, { cortadaMs: 61_000 }).detalle)
      .toBe("estuvo cortada 1 minuto y 1 segundo");
  });

  it("empareja cada vuelta con el corte anterior del mismo origen, en el orden en que se generaron", () => {
    // Los cuatro eventos de conexión de la 454, tal como están en la réplica.
    const evento = (id: number, seq: number, online: boolean, occurred_at: string, source = "send") => ({
      id, seq, type: "connection", occurred_at, data: { online, source },
    });
    const cortes = cortesDeConexion([
      evento(15847, 4, true, "2026-11-03T13:10:05.174Z"),
      evento(15788, 1, false, "2026-11-03T13:06:37.435Z"),
      evento(15793, 2, true, "2026-11-03T13:06:44.597Z"),
      evento(15844, 3, false, "2026-11-03T13:10:01.067Z"),
      { id: 1, seq: 0, type: "focus_lost", occurred_at: "2026-11-03T13:00:00.000Z", data: {} },
    ]);
    expect([...cortes.entries()].sort()).toEqual([[15793, 7162], [15847, 4107]]);
    // Una vuelta sin corte antes, de otro origen, o con una resta imposible, no lleva duración.
    expect(cortesDeConexion([evento(1, 1, true, "2026-11-03T13:00:00.000Z")]).size).toBe(0);
    expect(cortesDeConexion([
      evento(1, 1, false, "2026-11-03T13:00:00.000Z", "browser"),
      evento(2, 2, true, "2026-11-03T13:00:05.000Z", "send"),
    ]).size).toBe(0);
    expect(cortesDeConexion([
      evento(1, 1, false, "2026-11-03T13:00:05.000Z"),
      evento(2, 2, true, "2026-11-03T13:00:00.000Z"),
    ]).size).toBe(0);
  });

  it("cuenta desde qué equipo abrió el examen, sin el user agent ni la versión", () => {
    // La 457: «Navegador del alumno · Chrome 153, equipo sin pantalla táctil» era técnico.
    const la457 = { is_touch: false, browser_major: 153, browser_family: "Chrome", pointer_coarse: false, any_pointer_fine: true };
    expect(de("client_profile", la457)).toMatchObject({ titulo: "Abrió el examen", detalle: "desde una computadora, con Chrome" });
    expect(de("client_profile", { browser_family: "Safari", browser_major: 0, is_touch: true }).detalle).toBe(
      "desde un equipo con pantalla táctil, con Safari"
    );
    expect(`${de("client_profile", la457).detalle}`).not.toMatch(/153|táctil|puntero|trackpad/);
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
    expect(de("question_time", { qtype: "stack", ms: 3000 }).detalle).toBe("sumó 3 segundos en la pregunta de tipo stack");
    // Con el número, el tipo ya no va: «(de desarrollo)» se repetía en decenas de filas (ronda 3).
    expect(de("question_time", { slot: 1, qtype: "stack", ms: 3000 }).detalle).toBe("sumó 3 segundos en la pregunta 1");
  });

  // El largo del tramo que resume cada evento (`window_ms`) llega y no se
  // muestra: el docente no sabe que el complemento resume de a cinco segundos,
  // así que «1 movimiento en 5 s, hasta 26 s sin mover» son dos números que a
  // la vista no cierran. El dato queda guardado y lo lee el análisis.
  it("no muestra el largo del tramo que resume cada evento", () => {
    expect(de("key_activity", { by_origin: { typed: 38 }, window_ms: 5000 }).detalle)
      .toBe("38 teclas presionadas");
    expect(de("mouse_activity", { moves: 12, idle_ms: 0, window_ms: 800 }).detalle)
      .toBe("");
    // El caso que salía sin cerrar: «sin movimiento, 4 min 20 s, en 5 s». El
    // tramo dura 5 s y el rato quieto son 4 minutos, porque se cuenta desde el
    // último movimiento y no desde que empezó el tramo.
    expect(de("mouse_activity", { moves: 0, idle_ms: 260_000, window_ms: 5000 }).detalle)
      .toBe("4 minutos y 20 segundos");
  });

  // Ronda 3: «después de 6 segundos sin escribir» y «hizo 1 pausa de 3 segundos» eran números que los docentes
  // no sabían leer. Los datos siguen guardados y los lee el motor de análisis.
  it("no muestra el rato sin escribir de antes ni las pausas", () => {
    expect(de("key_activity", { by_origin: { typed: 5 }, gap_before_ms: 800 }).detalle).toBe("5 teclas presionadas");
    expect(de("key_activity", { slot: 2, by_origin: { typed: 4 }, gap_before_ms: 47_000 }).detalle)
      .toBe("pregunta 2, 4 teclas presionadas");
    expect(de("key_activity", { by_origin: { typed: 9 }, pauses: 3, max_pause_ms: 12_000 }).detalle)
      .toBe("9 teclas presionadas");
    expect(de("key_activity", { by_origin: { typed: 9 }, pauses: 1 }).detalle).toBe("9 teclas presionadas");
  });

  it("una sola tecla se dice con el participio, no suelta", () => {
    // Ronda 3: «pregunta 2, 1 tecla» quedaba raro.
    expect(de("key_activity", { slot: 2, by_origin: { typed: 1 } }).detalle).toBe("pregunta 2, 1 tecla presionada");
  });

  it("cuenta cuántas preguntas había a la vista, sólo cuando fue más de una", () => {
    expect(de("question_time", { slot: 1, ms: 45_000, visible_count: 4 }).detalle)
      .toBe("sumó 45 segundos en la pregunta 1, 4 en pantalla a la vez");
    expect(de("question_time", { slot: 1, ms: 45_000, visible_count: 1 }).detalle)
      .toBe("sumó 45 segundos en la pregunta 1");
  });

  it("cuenta el tiempo que el puntero estuvo fuera de la página", () => {
    expect(de("mouse_enter", { away_ms: 9000 }).detalle).toBe("9 segundos afuera");
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

  it("dice la clase de equipo con lo que traen los punteros, sin contradecirse", () => {
    // El equipo más común: puntero principal fino, sin pantalla táctil.
    expect(de("client_profile", { pointer_coarse: false, any_pointer_fine: true }).detalle).toBe("desde una computadora");
    // Una notebook con pantalla táctil: `is_touch` da verdadero, pero apunta con el mouse o el trackpad.
    expect(de("client_profile", { is_touch: true, pointer_coarse: false }).detalle)
      .toBe("desde una computadora con pantalla táctil");
    // Con el dedo como puntero principal, y una tablet con un mouse conectado.
    expect(de("client_profile", { is_touch: true, pointer_coarse: true }).detalle).toBe("desde un celular o una tableta");
    expect(de("client_profile", { pointer_coarse: true, any_pointer_fine: true }).detalle)
      .toBe("desde un celular o una tableta, con mouse o trackpad");
    expect(de("client_profile", { any_pointer_fine: true }).detalle).toBe("desde un equipo con mouse o trackpad");
    // Los dos campos se contradicen, o el táctil dice lo contrario que el puntero: no se dice nada.
    expect(de("client_profile", { pointer_coarse: false, any_pointer_fine: false }).detalle).toBe("");
    expect(de("client_profile", { is_touch: false, pointer_coarse: true }).detalle).toBe("");
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
    expect(de("visibility_visible", { away_ms: 400, reason: "unload" }).detalle).toBe("menos de un segundo afuera");
  });

  // El intervalo entre teclas dejó de mostrarse el 24/09/2026: en pantalla
  // («140 ms entre teclas, de 137 a 143») no se entendía y no es algo que el
  // docente use para decidir. Se sigue guardando, y es el motor de análisis
  // el que lo lee.
  it("no muestra el intervalo entre teclas", () => {
    const detalle = de("key_activity", {
      by_origin: { typed: 36 }, interval_ms: { min: 137, median: 140, max: 143 },
    }).detalle;

    expect(detalle).toBe("36 teclas presionadas");
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
    // «Ventana del examen al empezar» no decía qué se había registrado (ronda 2).
    expect(de("resize", { w: 1280, h: 720, initial: true })).toMatchObject({ titulo: "Se registró el tamaño de la ventana", detalle: "" });
    expect(de("resize", { w: 900, h: 700 }).titulo).toBe("Cambió el tamaño de la ventana");
  });

  it("pegar un archivo o una imagen no dice cero caracteres", () => {
    const r = de("clipboard", { action: "paste", non_text: true, slot: 2, qtype: "essay" });
    expect(r.titulo).toBe("Pegó contenido que no es texto");
    expect(r.detalle).not.toMatch(/carácter/);
  });

  it("el aviso del servidor de que la captura no estuvo se explica según el motivo", () => {
    expect(de("capture_status", { state: "js_disabled" })).toMatchObject({
      titulo: "No se registró lo que hizo en una página",
      detalle: "el navegador tenía apagada una opción que hace falta para registrar",
    });
    expect(de("capture_status", { state: "no_start" }).detalle).toBe("la página se abrió, pero no se empezó a registrar");
    for (const state of ["js_disabled", "no_start"]) {
      const r = de("capture_status", { state });
      expect(`${r.titulo} ${r.detalle}`).not.toMatch(/captura|JavaScript|arrancó|Moodle/i);
    }
  });
});
