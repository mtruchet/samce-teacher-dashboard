import { expect, test, type Page } from "@playwright/test";
import { choquesConLasListas } from "../src/test/listas";
import { abrir, simularBackend, VISTAS } from "./simulacion";

/**
 * Lo que solo se puede comprobar en un navegador de verdad (R4, R9, R10 y R13 de la lista de control de
 * docs/sistema-visual.md): el anillo de foco al tabular, los colores forzados de Windows, el ancho de un
 * teléfono y que la barra fija no tape lo enfocado. El backend va simulado (ver simulacion.ts).
 */

/** El celeste del anillo de foco (--celeste en tokens.css). */
const CELESTE = "rgb(0, 140, 178)";
/** La capa de afuera del anillo sobre las superficies oscuras (--anillo-foco-oscuro: --tinta-clara). */
const BLANCO = "rgb(255, 255, 255)";

const ANCHOS = [390, 1280] as const;
const ALTO = 844;

test.beforeEach(async ({ page }) => {
  await simularBackend(page);
});

interface Parada {
  descripcion: string;
  visible: boolean;
  anillo: boolean;
}

/** Cómo se ve lo enfocado ahora: si cumple :focus-visible y si lleva el anillo (celeste o contorno sólido). */
function paradaActual(page: Page): Promise<Parada> {
  return page.evaluate(([celeste, blanco]) => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { descripcion: "body", visible: false, anillo: false };
    const estilo = getComputedStyle(el);
    const contorno =
      estilo.outlineStyle === "solid" &&
      parseFloat(estilo.outlineWidth) >= 2 &&
      estilo.outlineColor !== "rgba(0, 0, 0, 0)" &&
      estilo.outlineColor !== "transparent";
    const texto = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40);
    return {
      descripcion: `${el.tagName.toLowerCase()}.${el.className} «${texto}»`,
      visible: el.matches(":focus-visible"),
      // En la barra y el pie, que son oscuros, la capa de afuera es blanca (A1).
      anillo: estilo.boxShadow.includes(el.closest(".barra, .pie") ? blanco : celeste) || contorno,
    };
  }, [CELESTE, BLANCO]);
}

for (const ancho of ANCHOS) {
  for (const [nombre, vista] of [
    ["la lista", VISTAS.lista],
    ["el detalle", VISTAS.detalleAlto],
  ] as const) {
    test(`B1: a ${ancho} px, las primeras 25 paradas de ${nombre} llevan el anillo de foco`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: ALTO });
      await abrir(page, vista);
      const sinAnillo: string[] = [];
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press("Tab");
        const parada = await paradaActual(page);
        // Menos de 25 paradas: el foco salió de la página, y el recorrido terminó.
        if (parada.descripcion === "body" && i > 0) break;
        if (!parada.visible || !parada.anillo) sinAnillo.push(`${i + 1}: ${parada.descripcion}`);
      }
      expect(sinAnillo).toEqual([]);
    });
  }
}

