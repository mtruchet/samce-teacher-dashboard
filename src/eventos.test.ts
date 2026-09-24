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
  });
});

describe("describirEvento", () => {
  it("cuenta el foco y la visibilidad, con cuánto duró la salida", () => {
    expect(de("focus_lost")).toEqual({ titulo: "Salió de la ventana", detalle: "" });
    expect(de("focus_gained", { away_ms: 4000 })).toEqual({ titulo: "Volvió a la ventana", detalle: "estuvo afuera 4 s" });
    expect(de("visibility_hidden").titulo).toBe("Dejó de ver la pestaña");
    expect(de("visibility_visible", { away_ms: 125_000 }).detalle).toBe("estuvo afuera 2 min 5 s");
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
    expect(evento.detalle).toBe(
      "pregunta 3 (ensayo) · 12 entradas · 1 borrado · 2 pegadas · 1 autocompletada · 2 pausas"
    );
  });

  it("no menciona lo que no pasó", () => {
    const detalle = de("key_activity", { inserts: 1, deletes: 0, by_origin: { paste: 0 }, pauses: 0 }).detalle;

    expect(detalle).toBe("1 entrada · 0 borrados");
  });

  it("cuenta el pegado solo por su longitud", () => {
    expect(de("clipboard", { action: "paste", length: 340, slot: 1, qtype: "essay" })).toEqual({
      titulo: "Pegó",
      detalle: "pregunta 1 (ensayo) · 340 caracteres",
    });
    expect(de("clipboard", { action: "copy", length: 1 }).detalle).toBe("1 carácter");
    expect(de("clipboard", { action: "cut", length: 5 }).titulo).toBe("Cortó");
  });

  it("cuenta el mouse, y la quietud larga", () => {
    expect(de("mouse_activity", { moves: 14, idle_ms: 900 }).detalle).toBe("14 movimientos");
    expect(de("mouse_activity", { moves: 1 }).detalle).toBe("1 movimiento");
    expect(de("mouse_activity", { moves: 0, idle_ms: 20_000 }).detalle).toBe("sin movimiento durante 20 s");
    expect(de("mouse_leave").titulo).toBe("El cursor salió de la ventana");
    expect(de("mouse_enter").titulo).toBe("El cursor volvió a la ventana");
  });

  it("cuenta cuánto estuvo cada pregunta a la vista", () => {
    expect(de("question_time", { slot: 2, qtype: "multichoice", ms: 42_000 })).toEqual({
      titulo: "Pregunta a la vista",
      detalle: "pregunta 2 (opción múltiple) · 42 s",
    });
  });

  it("cuenta la pantalla completa, y avisa cuando se dedujo por el tamaño", () => {
    expect(de("fullscreen", { on: true, source: "api" })).toEqual({ titulo: "Entró en pantalla completa", detalle: "" });
    expect(de("fullscreen", { on: false, source: "size" })).toEqual({
      titulo: "Salió de pantalla completa",
      detalle: "detectado por el tamaño de la ventana",
    });
  });

  it("cuenta la aceptación del aviso de monitoreo (HU11)", () => {
    expect(de("consent_accepted")).toEqual({ titulo: "Aceptó el aviso de monitoreo", detalle: "" });
  });

  it("distingue el cambio de página del examen de un ocultamiento real que volvió", () => {
    expect(de("visibility_visible", { away_ms: 400, reason: "unload" })).toEqual({
      titulo: "Cambió de página del examen",
      detalle: "estuvo afuera menos de 1 s",
    });
    expect(de("visibility_visible", { away_ms: 4000 }).titulo).toBe("Volvió a ver la pestaña");
  });

  it("cuenta el tamaño de la ventana y la conexión", () => {
    expect(de("resize", { w: 1920, h: 1080 }).detalle).toBe("1920 × 1080");
    expect(de("connection", { online: false }).titulo).toBe("Se perdió la conexión");
    expect(de("connection", { online: true }).titulo).toBe("Se recuperó la conexión");
  });

  it("aclara cuando la pérdida de conexión se dedujo de los envíos y no la informó el navegador", () => {
    expect(de("connection", { online: false, source: "browser" }).detalle).toBe("");
    expect(de("connection", { online: false, source: "send" })).toEqual({
      titulo: "Se perdió la conexión",
      detalle: "detectado porque fallaron los envíos",
    });
    expect(de("connection", { online: true, source: "send" }).titulo).toBe("Se recuperó la conexión");
  });

  it("cuenta el navegador sin el user agent", () => {
    expect(de("client_profile", { browser_family: "Chrome", browser_major: 126, is_touch: false })).toEqual({
      titulo: "Navegador del alumno",
      detalle: "Chrome 126 · sin pantalla táctil",
    });
    expect(de("client_profile", { browser_family: "Safari", browser_major: 0, is_touch: true }).detalle).toBe(
      "Safari · pantalla táctil"
    );
  });

  it("muestra un tipo desconocido tal cual, en vez de esconderlo", () => {
    expect(de("algo_nuevo")).toEqual({ titulo: "algo_nuevo", detalle: "" });
  });

  it("no se rompe con datos que faltan o vienen con otro tipo", () => {
    expect(() => de("key_activity", { inserts: "muchas", by_origin: null })).not.toThrow();
    expect(() => describirEvento({ type: "resize", data: null as unknown as Record<string, unknown> })).not.toThrow();
    expect(de("focus_gained", { away_ms: "mucho" }).detalle).toBe("");
    expect(de("question_time", { slot: "tres" }).detalle).toBe("");
  });

  it("un tipo de pregunta que no conoce lo muestra como viene", () => {
    expect(de("question_time", { slot: 1, qtype: "stack", ms: 3000 }).detalle).toBe("pregunta 1 (stack) · 3 s");
  });

  // El panel registra, no juzga: ninguna frase califica lo que el alumno hizo.
  it("ninguna frase juzga al alumno", () => {
    const todos = [
      de("focus_lost"), de("visibility_hidden"), de("clipboard", { action: "paste", length: 900 }),
      de("mouse_leave"), de("fullscreen", { on: false }), de("connection", { online: false }),
    ];

    todos.forEach((e) => expect(`${e.titulo} ${e.detalle}`).not.toMatch(/sospech|irregular|riesgo|alerta|copi[oó] de|trampa|fraude/i));
  });

  it("el tamaño inicial de la ventana no se lee como una acción del alumno", () => {
    expect(de("resize", { w: 1280, h: 720, initial: true })).toEqual({ titulo: "Tamaño de la ventana al empezar", detalle: "1280 × 720" });
    expect(de("resize", { w: 900, h: 700 }).titulo).toBe("Cambió el tamaño de la ventana");
  });

  it("pegar un archivo o una imagen no dice cero caracteres", () => {
    const r = de("clipboard", { action: "paste", non_text: true, slot: 2, qtype: "essay" });
    expect(r.titulo).toBe("Pegó contenido que no es texto");
    expect(r.detalle).not.toMatch(/carácter/);
  });

  it("el aviso del servidor de que la captura no estuvo se explica según el motivo", () => {
    expect(de("capture_status", { state: "js_disabled" })).toEqual({
      titulo: "La captura no estuvo activa",
      detalle: "una página del examen se cargó con JavaScript desactivado",
    });
    expect(de("capture_status", { state: "no_start" }).detalle).toContain("la captura no arrancó");
  });
});
