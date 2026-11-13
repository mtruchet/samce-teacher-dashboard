import { expect, test, type Page } from "@playwright/test";
import { abrir, simularBackend, VISTAS } from "./simulacion";

/**
 * Que la lista no se reacomode al filtrar (problema 1 del 13/11): al tocar una tarjeta, la lámina de control
 * crecía un renglón, «En curso» desaparecía y «Finalizadas» subía a ocupar su lugar, y mientras la respuesta
 * no llegaba la tarjeta quedaba marcada sobre las filas sin filtrar. El backend va simulado (ver
 * simulacion.ts), con los pedidos filtrados demorados para que se vea el tramo intermedio.
 */

test.beforeEach(async ({ page }) => {
  await simularBackend(page);
});

/** Demora los pedidos de la lista que llevan un filtro, como un servidor lento. */
async function demorarFiltrados(page: Page, ms: number): Promise<void> {
  await page.route(/\/api\/monitored-quizzes\/\d+\/sessions\?/, async (route) => {
    const url = new URL(route.request().url());
    const filtrado = ["risk_level", "status", "analysis", "q"].some((p) => url.searchParams.has(p));
    if (filtrado) await new Promise((listo) => setTimeout(listo, ms));
    await route.fallback();
  });
}

interface Cuadro {
  control: [number, number] | null;
  enCurso: number | null;
  finalizadas: boolean;
}

/**
 * Mide cada cuadro durante `ms` mientras corre `accion`: dónde está la lámina de control (arriba y alto) y el
 * título «En curso», y si está «Finalizadas». Cada cuadro, y no solo el antes y el después: el reacomodo
 * doble pasaba entre los dos.
 */
async function cuadrosDurante(page: Page, accion: () => Promise<void>, ms = 1500): Promise<Cuadro[]> {
  await page.evaluate((duracion) => {
    const w = window as unknown as { __cuadros: Cuadro[] };
    w.__cuadros = [];
    const t0 = performance.now();
    const titulo = (texto: string) =>
      [...document.querySelectorAll("h2")].find((h) => h.textContent?.trim() === texto) ?? null;
    const paso = () => {
      const c = document.querySelector(".control")?.getBoundingClientRect();
      const e = titulo("En curso")?.getBoundingClientRect();
      w.__cuadros.push({
        control: c ? [Math.round(c.top + scrollY), Math.round(c.height)] : null,
        enCurso: e ? Math.round(e.top + scrollY) : null,
        finalizadas: titulo("Finalizadas") !== null,
      });
      if (performance.now() - t0 < duracion) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }, ms);
  await accion();
  await page.waitForTimeout(ms + 100);
  return page.evaluate(() => (window as unknown as { __cuadros: Cuadro[] }).__cuadros);
}

/** Todos los cuadros con la lámina de control y «En curso» en el mismo lugar (±1 px) y «Finalizadas» presente. */
function expectQuieto(cuadros: Cuadro[], accion: string) {
  const [primero] = cuadros;
  expect(primero.control, accion).not.toBeNull();
  expect(primero.enCurso, accion).not.toBeNull();
  for (const c of cuadros) {
    expect(c.control, accion).not.toBeNull();
    expect(Math.abs(c.control![0] - primero.control![0]), `${accion}: arriba de la lámina de control`).toBeLessThanOrEqual(1);
    expect(Math.abs(c.control![1] - primero.control![1]), `${accion}: alto de la lámina de control`).toBeLessThanOrEqual(1);
    expect(c.enCurso, `${accion}: «En curso» desapareció`).not.toBeNull();
    expect(Math.abs(c.enCurso! - primero.enCurso!), `${accion}: «En curso» se movió`).toBeLessThanOrEqual(1);
    expect(c.finalizadas, `${accion}: «Finalizadas» desapareció`).toBe(true);
  }
}

for (const [ancho, alto] of [[1280, 900], [1440, 900], [390, 844]] as const) {
  test(`a ${ancho} px, filtrar no mueve la lámina de control ni «En curso», y los dos grupos quedan`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: ancho, height: alto });
    await demorarFiltrados(page, 700);
    await abrir(page, VISTAS.lista);

    const tarjetas = page.locator(".resumen__tarjeta");
    const cuantas = await tarjetas.count();
    expect(cuantas).toBe(7);
    for (let i = 0; i < cuantas; i++) {
      const nombre = (await tarjetas.nth(i).getAttribute("aria-label")) ?? String(i);
      expectQuieto(await cuadrosDurante(page, () => tarjetas.nth(i).click()), `prender ${nombre}`);
      expectQuieto(await cuadrosDurante(page, () => tarjetas.nth(i).click()), `apagar ${nombre}`);
    }

    // Una búsqueda que no encuentra a nadie y «Quitar filtros»: los dos grupos siguen en su lugar.
    expectQuieto(
      await cuadrosDurante(page, () => page.getByLabel("Buscar alumno").fill("zzzq"), 1800),
      "buscar «zzzq»"
    );
    await expect(page.getByText("Ninguna sesión en curso coincide con el filtro.")).toBeVisible();
    expectQuieto(
      await cuadrosDurante(page, () => page.getByRole("button", { name: "Quitar filtros" }).click()),
      "Quitar filtros"
    );
  });
}

test("mientras el filtro no contesta, ninguna fila sin filtrar se ve como si estuviera filtrada", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await demorarFiltrados(page, 800);
  await abrir(page, VISTAS.lista);

  await page.evaluate(() => {
    const w = window as unknown as { __malas: string[]; __ocupada: boolean; __verMas: boolean };
    w.__malas = [];
    w.__ocupada = false;
    w.__verMas = false;
    const t0 = performance.now();
    const mirar = () => {
      // Desde que la tarjeta está marcada, las filas de la lista que no está ocupada son todas de riesgo alto.
      const marcada = document.querySelector(".resumen__tarjeta[aria-pressed='true']") !== null;
      if (marcada) for (const fila of document.querySelectorAll(".panel__listas:not([aria-busy='true']) tbody tr")) {
        const nivel = fila.querySelector("[data-nivel]")?.getAttribute("data-nivel") ?? "sin nivel";
        if (nivel !== "high") w.__malas.push(`${Math.round(performance.now() - t0)} ms: ${nivel}`);
      }
      if (document.querySelector(".panel__listas[aria-busy='true']")) w.__ocupada = true;
      if ([...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Ver más sesiones")) w.__verMas = true;
      if (performance.now() - t0 < 1600) setTimeout(mirar, 50);
    };
    // Empieza a mirar después del clic, que se hace enseguida.
    setTimeout(mirar, 0);
  });
  await page.getByRole("button", { name: /^Riesgo alto/ }).click();
  await page.waitForTimeout(1800);
  const { malas, ocupada, verMas } = await page.evaluate(() => {
    const w = window as unknown as { __malas: string[]; __ocupada: boolean; __verMas: boolean };
    return { malas: w.__malas, ocupada: w.__ocupada, verMas: w.__verMas };
  });
  expect(ocupada).toBe(true);
  expect(malas).toEqual([]);
  expect(verMas).toBe(false);
  await expect(page.locator(".panel__listas")).not.toHaveAttribute("aria-busy");
});