test.describe("B2: con colores forzados", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.setViewportSize({ width: 1280, height: ALTO });
  });

  test("lo enfocado lleva un contorno sólido", async ({ page }) => {
    await abrir(page, VISTAS.lista);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const estilo = await page.evaluate(() => {
        const e = getComputedStyle(document.activeElement as Element);
        return { estilo: e.outlineStyle, ancho: parseFloat(e.outlineWidth) };
      });
      expect(estilo.estilo).toBe("solid");
      expect(estilo.ancho).toBeGreaterThanOrEqual(2);
    }
  });

  test("los segmentos llenos y vacíos del medidor se distinguen", async ({ page }) => {
    await abrir(page, VISTAS.lista);
    const colores = await page.evaluate(() => {
      const medidor = [...document.querySelectorAll(".medidor")].find(
        (m) => m.querySelector(".medidor__segmento--lleno") && m.querySelector(".medidor__segmento:not(.medidor__segmento--lleno)")
      );
      if (!medidor) return null;
      const lleno = getComputedStyle(medidor.querySelector(".medidor__segmento--lleno")!).backgroundColor;
      const vacio = getComputedStyle(medidor.querySelector(".medidor__segmento:not(.medidor__segmento--lleno)")!).backgroundColor;
      return { lleno, vacio };
    });
    expect(colores).not.toBeNull();
    expect(colores!.lleno).not.toBe(colores!.vacio);
  });

  test("la tarjeta marcada del resumen lleva su borde, y con foco se ve distinta que sin él", async ({ page }) => {
    await abrir(page, VISTAS.listaRiesgoAlto);
    const tarjeta = page.locator('[aria-pressed="true"]');
    await expect(tarjeta).toHaveCount(1);
    const estilo = () =>
      tarjeta.evaluate((t) => {
        const e = getComputedStyle(t);
        return { borde: `${e.borderTopStyle} ${e.borderTopWidth}`, contorno: `${e.outlineStyle} ${e.outlineWidth} ${e.outlineOffset}` };
      });
    const sinFoco = await estilo();
    expect(sinFoco.borde).toBe("solid 3px");
    await tarjeta.focus();
    expect(await tarjeta.evaluate((t) => t.matches(":focus-visible"))).toBe(true);
    const conFoco = await estilo();
    expect(conFoco.contorno).not.toBe(sinFoco.contorno);
    expect(conFoco.contorno.startsWith("solid")).toBe(true);
  });

  test("las tarjetas de estado del resumen conservan un borde, como botones", async ({ page }) => {
    await abrir(page, VISTAS.lista);
    const bordes = await page.evaluate(() =>
      [...document.querySelectorAll(".resumen__tarjeta")].map((t) => getComputedStyle(t).borderTopStyle)
    );
    expect(bordes).toHaveLength(7);
    for (const b of bordes) expect(b).toBe("solid");
  });

  test("los selectores, la búsqueda y los botones del registro tienen borde", async ({ page }) => {
    await abrir(page, VISTAS.lista);
    const bordes = await page.evaluate(() =>
      [...document.querySelectorAll("select, input")].map((e) => getComputedStyle(e).borderTopStyle)
    );
    expect(bordes.length).toBeGreaterThanOrEqual(3);
    for (const b of bordes) expect(b).not.toBe("none");

    await abrir(page, VISTAS.detalleAlto);
    const botones = page.locator(".boton-secundario");
    await expect(botones.first()).toBeVisible();
    for (const b of await botones.all()) {
      expect(await b.evaluate((e) => getComputedStyle(e).borderTopStyle)).not.toBe("none");
    }
  });
});

test.describe("B3: a 390 px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: ALTO });
  });

  for (const [nombre, vista] of [
    ["la lista", VISTAS.lista],
    ["la lista filtrada", VISTAS.listaSinAlertas],
    ["el detalle", VISTAS.detalleAlto],
  ] as const) {
    test(`${nombre} no se desplaza de costado`, async ({ page }) => {
      await abrir(page, vista);
      const medidas = await page.evaluate(() => ({
        ancho: document.documentElement.scrollWidth,
        visible: document.documentElement.clientWidth,
      }));
      expect(medidas.ancho).toBe(medidas.visible);
    });
  }

  test("la tabla de la lista y la del registro entran en su marco", async ({ page }) => {
    const entra = (selector: string) =>
      page.locator(selector).first().evaluate((m) => m.scrollWidth <= m.clientWidth + 1);
    await abrir(page, VISTAS.lista);
    expect(await entra(".lista__marco")).toBe(true);
    await abrir(page, VISTAS.detalleAlto);
    expect(await entra(".eventos__marco")).toBe(true);
  });

  test("las tres tarjetas de nivel quedan en el mismo renglón", async ({ page }) => {
    await abrir(page, VISTAS.lista);
    const arriba = await page.evaluate(() =>
      [...document.querySelectorAll("button[data-nivel]")].map((t) => Math.round(t.getBoundingClientRect().top))
    );
    expect(arriba).toHaveLength(3);
    expect(new Set(arriba).size).toBe(1);
  });

  for (const [nombre, vista] of [
    ["la lista", VISTAS.lista],
    ["el detalle", VISTAS.detalleAlto],
  ] as const) {
    test(`los controles de ${nombre} miden al menos 24 × 24`, async ({ page }) => {
      await abrir(page, vista);
      const chicos = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("main button, main select, main input, main summary, main a[href], .migas button, .migas a")]
          .filter((e) => e.offsetParent !== null && !e.closest(".solo-lectores"))
          .map((e) => ({ e, r: e.getBoundingClientRect() }))
          .filter(({ r }) => r.width < 24 || r.height < 24)
          .map(({ e, r }) => `${e.tagName.toLowerCase()}.${e.className} «${(e.textContent ?? "").trim().slice(0, 30)}» ${Math.round(r.width)}×${Math.round(r.height)}`)
      );
      expect(chicos).toEqual([]);
    });
  }
});

