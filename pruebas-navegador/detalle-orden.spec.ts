import { expect, test, type Page } from "@playwright/test";
import { simularBackend, VISTAS } from "./simulacion";

/**
 * El detalle aparece en el orden en que se lee (problemas 2 y 4 del 13/11): con red lenta, el registro de
 * eventos llegaba antes que el análisis, se dibujaba, y el análisis aparecía arriba y lo empujaba entre 800 y
 * 1000 px con el docente ya leyéndolo. Se mide cada cuadro desde que se abre la página, no solo el final. El
 * backend va simulado (ver simulacion.ts).
 */

interface Cuadro {
  registro: boolean;
  veredicto: boolean;
  tituloTop: number | null;
}

/** Demora las respuestas del análisis y de los eventos del detalle. */
async function demorar(page: Page, ms: { analisis: number; eventos: number }): Promise<void> {
  await page.route(/\/api\/monitored-quizzes\/\d+\/sessions\/\d+\/(analysis|events)/, async (route) => {
    const cual = route.request().url().includes("/analysis") ? ms.analisis : ms.eventos;
    await new Promise((listo) => setTimeout(listo, cual));
    await route.fallback();
  });
}

/**
 * Desde el primer cuadro de la página: qué se ve en cada uno, y cuánto suman los corrimientos de diseño desde
 * el cuadro que sigue al primero del detalle. Lo de antes es el arranque del panel (el pulso mientras se buscan
 * las sesiones) y su reemplazo por el detalle, que empuja el pie fuera de la pantalla: no es algo que el
 * docente esté leyendo.
 */
async function grabar(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __cuadros: Cuadro[]; __corrimiento: number; __desde: number | null };
    w.__cuadros = [];
    w.__corrimiento = 0;
    w.__desde = null;
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
        if (!e.hadRecentInput && w.__desde !== null && e.startTime >= w.__desde) w.__corrimiento += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
    let visto = false;
    const tomar = (ahora: number) => {
      // Se empieza a contar en el cuadro siguiente al primero en que está el detalle.
      if (visto && w.__desde === null) w.__desde = ahora;
      if (document.querySelector(".detalle")) visto = true;
      const titulo = document.getElementById("registro-de-eventos-titulo");
      w.__cuadros.push({
        registro: document.querySelector(".detalle__registro") !== null,
        veredicto: document.querySelector(".veredicto") !== null,
        tituloTop: titulo ? Math.round(titulo.getBoundingClientRect().top + window.scrollY) : null,
      });
      requestAnimationFrame(tomar);
    };
    requestAnimationFrame(tomar);
  });
}

for (const ancho of [1280, 390]) {
  test(`a ${ancho} px, el registro aparece después del análisis y no se mueve`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    await simularBackend(page);
    await demorar(page, { analisis: 1500, eventos: 100 });
    await grabar(page);

    await page.goto(VISTAS.detalleAlto);
    await page.locator(".eventos tbody tr").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    // Unos cuadros más después de que llegó todo.
    await page.waitForTimeout(400);

    const { cuadros, corrimiento } = await page.evaluate(() => {
      const w = window as unknown as { __cuadros: Cuadro[]; __corrimiento: number };
      return { cuadros: w.__cuadros, corrimiento: w.__corrimiento };
    });
    // El registro nunca está sin el veredicto arriba.
    expect(cuadros.filter((c) => c.registro && !c.veredicto)).toEqual([]);
    // Desde que aparece, el título del registro no cambia de lugar.
    const tops = [...new Set(cuadros.map((c) => c.tituloTop).filter((t): t is number => t !== null))];
    expect(tops).toHaveLength(1);
    expect(corrimiento).toBeLessThan(0.05);
  });
}

test("a 390 px, la cabecera de una sesión cerrada hace rato no cambia de alto mientras llega el registro", async ({ page }) => {
  // Antes decía «En vivo» hasta que el registro contestaba; el pulso desaparecía y todo subía 35 px.
  await page.setViewportSize({ width: 390, height: 900 });
  await simularBackend(page);
  await demorar(page, { analisis: 100, eventos: 1500 });
  await page.addInitScript(() => {
    const w = window as unknown as { __altos: number[] };
    w.__altos = [];
    const tomar = () => {
      const cabecera = document.querySelector(".panel__cabecera");
      if (cabecera && document.querySelector(".detalle")) w.__altos.push(Math.round(cabecera.getBoundingClientRect().height));
      requestAnimationFrame(tomar);
    };
    requestAnimationFrame(tomar);
  });

  await page.goto(VISTAS.detalleAlto);
  await page.locator(".eventos tbody tr").first().waitFor();
  await page.waitForTimeout(300);

  const altos = await page.evaluate(() => (window as unknown as { __altos: number[] }).__altos);
  expect(altos.length).toBeGreaterThan(10);
  expect(altos[0]).toBe(altos[altos.length - 1]);
  expect(new Set(altos).size).toBe(1);
  await expect(page.getByText(/En vivo/)).toHaveCount(0);
});

test("a 1280 px, el aviso de que el registro no se pudo actualizar no mueve el análisis", async ({ page }) => {
  // El aviso iba arriba del análisis: cada corte de la conexión lo bajaba y lo volvía a subir 82 px.
  await page.setViewportSize({ width: 1280, height: 900 });
  await simularBackend(page);
  let pedidos = 0;
  await page.route(/\/api\/monitored-quizzes\/\d+\/sessions\/\d+\/events/, async (route) => {
    pedidos += 1;
    if (pedidos > 1) return route.abort();
    return route.fallback();
  });

  await page.goto(VISTAS.detalleEnCurso);
  await page.locator(".eventos tbody tr").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  const antes = await page.locator(".analisis").evaluate((n) => n.getBoundingClientRect().top + window.scrollY);

  const aviso = page.getByText(/No se pudo actualizar el registro/);
  await aviso.waitFor();
  const despues = await page.locator(".analisis").evaluate((n) => n.getBoundingClientRect().top + window.scrollY);
  expect(despues).toBe(antes);
  await expect(page.locator("section.detalle__registro").getByText(/No se pudo actualizar el registro/)).toBeVisible();
});

