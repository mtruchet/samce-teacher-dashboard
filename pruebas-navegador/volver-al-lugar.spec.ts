import { expect, test, type Page } from "@playwright/test";
import { abrir, simularBackend, VISTAS } from "./simulacion";

/**
 * Volver del detalle deja al docente donde estaba (problemas 1 y 4 del 13/11): antes se veía un instante la
 * lista entera sin filtrar, y la página se deslizaba sola cientos de píxeles hasta el «Ver». Se mide cada
 * cuadro desde que se vuelve, no solo el final. El backend va simulado (ver simulacion.ts).
 */

const ALTO = 700;

test.beforeEach(async ({ page }) => {
  await simularBackend(page);
});

/**
 * Abre la sesión con un clic y devuelve la altura de la página en el momento del clic: es la que el panel
 * guarda. La que se pidió al bajar puede correrse unos píxeles si algo de arriba se reacomoda antes del clic.
 */
async function abrirSesion(page: Page, sesion: string): Promise<number> {
  await page.evaluate(() => {
    document.addEventListener(
      "pointerdown",
      () => void ((window as unknown as { __yAlClic: number }).__yAlClic = window.scrollY),
      { capture: true, once: true }
    );
  });
  await page.locator(`button[data-sesion="${sesion}"]`).click();
  const y = await page.evaluate(() => (window as unknown as { __yAlClic: number }).__yAlClic);
  await page.getByRole("heading", { name: "Registro de eventos" }).waitFor();
  return y;
}

/** Demora los pedidos de la lista que llevan un filtro: el detalle pide sin filtrar, la lista filtrada no. */
async function demorarFiltrados(page: Page, ms: number): Promise<void> {
  await page.route(/\/api\/monitored-quizzes\/\d+\/sessions\?/, async (route) => {
    const url = new URL(route.request().url());
    const filtrado = ["risk_level", "status", "analysis", "q"].some((p) => url.searchParams.has(p));
    if (filtrado) await new Promise((listo) => setTimeout(listo, ms));
    await route.fallback();
  });
}

/**
 * Baja la página hasta `y` (o hasta donde llegue) y devuelve la altura a la que quedó y el id de una sesión de
 * «Finalizadas» cuyo «Ver» está a la vista.
 */
async function bajarYElegir(page: Page, y: number): Promise<{ y: number; sesion: string }> {
  return page.evaluate((destino) => {
    window.scrollTo({ top: destino, behavior: "instant" });
    const finalizadas = [...document.querySelectorAll("section.lista")].find(
      (s) => s.querySelector("h2")?.textContent?.trim() === "Finalizadas"
    )!;
    const ver = [...finalizadas.querySelectorAll<HTMLButtonElement>("button[data-sesion]")].find((b) => {
      const r = b.getBoundingClientRect();
      return r.top > 120 && r.bottom < window.innerHeight - 20;
    })!;
    return { y: window.scrollY, sesion: ver.dataset.sesion! };
  }, y);
}

interface Muestra {
  t: number;
  y: number;
  lista: boolean;
  filas: number;
  foco: string | null;
}

/** Muestrea cada 30 ms durante `ms`, desde ya: la altura, si se ve la lista, cuántas filas y qué tiene el foco. */
async function muestrear(page: Page, volver: () => Promise<unknown>, ms = 1000): Promise<Muestra[]> {
  await page.evaluate((duracion) => {
    const w = window as unknown as { __muestras: Muestra[] };
    w.__muestras = [];
    const t0 = performance.now();
    const tomar = () => {
      w.__muestras.push({
        t: Math.round(performance.now() - t0),
        y: Math.round(window.scrollY),
        lista: document.querySelector(".panel__listas") !== null,
        filas: document.querySelectorAll(".panel__listas tbody tr").length,
        foco: (document.activeElement as HTMLElement | null)?.dataset?.sesion ?? null,
      });
      if (performance.now() - t0 < duracion) setTimeout(tomar, 30);
    };
    tomar();
  }, ms);
  await volver();
  await page.waitForTimeout(ms + 100);
  return page.evaluate(() => (window as unknown as { __muestras: Muestra[] }).__muestras);
}

/** Desde el primer cuadro con la lista, la página está a la altura de antes, sin cuadros intermedios. */
function expectEnSuLugar(muestras: Muestra[], y: number) {
  const conLista = muestras.filter((m) => m.lista);
  expect(conLista.length).toBeGreaterThan(10);
  const fuera = conLista.filter((m) => Math.abs(m.y - y) > 2);
  expect(fuera, JSON.stringify(muestras.map((m) => `${m.t}:${m.y}${m.lista ? "L" : ""}`))).toEqual([]);
}