/**
 * Espera a que la página deje de desplazarse. El panel se desplaza con suavidad (scroll-behavior: smooth
 * cuando no se pidió menos movimiento), y medir a mitad del recorrido daría un falso «tapado».
 */
function desplazamientoQuieto(page: Page): Promise<void> {
  return page.evaluate(
    () =>
      new Promise<void>((listo) => {
        let anterior = -1;
        let quietos = 0;
        const mirar = () => {
          const ahora = window.scrollY;
          quietos = ahora === anterior ? quietos + 1 : 0;
          anterior = ahora;
          if (quietos >= 5) listo();
          else requestAnimationFrame(mirar);
        };
        requestAnimationFrame(mirar);
      })
  );
}

for (const ancho of ANCHOS) {
  test(`B4: a ${ancho} px, tabulando hacia atrás desde el último «Ver», nada queda debajo de la barra`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: ALTO });
    await abrir(page, VISTAS.lista);
    const ver = page.getByRole("button", { name: /^Ver la sesión de/ });
    await ver.last().focus();
    const tapados: string[] = [];
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Shift+Tab");
      await desplazamientoQuieto(page);
      const medida = await page.evaluate(() => {
        const barra = document.querySelector(".barra")!.getBoundingClientRect();
        const el = document.activeElement as HTMLElement;
        if (el.closest(".barra")) return null;
        const r = el.getBoundingClientRect();
        return { tapado: r.top < barra.bottom, que: `${el.tagName.toLowerCase()} «${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}» ${Math.round(r.top)} < ${Math.round(barra.bottom)}` };
      });
      if (medida?.tapado) tapados.push(medida.que);
    }
    expect(tapados).toEqual([]);
  });
}

/**
 * La tabla de sesiones crece con la página, sin desplazamiento propio (problema 1 del 13/11): con un alto tope,
 * la última fila quedaba cortada bajo una sombra y la rueda del ratón quedaba atrapada adentro. El encabezado
 * de columnas sigue a la vista, fijo debajo de la barra del panel.
 */
for (const ancho of [1280, 1440] as const) {
  test(`a ${ancho} px, la tabla de sesiones no se desplaza adentro y ninguna fila queda cortada`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    await abrir(page, VISTAS.lista);
    const marcos = await page.evaluate(() =>
      [...document.querySelectorAll(".lista__marco")].map((m) => {
        const pie = m.getBoundingClientRect().bottom;
        const cortadas = [...m.querySelectorAll("tbody tr")].filter((tr) => tr.getBoundingClientRect().bottom > pie + 0.5);
        return { alto: m.clientHeight, contenido: m.scrollHeight, cortadas: cortadas.length };
      })
    );
    expect(marcos.length).toBe(2);
    for (const m of marcos) {
      expect(m.contenido, JSON.stringify(m)).toBe(m.alto);
      expect(m.cortadas).toBe(0);
    }
  });
}

test("a 1280 px, a mitad de la tabla el encabezado de columnas queda fijo debajo de la barra", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page, VISTAS.lista);
  const tabla = page.locator(".lista__marco").last();
  const { arriba, alto } = await tabla.evaluate((m) => {
    const r = m.getBoundingClientRect();
    return { arriba: r.top + window.scrollY, alto: r.height };
  });
  expect(alto).toBeGreaterThan(500);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), arriba + alto / 2);
  const th = tabla.locator("th", { hasText: "Alumno" });
  const top = await th.evaluate((e) => e.getBoundingClientRect().top);
  expect(Math.abs(top - 52)).toBeLessThanOrEqual(1);
});

test("a 1280 px, con «Mostrar todos», el encabezado del registro de eventos queda fijo debajo de la barra", async ({ page }) => {
  // El marco se desplazaba de costado aunque la tabla entrara, y el encabezado quedaba fijo contra él y no
  // contra la página: bajando por cientos de filas no se sabía qué era cada columna.
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page, VISTAS.detalleAlto);
  await page.getByRole("button", { name: "Mostrar todos" }).click();
  const arriba = await page.locator(".eventos").evaluate((t) => t.getBoundingClientRect().top + window.scrollY);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), arriba + 800);
  const top = await page.locator(".eventos th").first().evaluate((e) => e.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(51);
  expect(top).toBeLessThanOrEqual(53);
});

