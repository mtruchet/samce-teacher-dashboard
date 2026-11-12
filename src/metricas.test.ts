import { describe, expect, it } from "vitest";
import { METRICAS, duracionDeMetrica, letras, tecleo, valorDeMetrica, type Metrica } from "./metricas";
import { metricasDelCierre } from "./test/fabricas";
import { choquesConLasListas } from "./test/lenguaje";

const metrica = (clave: Metrica["clave"]) => METRICAS.find((m) => m.clave === clave) as Metrica;

describe("las formas de las métricas (D5)", () => {
  it("las duraciones, con el uno en letras", () => {
    const tabla: Array<[number, string]> = [
      [0, "menos de un segundo"],
      [0.4, "menos de un segundo"],
      [1, "un segundo"],
      [45, "45 segundos"],
      [60, "un minuto"],
      [61, "un minuto y un segundo"],
      [93, "un minuto y 33 segundos"],
      [120, "2 minutos"],
      [121, "2 minutos y un segundo"],
      [3600, "una hora"],
      [3660, "una hora y un minuto"],
      [7260, "2 horas y un minuto"],
      [9000, "2 horas y 30 minutos"],
    ];
    for (const [segundos, texto] of tabla) expect(duracionDeMetrica(segundos)).toBe(texto);
  });

  it("el tecleo se redondea primero a un decimal", () => {
    expect(tecleo(1)).toBe("una tecla por segundo");
    expect(tecleo(0.96)).toBe("una tecla por segundo");
    expect(tecleo(1.04)).toBe("una tecla por segundo");
    expect(tecleo(2.5)).toBe("2,5 teclas por segundo");
    expect(tecleo(4.2)).toBe("4,2 teclas por segundo");
    expect(tecleo(0.04)).toBe("menos de 0,1 teclas por segundo");
    expect(tecleo(0.1)).toBe("0,1 teclas por segundo");
  });

  it("las letras, redondeadas y con separador de miles", () => {
    expect(letras(1)).toBe("una letra");
    expect(letras(1240.6)).toBe("1.241 letras");
    expect(letras(2)).toBe("2 letras");
  });

  it("sin dato: null, NaN e Infinity dicen «Sin dato en esta sesión»", () => {
    const m = metrica("silence_longest_s");
    for (const valor of [null, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(valorDeMetrica(m, metricasDelCierre({ silence_longest_s: valor }))).toBe("Sin dato en esta sesión");
    }
  });

  it("el cero dice lo que pasó solo en tres métricas", () => {
    const ceros = metricasDelCierre({
      outside_longest_s: 0, largest_paste_chars: 0, mouse_idle_longest_s: 0,
      typing_rate_median_per_s: 0, question_time_median_s: 0, silence_longest_s: 0,
    });
    expect(Object.fromEntries(METRICAS.map((m) => [m.clave, valorDeMetrica(m, ceros)]))).toEqual({
      outside_longest_s: "No estuvo en otra ventana ni en otra pestaña",
      typing_rate_median_per_s: "menos de 0,1 teclas por segundo",
      largest_paste_chars: "No pegó texto",
      mouse_idle_longest_s: "menos de 15 segundos",
      question_time_median_s: "menos de un segundo",
      silence_longest_s: "menos de un segundo",
    });
  });

  it("valores con decimales: 0,96 teclas y 1240,6 letras", () => {
    const m = metricasDelCierre({ typing_rate_median_per_s: 0.96, largest_paste_chars: 1240.6 });
    expect(valorDeMetrica(metrica("typing_rate_median_per_s"), m)).toBe("una tecla por segundo");
    expect(valorDeMetrica(metrica("largest_paste_chars"), m)).toBe("1.241 letras");
  });

  it("seis métricas, sin las dos proporciones, con rótulos y textos que pasan las listas de las rondas", () => {
    expect(METRICAS).toHaveLength(6);
    const claves = METRICAS.map((m) => m.clave as string);
    expect(claves).not.toContain("outside_time_ratio");
    expect(claves).not.toContain("pasted_chars_ratio");
    const textos = [
      ...METRICAS.flatMap((m) => [m.rotulo, m.siEsCero ?? ""]),
      "Sin dato en esta sesión",
      tecleo(0), tecleo(1), tecleo(2.5), letras(1), letras(1241),
    ].filter(Boolean);
    expect(choquesConLasListas(textos)).toEqual([]);
  });

  it("de 0 a 4 horas, de medio en medio segundo, ninguna duración choca con las listas de las rondas", () => {
    const choques: string[] = [];
    for (let medios = 0; medios <= 4 * 3600 * 2; medios++) {
      const texto = duracionDeMetrica(medios / 2);
      if (/\b1 (segundo|minuto|hora)\b/.test(texto)) choques.push(texto);
      choques.push(...choquesConLasListas([texto]));
    }
    expect(choques).toEqual([]);
  });
});