test("a 1280 px, volver con Atrás deja la página donde estaba, con el foco en el «Ver» de la sesión", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.lista);
  const { sesion } = await bajarYElegir(page, 600);
  const y = await abrirSesion(page, sesion);
  expect(y).toBeGreaterThan(300);

  const muestras = await muestrear(page, () => page.goBack());
  expectEnSuLugar(muestras, y);
  await expect(page.locator(`button[data-sesion="${sesion}"]`)).toBeFocused();
});

for (const [como, volver] of [
  ["con Atrás", (page: Page) => page.goBack()],
  ["con la miga del examen", (page: Page) => page.locator(".migas button", { hasText: "Primer parcial" }).click()],
] as const) {
  test(`a 1280 px, con «Riesgo medio» y la lista filtrada demorada, volver ${como} no muestra la lista sin filtrar`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 420 });
    await abrir(page, `${VISTAS.lista}&nivel=medium`);
    const filtradas = await page.locator(".panel__listas tbody tr").count();
    await demorarFiltrados(page, 800);
    const { sesion } = await bajarYElegir(page, 600);
    const y = await abrirSesion(page, sesion);
    expect(y).toBeGreaterThan(100);

    const muestras = await muestrear(page, () => volver(page), 1300);
    expectEnSuLugar(muestras, y);
    // La lista que se ve al volver es la filtrada, desde el primer cuadro y mientras llega la nueva.
    expect(Math.max(...muestras.map((m) => m.filas))).toBe(filtradas);
    await expect(page.locator(`button[data-sesion="${sesion}"]`)).toBeFocused();
  });
}

test("a 1280 px, abrir con el teclado mientras la página se desliza y volver deja el «Ver» enfocado a la vista", async ({ page }) => {
  // Con el desplazamiento suave, Tab lleva la página al «Ver» deslizándola, y un Enter enseguida abría la
  // sesión a mitad de camino: al volver se restauraba esa altura y el foco quedaba debajo del borde de la
  // pantalla (WCAG 2.4.7). Sin movimiento reducido, que es donde pasa.
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page, VISTAS.lista);
  const sesion = await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const ver = [...document.querySelectorAll<HTMLButtonElement>("button[data-sesion]")];
    // El primero que está debajo del borde de la pantalla, y el anterior a él recibe el foco sin mover nada.
    const i = ver.findIndex((b) => b.getBoundingClientRect().top > window.innerHeight + 100);
    ver[i - 1].focus({ preventScroll: true });
    return ver[i].dataset.sesion!;
  });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Registro de eventos" }).waitFor();

  await page.goBack();
  const ver = page.locator(`button[data-sesion="${sesion}"]`);
  await expect(ver).toBeFocused();
  // Unos cuadros más, por si algo la moviera después.
  await page.waitForTimeout(300);
  const caja = (await ver.boundingBox())!;
  expect(caja.y).toBeGreaterThanOrEqual(52);
  expect(caja.y + caja.height).toBeLessThanOrEqual(900);
});

test("a 1280 px, entrar a una sesión por su dirección y volver con la miga deja el «Ver» enfocado entero a la vista", async ({ page }) => {
  // Sin la vista filtrada en memoria, primero se dibujaba la lista sin filtrar, el «Ver» se centraba ahí, y al
  // llegar la filtrada la página se acortaba y el foco quedaba debajo del encabezado fijo de columnas.
  await page.setViewportSize({ width: 1280, height: 700 });
  await abrir(page, `${VISTAS.lista}&nivel=medium`);
  const sesion = await page
    .locator(".panel__listas button[data-sesion]")
    .last()
    .evaluate((b) => (b as HTMLButtonElement).dataset.sesion!);
  await demorarFiltrados(page, 800);
  await abrir(page, `${VISTAS.lista}&nivel=medium&sesion=${sesion}`);

  await page.locator(".migas button", { hasText: "Primer parcial" }).click();
  const ver = page.locator(`button[data-sesion="${sesion}"]`);
  await expect(ver).toBeFocused();
  // Hasta que llegue la lista filtrada y unos cuadros más.
  await page.waitForTimeout(1300);
  await expect(ver).toBeFocused();
  const { tapado, dentro } = await ver.evaluate((b) => {
    const r = b.getBoundingClientRect();
    const th = b.closest("table")!.querySelector("thead")!.getBoundingClientRect();
    const enElCentro = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { tapado: r.top < th.bottom - 1 || !b.contains(enElCentro), dentro: r.bottom <= window.innerHeight };
  });
  expect(tapado).toBe(false);
  expect(dentro).toBe(true);
});
