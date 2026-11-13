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
      ...document.querySelectorAll<HTMLElement>(".pie__col li, .pie__titulo, .pie__cargo, .pie__descripcion"),
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