test("a 1280 px, la rueda del ratón sobre la tabla desplaza la página", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page, VISTAS.lista);
  const tabla = page.locator(".lista__marco").last();
  await tabla.evaluate((m) => window.scrollTo({ top: m.getBoundingClientRect().top + window.scrollY - 200, behavior: "instant" }));
  const antes = await page.evaluate(() => window.scrollY);
  const caja = (await tabla.boundingBox())!;
  await page.mouse.move(caja.x + caja.width / 2, Math.min(caja.y + 100, 800));
  await page.mouse.wheel(0, 3000);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(antes);
});

test("a 1280 px, tabulando por los «Ver» hacia adelante y hacia atrás, ninguno queda tapado por la barra ni por el encabezado de columnas", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await abrir(page, VISTAS.lista);
  const ver = page.getByRole("button", { name: /^Ver la sesión de/ });
  const total = await ver.count();
  const tapados: string[] = [];
  const medir = async (sentido: string) => {
    await desplazamientoQuieto(page);
    const medida = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      if (!el.matches("button[data-sesion]")) return null;
      const r = el.getBoundingClientRect();
      const barra = document.querySelector(".barra")!.getBoundingClientRect().bottom;
      // El encabezado de la tabla de lo enfocado, que es el que puede quedar fijo encima.
      const th = el.closest("table")!.querySelector("th")!.getBoundingClientRect().bottom;
      return { tapado: r.top < Math.max(barra, th) - 0.5 || r.bottom > window.innerHeight + 0.5, que: `${el.getAttribute("aria-label")} ${Math.round(r.top)} (barra ${Math.round(barra)}, encabezado ${Math.round(th)})` };
    });
    if (medida?.tapado) tapados.push(`${sentido}: ${medida.que}`);
  };
  await ver.first().focus();
  for (let i = 1; i < total; i++) {
    await page.keyboard.press("Tab");
    await medir("adelante");
  }
  await ver.last().focus();
  for (let i = 1; i < total; i++) {
    await page.keyboard.press("Shift+Tab");
    await medir("atrás");
  }
  expect(tapados).toEqual([]);
});

/**
 * Los roles del árbol de accesibilidad real de Chromium (por CDP), no los que calcula Playwright desde el DOM:
 * un `display: grid` puede hacer que el navegador descarte la semántica de tabla, y `ariaSnapshot()` no lo ve.
 */
async function rolesDelArbol(page: Page): Promise<Record<string, number>> {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = (await cdp.send("Accessibility.getFullAXTree")) as {
    nodes: Array<{ ignored?: boolean; role?: { value?: string } }>;
  };
  await cdp.detach();
  const cuenta: Record<string, number> = {};
  for (const n of nodes) {
    if (n.ignored) continue;
    const rol = n.role?.value ?? "";
    cuenta[rol] = (cuenta[rol] ?? 0) + 1;
  }
  return cuenta;
}

test("B5: a 390 px, la tabla apilada sigue siendo una tabla para los lectores de pantalla (H09, A5)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: ALTO });
  await abrir(page, VISTAS.lista);
  const angosta = await rolesDelArbol(page);
  expect(angosta.table).toBeGreaterThanOrEqual(2);
  expect(angosta.row).toBeGreaterThan(2);
  expect(angosta.cell).toBeGreaterThan(2);
  // La hora de comienzo se va de la vista, no del árbol: los encabezados son los mismos que a 1280 px, y el
  // título de la tabla, que la nombra, sigue siendo cierto (A5).
  await page.setViewportSize({ width: 1280, height: ALTO });
  const ancha = await rolesDelArbol(page);
  expect(angosta.columnheader).toBe(ancha.columnheader);
  expect(angosta.cell).toBe(ancha.cell);

  await page.setViewportSize({ width: 390, height: ALTO });
  await abrir(page, VISTAS.detalleAlto);
  const registro = await rolesDelArbol(page);
  expect(registro.table).toBeGreaterThanOrEqual(1);
  expect(registro.columnheader).toBeGreaterThanOrEqual(3);
  expect(registro.cell).toBeGreaterThan(3);
});