for (const ancho of [1280, 390]) {
  test(`a ${ancho} px, cuando los eventos llegan después del análisis, el encabezado del registro no cambia`, async ({ page }) => {
    // La cuenta («80 eventos, de…») aparecía con los eventos: a 1280 px empujaba el título 3 px, y a 390 px
    // ocupaba un renglón nuevo y bajaba «Cargando los eventos…» y todo lo de abajo.
    await page.setViewportSize({ width: ancho, height: 900 });
    await simularBackend(page);
    await demorar(page, { analisis: 100, eventos: 1500 });
    await page.addInitScript(() => {
      const w = window as unknown as { __medidas: Array<{ cuenta: boolean; top: number; alto: number }> };
      w.__medidas = [];
      const tomar = () => {
        const titulo = document.getElementById("registro-de-eventos-titulo");
        const encabezado = document.querySelector(".detalle__encabezado");
        if (titulo && encabezado) {
          w.__medidas.push({
            cuenta: Boolean(document.querySelector(".detalle__cuenta .lamina__cuenta")?.textContent?.trim()),
            top: titulo.getBoundingClientRect().top + window.scrollY,
            alto: encabezado.getBoundingClientRect().height,
          });
        }
        requestAnimationFrame(tomar);
      };
      requestAnimationFrame(tomar);
    });

    await page.goto(VISTAS.detalleAlto);
    await page.locator(".eventos tbody tr").first().waitFor();
    await page.waitForTimeout(300);
    const medidas = await page.evaluate(
      () => (window as unknown as { __medidas: Array<{ cuenta: boolean; top: number; alto: number }> }).__medidas
    );
    const antes = medidas.filter((m) => !m.cuenta);
    const despues = medidas.filter((m) => m.cuenta);
    expect(antes.length).toBeGreaterThan(5);
    expect(despues.length).toBeGreaterThan(5);
    for (const m of despues) {
      expect(Math.abs(m.top - antes[0].top)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(m.alto - antes[0].alto)).toBeLessThanOrEqual(0.5);
    }
  });
}

test("a 1280 px, entrando por la dirección del detalle, el pie no se asoma mientras se buscan las sesiones", async ({ page }) => {
  // Con un enlace, la recarga o un favorito, la espera previa al detalle («Buscando sesiones») no ocupaba la
  // pantalla: el pie se veía a media altura y bajaba de golpe cuando aparecía el detalle (0,21 de corrimiento).
  await page.setViewportSize({ width: 1280, height: 900 });
  await simularBackend(page);
  await page.route(/\/api\/monitored-quizzes\/\d+\/sessions\?/, async (route) => {
    await new Promise((listo) => setTimeout(listo, 700));
    await route.fallback();
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __corrimiento: number; __pieVisto: number[] };
    w.__corrimiento = 0;
    w.__pieVisto = [];
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
        if (!e.hadRecentInput) w.__corrimiento += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
    const tomar = () => {
      const pie = document.querySelector(".pie");
      if (pie && !document.querySelector(".detalle")) {
        const top = pie.getBoundingClientRect().top;
        if (top < window.innerHeight) w.__pieVisto.push(Math.round(top));
      }
      requestAnimationFrame(tomar);
    };
    requestAnimationFrame(tomar);
  });

  await page.goto(VISTAS.detalleAlto);
  await page.locator(".eventos tbody tr").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const { corrimiento, pieVisto } = await page.evaluate(() => {
    const w = window as unknown as { __corrimiento: number; __pieVisto: number[] };
    return { corrimiento: w.__corrimiento, pieVisto: w.__pieVisto };
  });
  expect(pieVisto).toEqual([]);
  expect(corrimiento).toBeLessThan(0.01);
});

test("a 1280 px, con un análisis corto ya dibujado y los eventos en camino, el pie no se asoma", async ({ page }) => {
  // El alto mínimo del detalle se soltaba apenas llegaba el análisis: con «Cargando los eventos…» el detalle
  // quedaba más bajo que la pantalla, el pie subía a la vista y volvía a bajar de golpe al llegar el registro.
  await page.setViewportSize({ width: 1280, height: 900 });
  await simularBackend(page);
  await demorar(page, { analisis: 100, eventos: 1500 });
  await page.addInitScript(() => {
    const w = window as unknown as { __pieAsomado: number; __esperando: number };
    w.__pieAsomado = 0;
    w.__esperando = 0;
    const tomar = () => {
      const pie = document.querySelector(".pie");
      if (document.querySelector(".detalle__cargando") && pie) {
        w.__esperando += 1;
        if (pie.getBoundingClientRect().top < window.innerHeight) w.__pieAsomado += 1;
      }
      requestAnimationFrame(tomar);
    };
    requestAnimationFrame(tomar);
  });

  await page.goto(VISTAS.detalleNoAnalizado);
  await page.locator(".eventos tbody tr").first().waitFor();

  const { pieAsomado, esperando } = await page.evaluate(() => {
    const w = window as unknown as { __pieAsomado: number; __esperando: number };
    return { pieAsomado: w.__pieAsomado, esperando: w.__esperando };
  });
  expect(esperando).toBeGreaterThan(10);
  expect(pieAsomado).toBe(0);
});
