import { expect, test, type Page } from "@playwright/test";
import { abrir, simularBackend, VISTAS } from "./simulacion";

/**
 * El pie compartido por la landing y el panel (13/11): tres escalones de tinta con un solo criterio (blanco para
 * el nombre del sistema; clara-media para los títulos de columna y todo lo que se lee; clara-suave para los
 * rótulos y la bajada), renglones en múltiplos de 5 y, en la landing, nada roto a 1280 ni a 390 px.
 */

const ALTO = 844;
const MEDIA = "rgba(255, 255, 255, 0.78)";
const SUAVE = "rgba(255, 255, 255, 0.62)";

test.beforeEach(async ({ page }) => {
  await simularBackend(page);
});

async function medirPie(page: Page) {
  return page.evaluate(() => {
    const color = (s: string) => [...document.querySelectorAll<HTMLElement>(s)].map((e) => getComputedStyle(e).color);
    const renglones = [
      ...document.querySelectorAll<HTMLElement>(".pie__nombre, .pie__col li, .pie__titulo, .pie__cargo, .pie__descripcion"),
    ].map((e) => parseFloat(getComputedStyle(e).lineHeight));
    return {
      nombre: color(".pie__nombre"),
      titulos: color(".pie__titulo"),
      cargos: color(".pie__cargo"),
      renglonesChicos: color(".pie__rol"),
      enlaces: color(".pie__col a"),
      descripcion: color(".pie__descripcion"),
      renglones,
      desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      // Los dos renglones de la dirección, pegados como un solo dato.
      direccion: [...document.querySelectorAll<HTMLElement>(".pie__linea")].map((e) => e.getBoundingClientRect()),
    };
  });
}

function comprobar(m: Awaited<ReturnType<typeof medirPie>>) {
  expect(m.nombre).toEqual(["rgb(255, 255, 255)"]);
  expect(m.titulos.length).toBe(3);
  expect(new Set(m.titulos)).toEqual(new Set([MEDIA]));
  expect(m.cargos.length).toBeGreaterThan(3);
  expect(new Set(m.cargos)).toEqual(new Set([SUAVE]));
  // Lo que el rótulo presenta (el nombre, la frase, la dirección) va más claro que el rótulo.
  expect(new Set(m.renglonesChicos)).toEqual(new Set([MEDIA]));
  expect(new Set(m.enlaces)).toEqual(new Set([MEDIA]));
  expect(m.descripcion).toEqual([SUAVE]);
  // Cada renglón en un múltiplo de 5.
  expect(m.renglones.filter((r) => r % 5 !== 0)).toEqual([]);
  expect(m.desborde).toBeLessThanOrEqual(0);
  expect(m.direccion.length).toBe(2);
  expect(Math.abs(m.direccion[1].top - m.direccion[0].bottom)).toBeLessThan(1);
}

for (const ancho of [1280, 390]) {
  test(`a ${ancho} px, el pie de la landing ordena sus tintas y sus renglones, sin desbordar`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: ALTO });
    await page.goto("/");
    await page.locator("footer.pie").waitFor();
    await page.evaluate(() => document.fonts.ready);
    comprobar(await medirPie(page));
  });

  test(`a ${ancho} px, el pie del panel es el mismo, con las mismas tintas`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: ALTO });
    await abrir(page, VISTAS.lista);
    comprobar(await medirPie(page));
  });
}

// Criterio 1.4.12 (espaciado del texto): con el interlineado, las letras y las palabras agrandadas, el pie no
// puede correr la página de costado ni en el ancho más chico.
const ESPACIADO = `* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
p { margin-bottom: 2em !important; }`;

for (const [nombre, vista] of [
  ["la landing", null],
  ["el panel", VISTAS.lista],
] as const) {
  test(`a 320 px y con el espaciado de texto del 1.4.12, el pie de ${nombre} no desborda`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: ALTO });
    if (vista) await abrir(page, vista);
    else {
      await page.goto("/");
      await page.locator("footer.pie").waitFor();
    }
    await page.addStyleTag({ content: ESPACIADO });
    await page.evaluate(() => document.fonts.ready);
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(desborde).toBeLessThanOrEqual(0);
  });
}
