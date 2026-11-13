import { expect, test, type Page } from "@playwright/test";
import { abrir, simularBackend, sinSesionesAbiertas, VISTAS } from "./simulacion";

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
  await page.getByRole("button", { name: /^[\d.]+ Riesgo alto,/ }).click();
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

interface Corrimiento {
  suma: number;
  /** Las piezas que se movieron, para el mensaje si la prueba falla («TR 724->551»). */
  fuentes: string[];
  /** Cuántas veces se movió una fila de una tabla. */
  filas: number;
}

/**
 * Suma los corrimientos de diseño (layout-shift) mientras corre `accion`, como los cuenta el navegador para el
 * CLS: solo los que no siguen a una tecla o un clic en los 500 ms anteriores, que son los que llegan con la
 * respuesta demorada, cuando el docente ya está mirando la lista.
 */
async function corrimientoDurante(page: Page, accion: () => Promise<void>, ms = 1500): Promise<Corrimiento> {
  await page.evaluate(() => {
    type Entrada = PerformanceEntry & {
      value: number;
      hadRecentInput: boolean;
      sources: Array<{ node?: Node; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }>;
    };
    const w = window as unknown as { __corrimiento: Corrimiento; __observador?: PerformanceObserver };
    w.__observador?.disconnect();
    w.__corrimiento = { suma: 0, fuentes: [], filas: 0 };
    w.__observador = new PerformanceObserver((lista) => {
      for (const e of lista.getEntries() as Entrada[]) {
        if (e.hadRecentInput) continue;
        w.__corrimiento.suma += e.value;
        for (const f of e.sources) {
          const nombre = f.node?.nodeName ?? "?";
          if (nombre === "TR") w.__corrimiento.filas += 1;
          w.__corrimiento.fuentes.push(`${nombre} ${Math.round(f.previousRect.y)}->${Math.round(f.currentRect.y)}`);
        }
      }
    });
    w.__observador.observe({ type: "layout-shift" });
  });
  await accion();
  await page.waitForTimeout(ms);
  return page.evaluate(() => (window as unknown as { __corrimiento: Corrimiento }).__corrimiento);
}

/** Las acciones de la lámina de control, cada una seguida de la que la deshace. */
function acciones(page: Page): Array<[string, () => Promise<void>]> {
  const tarjetas = page.locator(".resumen__tarjeta");
  const nivel = page.getByLabel("Nivel de riesgo");
  const lista: Array<[string, () => Promise<void>]> = [];
  for (let i = 0; i < 7; i++) {
    lista.push([`prender la tarjeta ${i + 1}`, () => tarjetas.nth(i).click()]);
    lista.push([`apagar la tarjeta ${i + 1}`, () => tarjetas.nth(i).click()]);
  }
  lista.push(["elegir «Riesgo medio» en el selector", async () => void (await nivel.selectOption("medium"))]);
  lista.push(["volver a «Todos» en el selector", async () => void (await nivel.selectOption(""))]);
  lista.push(["buscar «zzzq»", () => page.getByLabel("Buscar alumno").fill("zzzq")]);
  lista.push(["Quitar filtros", () => page.getByRole("button", { name: "Quitar filtros" }).click()]);
  return lista;
}

for (const [ancho, alto] of [[1280, 900], [1440, 900], [390, 844]] as const) {
  test(`a ${ancho} px, en un examen sin nadie rindiendo, filtrar no corre nada de lo que se ve (CLS < 0,01)`, async ({ page }) => {
    // Las filas que seguían después del filtro se movían dentro de la tabla, y el navegador lo contaba como
    // corrimiento: de 0,02 a 0,05 por tarjeta.
    test.slow();
    await page.setViewportSize({ width: ancho, height: alto });
    await sinSesionesAbiertas(page);
    await demorarFiltrados(page, 700);
    await abrir(page, VISTAS.lista);
    await page.evaluate(() => document.fonts.ready);

    for (const [nombre, accion] of acciones(page)) {
      const { suma, fuentes } = await corrimientoDurante(page, accion, nombre.startsWith("buscar") ? 1800 : 1500);
      expect(suma, `${nombre}: ${fuentes.join(", ")}`).toBeLessThan(0.01);
    }
  });
}

test("con la página bajada hasta la lámina de control, ninguna fila se corre al filtrar", async ({ page }) => {
  // Así el corrimiento llegaba a 0,3. Lo que sí puede subir es el pie: si la lista filtrada es más corta que la
  // pantalla, la página termina antes. Eso es que la lista se achicó, no que se movió algo que se estaba leyendo.
  test.slow();
  await page.setViewportSize({ width: 1280, height: 900 });
  await sinSesionesAbiertas(page);
  await demorarFiltrados(page, 700);
  await abrir(page, VISTAS.lista);
  for (const [nombre, accion] of acciones(page)) {
    await page.evaluate(() => {
      const control = document.querySelector(".control")!;
      window.scrollTo({ top: control.getBoundingClientRect().top + window.scrollY - 60, behavior: "instant" });
    });
    const { filas, fuentes } = await corrimientoDurante(page, accion, nombre.startsWith("buscar") ? 1800 : 1500);
    expect(filas, `${nombre}: ${fuentes.join(", ")}`).toBe(0);
  }
});

