import { describe, expect, it } from "vitest";
import {
  claveDeFiltros,
  conservarFiltros,
  escribirFiltros,
  hayFiltro,
  leerFiltros,
  NIVELES_FILTRO,
  PARAMETROS,
} from "./filtrosDeLaDireccion";

const dir = (texto: string) => new URLSearchParams(texto);

describe("leerFiltros: la lectura de la dirección (pendiente 10)", () => {
  it("devuelve siempre las cinco claves, en vacío sin filtros", () => {
    expect(leerFiltros(dir("examen=1"))).toEqual({
      nivel: undefined,
      estado: undefined,
      analisis: undefined,
      q: undefined,
      orden: undefined,
    });
    expect(Object.keys(leerFiltros(dir("")))).toEqual([...PARAMETROS]);
  });

  it("ignora los valores que no conoce", () => {
    expect(leerFiltros(dir("nivel=altisimo&estado=abandoned&analisis=analyzed&orden=started_at&q="))).toEqual({
      nivel: undefined,
      estado: undefined,
      analisis: undefined,
      q: undefined,
      orden: undefined,
    });
    expect(leerFiltros(dir("nivel=high&estado=open&analisis=unavailable&orden=risk_level&q=Ana"))).toEqual({
      nivel: "high",
      estado: "open",
      analisis: "unavailable",
      q: "Ana",
      orden: "risk_level",
    });
  });

  it("recorta los espacios de los bordes de la búsqueda, y solo espacios es no buscar", () => {
    expect(leerFiltros(dir("q=%20%20Mar%C3%ADa%20Jos%C3%A9%20")).q).toBe("María José");
    expect(leerFiltros(dir("q=%20%20%20")).q).toBeUndefined();
  });

  it("corta la búsqueda en 100 letras, contadas como letras y no como unidades de código", () => {
    expect(leerFiltros(dir(`q=${"ñ".repeat(100)}`)).q).toBe("ñ".repeat(100));
    expect(leerFiltros(dir(`q=${"ñ".repeat(101)}`)).q).toBe("ñ".repeat(100));
    // Una letra fuera del plano básico ocupa dos unidades de código: se cuenta como una.
    expect(Array.from(leerFiltros(dir(`q=${"𝓐".repeat(101)}`)).q!)).toHaveLength(100);
  });

  it("los niveles del filtro van del más alto al más bajo", () => {
    expect(NIVELES_FILTRO).toEqual(["high", "medium", "low"]);
  });
});

describe("escribirFiltros", () => {
  it("no toca los parámetros que recibe y saca la sesión abierta", () => {
    const actuales = dir("curso=2&examen=1&sesion=6&nivel=high");
    const siguiente = escribirFiltros(actuales, { estado: "open" });
    expect(actuales.toString()).toBe("curso=2&examen=1&sesion=6&nivel=high");
    expect(siguiente.toString()).toBe("curso=2&examen=1&nivel=high&estado=open");
  });

  it("nivel y análisis son excluyentes: el que llega con valor borra al otro", () => {
    expect(escribirFiltros(dir("examen=1&analisis=no_alerts"), { nivel: "high" }).toString()).toBe("examen=1&nivel=high");
    expect(escribirFiltros(dir("examen=1&nivel=high"), { analisis: "no_alerts" }).toString()).toBe("examen=1&analisis=no_alerts");
    // Borrar uno no toca al otro.
    expect(escribirFiltros(dir("examen=1&nivel=high&q=ana"), { analisis: undefined }).toString()).toBe("examen=1&nivel=high&q=ana");
  });

  it("no escribe lo predeterminado: ni el orden por hora de inicio, ni los vacíos", () => {
    expect(escribirFiltros(dir("examen=1&orden=risk_level&q=ana"), { orden: undefined, q: "   " }).toString()).toBe("examen=1");
  });

  it("escribe los filtros siempre en el mismo orden, sin importar cómo vinieron", () => {
    const siguiente = escribirFiltros(dir("orden=risk_level&q=ana&examen=1"), { estado: "finished", nivel: "low" });
    expect(siguiente.toString()).toBe("examen=1&nivel=low&estado=finished&q=ana&orden=risk_level");
  });

  it("descarta lo que no conoce de la dirección actual", () => {
    expect(escribirFiltros(dir("examen=1&nivel=altisimo"), { estado: "open" }).toString()).toBe("examen=1&estado=open");
  });
});

describe("claveDeFiltros y hayFiltro", () => {
  it("la clave es la misma para los mismos filtros escritos distinto, y vacía sin filtros", () => {
    expect(claveDeFiltros(dir("orden=risk_level&nivel=high&examen=1"))).toBe("nivel=high&orden=risk_level");
    expect(claveDeFiltros(dir("examen=1&nivel=high&orden=risk_level&sesion=3"))).toBe("nivel=high&orden=risk_level");
    expect(claveDeFiltros(dir("examen=1&sesion=3"))).toBe("");
  });

  it("el orden solo no es un filtro: no deja afuera a ninguna sesión", () => {
    expect(hayFiltro({ orden: "risk_level" })).toBe(false);
    expect(hayFiltro({ q: "ana" })).toBe(true);
    expect(hayFiltro({ analisis: "unavailable" })).toBe(true);
  });
});

describe("conservarFiltros", () => {
  const actuales = dir("examen=1&nivel=high&q=ana&orden=risk_level");

  it("en el mismo examen lleva los filtros a la dirección nueva, sin perder la sesión", () => {
    expect(conservarFiltros(dir("examen=1&sesion=6"), actuales, "1").toString()).toBe(
      "examen=1&sesion=6&nivel=high&q=ana&orden=risk_level"
    );
  });

  it("otra evaluación abre sin filtros y con el orden predeterminado", () => {
    expect(conservarFiltros(dir("examen=2"), actuales, "1").toString()).toBe("examen=2");
    expect(conservarFiltros(dir("curso=2"), actuales, "1").toString()).toBe("curso=2");
  });
});