test("a 1280 px, la columna «Análisis» empieza en el mismo lugar en «En curso» y en «Finalizadas»", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.lista);
  const izquierdas = await page.evaluate(() =>
    [...document.querySelectorAll(".lista th.tabla__analisis")].map((th) => Math.round(th.getBoundingClientRect().left))
  );
  expect(izquierdas).toHaveLength(2);
  expect(new Set(izquierdas).size).toBe(1);
});

for (const ancho of [1280, 390]) {
  test(`a ${ancho} px, los cuatro apartados del detalle dejan el mismo aire entre su título y su contenido`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: ALTO });
    await abrir(page, VISTAS.detalleAlto);
    const aires = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".apartado__titulo")].map((titulo) => {
        const siguiente = titulo.nextElementSibling as HTMLElement;
        return {
          titulo: (titulo.textContent ?? "").trim(),
          aire: Math.round(siguiente.getBoundingClientRect().top - titulo.getBoundingClientRect().bottom),
        };
      })
    );
    expect(aires.map((a) => a.titulo).sort()).toEqual(
      ["Cómo cambió el riesgo", "Historial de alertas", "Métricas de la sesión", "Momentos para revisar"].sort()
    );
    expect(new Set(aires.map((a) => a.aire)).size, JSON.stringify(aires)).toBe(1);
  });
}

test("a 390 px, en el registro apilado la hora y el título del evento quedan a la misma altura", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: ALTO });
  await abrir(page, VISTAS.detalleAlto);
  // Se mide el texto y no la celda: lo que se veía corrido era la hora respecto del título.
  const corrimientos = await page.evaluate(() => {
    const arribaDelTexto = (e: Element) => {
      const rango = document.createRange();
      rango.selectNodeContents(e);
      return rango.getBoundingClientRect().top;
    };
    return [...document.querySelectorAll(".eventos tbody tr")]
      .map((fila) => [fila.querySelector(".eventos__hora"), fila.querySelector(".eventos__titulo")] as const)
      .filter(([hora, titulo]) => hora && titulo)
      .map(([hora, titulo]) => Math.abs(Math.round(arribaDelTexto(hora!) - arribaDelTexto(titulo!))));
  });
  expect(corrimientos.length).toBeGreaterThan(0);
  expect(Math.max(...corrimientos)).toBeLessThanOrEqual(1);
});

test("a 390 px, en el registro apilado el detalle empieza debajo del título y no del ícono", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: ALTO });
  await abrir(page, VISTAS.detalleAlto);
  // En la simulación, los eventos con detalle (los pegados) son los más viejos y quedan fuera de los 50 primeros.
  await page.getByRole("button", { name: "Mostrar todos" }).click();
  const diferencias = await page.evaluate(() =>
    [...document.querySelectorAll(".eventos tbody tr")]
      .map((fila) => [fila.querySelector(".eventos__titulo"), fila.querySelector<HTMLElement>(".eventos__detalle")] as const)
      .filter(([titulo, detalle]) => titulo && detalle && (detalle.textContent ?? "").trim())
      .map(([titulo, detalle]) => {
        const rango = document.createRange();
        rango.selectNodeContents(detalle!);
        return Math.abs(Math.round(rango.getBoundingClientRect().left - titulo!.getBoundingClientRect().left));
      })
  );
  expect(diferencias.length).toBeGreaterThan(0);
  expect(Math.max(...diferencias)).toBeLessThanOrEqual(1);
});

test("a 390 px, las filas del registro sin detalle conservan sus tres celdas para los lectores de pantalla", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.detalleAlto);
  const ancha = await rolesDelArbol(page);
  await page.setViewportSize({ width: 390, height: ALTO });
  const angosta = await rolesDelArbol(page);
  expect(angosta.cell).toBe(ancha.cell);
});

test("a 390 px, tabulando hacia adelante, el anillo de foco de lo que entra por el pie se ve entero", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: ALTO });
  await abrir(page, VISTAS.lista);
  const cortados: string[] = [];
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    await desplazamientoQuieto(page);
    const medida = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      if (!el || el === document.body || el.closest(".barra")) return null;
      const r = el.getBoundingClientRect();
      // El anillo son 4 px afuera del elemento (2 blancos y 2 celestes).
      return { cortado: r.bottom + 4 > window.innerHeight, que: `${el.tagName.toLowerCase()} ${Math.round(r.bottom)} / ${window.innerHeight}` };
    });
    if (medida?.cortado) cortados.push(medida.que);
  }
  expect(cortados).toEqual([]);
});