test("con alumnos rindiendo, «Finalizadas» cambia de lugar de una sola vez, cuando llega la respuesta", async ({ page }) => {
  // Si el filtro deja «En curso» con menos filas, «Finalizadas» sube: es el resultado del filtro, y no se
  // reserva el alto de las filas que ya no están. Lo que se mide es que el cambio sea uno solo, cuando llega la
  // respuesta, y que ninguna fila se corra dentro de su tabla.
  test.slow();
  await page.setViewportSize({ width: 1280, height: 900 });
  await demorarFiltrados(page, 700);
  await abrir(page, VISTAS.lista);
  const tarjetas = page.locator(".resumen__tarjeta");
  for (let i = 0; i < 7; i++) {
    await page.evaluate(() => {
      const w = window as unknown as { __lugares: number[] };
      w.__lugares = [];
      const t0 = performance.now();
      const paso = () => {
        const h = [...document.querySelectorAll("h2")].find((t) => t.textContent?.trim() === "Finalizadas");
        if (h) w.__lugares.push(Math.round(h.getBoundingClientRect().top + window.scrollY));
        if (performance.now() - t0 < 1500) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    });
    const { filas, fuentes } = await corrimientoDurante(page, () => tarjetas.nth(i).click());
    const lugares = await page.evaluate(() => (window as unknown as { __lugares: number[] }).__lugares);
    const saltos = lugares.filter((y, j) => j > 0 && y !== lugares[j - 1]).length;
    expect(saltos, `tarjeta ${i + 1}: ${[...new Set(lugares)].join(" -> ")}`).toBeLessThanOrEqual(1);
    expect(filas, `tarjeta ${i + 1}: ${fuentes.join(", ")}`).toBe(0);
    await tarjetas.nth(i).click();
    await expect(page.locator(".panel__listas")).not.toHaveAttribute("aria-busy", { timeout: 3000 });
  }
});

test("desde la primera tecla de la búsqueda, la lista está marcada como ocupada hasta que llega el resultado", async ({ page }) => {
  // Durante los 300 ms de espera, el campo ya decía «ma» y la lista seguía entera y sin marcar.
  await page.setViewportSize({ width: 1280, height: 900 });
  await demorarFiltrados(page, 700);
  await abrir(page, VISTAS.lista);

  /** Desde ahora, cada cuadro en que el campo ya cambió y la lista no está marcada: con cuántas filas. */
  const muestrear = () =>
    page.evaluate(() => {
      const w = window as unknown as { __sinMarcar: number[] };
      w.__sinMarcar = [];
      const t0 = performance.now();
      const campo = document.querySelector<HTMLInputElement>("input[type='search']")!;
      const inicial = campo.value;
      const paso = () => {
        const ocupada = document.querySelector(".panel__listas")?.getAttribute("aria-busy") === "true";
        if (campo.value !== inicial && !ocupada) {
          w.__sinMarcar.push(document.querySelectorAll(".panel__listas tbody tr").length);
        }
        if (performance.now() - t0 < 1600) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    });
  /** Los cuadros sin marcar cuya lista no es la final: la de antes, con filas que no cumplen la búsqueda. */
  const conOtraLista = async () => {
    await page.waitForTimeout(1700);
    const finales = await page.locator(".panel__listas tbody tr").count();
    const cuadros = await page.evaluate(() => (window as unknown as { __sinMarcar: number[] }).__sinMarcar);
    return cuadros.filter((n) => n !== finales);
  };

  await muestrear();
  await page.getByLabel("Buscar alumno").pressSequentially("ma", { delay: 60 });
  expect(await conOtraLista()).toEqual([]);
  await expect(page.locator(".panel__listas")).not.toHaveAttribute("aria-busy");

  // «Quitar filtros» vacía el campo enseguida: desde ese cuadro la lista está ocupada hasta que llega entera.
  await muestrear();
  await page.getByRole("button", { name: "Quitar filtros" }).click();
  expect(await conOtraLista()).toEqual([]);
  await expect(page.locator(".panel__listas")).not.toHaveAttribute("aria-busy");
});

for (const [ancho, alto] of [[1280, 900], [390, 844]] as const) {
  test(`a ${ancho} px, «Quitar filtros» va pegado a la cifra y no se corre cuando la cifra llega`, async ({ page }) => {
    // El lugar de la cifra se guardaba con 17ch, más que «10 de 30 sesiones»: entre la cifra y el botón quedaban
    // 34 px y no los 12 del renglón, y se leían como dos piezas sueltas.
    await page.setViewportSize({ width: ancho, height: alto });
    await abrir(page, VISTAS.lista);
    const boton = page.getByRole("button", { name: "Quitar filtros" });
    const cifra = page.locator(".control__cifra-texto");
    /** Dónde termina el texto de la cifra, dónde empieza el botón y el hueco del renglón. */
    const medir = () =>
      page.evaluate(() => {
        const p = document.querySelector(".control__cifra")!;
        const rango = document.createRange();
        rango.selectNodeContents(p.querySelector(".control__cifra-texto")!);
        const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Quitar filtros")!;
        return {
          finTexto: rango.getBoundingClientRect().right,
          boton: b.getBoundingClientRect().left,
          hueco: parseFloat(getComputedStyle(p.parentElement!).columnGap),
        };
      });

    // Una búsqueda que deja tantas cifras como el total («17 de 22 sesiones»), con la respuesta demorada.
    await demorarFiltrados(page, 800);
    await page.getByLabel("Buscar alumno").fill("a");
    await expect(boton).toBeVisible();
    const sinCifra = await medir();
    // Dos cifras de cada lado, para que el molde y la cifra midan lo mismo.
    await expect(cifra).toHaveText(/^\d\d de \d\d sesiones$/);
    const conCifra = await medir();
    expect(Math.abs(conCifra.boton - sinCifra.boton)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(conCifra.boton - conCifra.finTexto - conCifra.hueco)).toBeLessThanOrEqual(2);
  });
}