test("«Ver en el registro» lleva a una fila con el mismo nombre, y el foco se ve en sus cuatro lados", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.detalleAlto);
  const momentos = page.locator(".momentos__momento");
  const cuantos = await momentos.count();
  expect(cuantos).toBeGreaterThan(0);
  for (let i = 0; i < cuantos; i++) {
    const titulo = (await momentos.nth(i).locator(".momentos__titulo").textContent())?.trim();
    await momentos.nth(i).getByRole("button").focus();
    await page.keyboard.press("Enter");
    const fila = page.locator("tr.eventos__fila--destacada");
    await expect(fila).toBeFocused();
    expect((await fila.locator(".eventos__titulo").textContent())?.trim()).toBe(titulo);
  }
  // El anillo de la fila es un contorno hacia adentro: se pinta entero, arriba, abajo y a los costados.
  const fila = page.locator("tr.eventos__fila--destacada");
  const contorno = await fila.evaluate((f) => {
    const e = getComputedStyle(f);
    return { estilo: e.outlineStyle, ancho: parseFloat(e.outlineWidth), corrimiento: parseFloat(e.outlineOffset), color: e.outlineColor };
  });
  expect(contorno.estilo).toBe("solid");
  expect(contorno.ancho).toBeGreaterThanOrEqual(2);
  expect(contorno.corrimiento).toBeLessThanOrEqual(-contorno.ancho);
  expect(contorno.color).toBe(CELESTE);
  // Y se ve: en una captura de la fila, los cuatro bordes tienen el celeste.
  const imagen = await fila.screenshot();
  const pixeles = await page.evaluate(async (datos) => {
    const img = new Image();
    img.src = `data:image/png;base64,${datos}`;
    await img.decode();
    const lienzo = document.createElement("canvas");
    lienzo.width = img.width;
    lienzo.height = img.height;
    const ctx = lienzo.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const en = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3)).join(",");
    const medio = { x: Math.floor(img.width / 2), y: Math.floor(img.height / 2) };
    return {
      arriba: en(medio.x, 1),
      abajo: en(medio.x, img.height - 2),
      izquierda: en(1, medio.y),
      derecha: en(img.width - 2, medio.y),
    };
  }, imagen.toString("base64"));
  for (const lado of Object.values(pixeles)) expect(lado).toBe("0,140,178");
});

for (const [nombre, vista] of [
  ["la lista", VISTAS.lista],
  ["el detalle con alertas", VISTAS.detalleAlto],
  ["el detalle que no se pudo analizar", VISTAS.detalleNoSePudo],
  ["el detalle en curso", VISTAS.detalleEnCurso],
] as const) {
  test(`los textos a la vista en ${nombre} pasan las listas de las rondas`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: ALTO });
    await abrir(page, vista);
    // Por elemento, como expectLenguajeLlano: sus nodos de texto propios y sus nombres accesibles. La
    // explicación del motor se muestra tal cual y no es texto del panel. La marca y el aviso de captura son
    // textos del Sprint 3 que quedan fuera de esta revisión (a decisión de Facundo).
    const textos = await page.evaluate(() => {
      const espacios = (t: string) => t.replace(/\s+/g, " ").trim();
      const todos: string[] = [];
      // Toda la página, no solo `main`: la barra y el pie también los lee el docente (L11).
      for (const el of document.querySelectorAll("body *")) {
        if (el.closest("script, style, noscript")) continue;
        if (el.closest(".explicacion, .alumno__captura, .detalle__captura")) continue;
        const propio = espacios(
          [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? "").join(" ")
        );
        if (propio) todos.push(propio);
        for (const atributo of ["aria-label", "title"]) {
          const valor = espacios(el.getAttribute(atributo) ?? "");
          if (valor) todos.push(valor);
        }
      }
      return todos;
    });
    expect(textos.length).toBeGreaterThan(10);
    expect(choquesConLasListas(textos)).toEqual([]);
  });
}
