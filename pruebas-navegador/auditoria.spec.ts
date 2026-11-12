import { expect, test, type Page } from "@playwright/test";
import { abrir, simularBackend, VISTAS } from "./simulacion";

/**
 * Lo que encontró la auditoría en vivo del 12/11 y solo se ve en un navegador: la grilla del bloque de control,
 * el ancho de 320 px (1280 al 400 %, WCAG 1.4.10), el encabezado del registro a 390 px, el foco sobre la barra
 * oscura, el contraste del pie, el foco al pasar de la lista al detalle y la parada de más del registro. El
 * backend va simulado (ver simulacion.ts).
 */

const ALTO = 844;

test.beforeEach(async ({ page }) => {
  await simularBackend(page);
});

/** Relación de contraste WCAG entre dos colores `rgb(...)`/`rgba(...)`, con el de adelante compuesto sobre el fondo. */
function contraste(adelante: string, fondo: string): number {
  const leer = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
  const [r, g, b, a = 1] = leer(adelante);
  const [R, G, B] = leer(fondo);
  const mezcla = [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)];
  const lum = ([x, y, z]: number[]) => {
    const canal = (v: number) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * canal(x) + 0.7152 * canal(y) + 0.0722 * canal(z);
  };
  const [claro, oscuro] = [lum(mezcla), lum([R, G, B])].sort((p, q) => q - p);
  return (claro + 0.05) / (oscuro + 0.05);
}

test("V2: a 1280 px, las tarjetas del resumen y los controles de la barra caen sobre las mismas columnas", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.lista);
  const medidas = await page.evaluate(() => {
    const caja = (e: Element) => {
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.left), w: Math.round(r.width) };
    };
    return {
      niveles: [...document.querySelectorAll(".resumen__tarjetas--niveles .resumen__tarjeta")].map(caja),
      estados: [...document.querySelectorAll(".resumen__tarjetas--estados .resumen__tarjeta")].map(caja),
      controles: [...document.querySelectorAll(".filtros__campo")].map(caja),
    };
  });
  expect(medidas.niveles).toHaveLength(3);
  expect(medidas.estados).toHaveLength(4);
  expect(medidas.controles).toHaveLength(4);
  const cerca = (a: number, b: number) => Math.abs(a - b) <= 1;
  medidas.estados.forEach((e, i) => {
    expect(cerca(e.x, medidas.controles[i].x), JSON.stringify(medidas)).toBe(true);
    expect(cerca(e.w, medidas.controles[i].w), JSON.stringify(medidas)).toBe(true);
  });
  medidas.niveles.forEach((n, i) => {
    expect(cerca(n.x, medidas.controles[i].x), JSON.stringify(medidas)).toBe(true);
    expect(cerca(n.w, medidas.controles[i].w), JSON.stringify(medidas)).toBe(true);
  });
});

for (const ancho of [320, 390]) {
  test(`V4, A3: a ${ancho} px, nada de la celda del alumno se sale de su celda y la marca de captura va en un renglón`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: ALTO });
    await abrir(page, VISTAS.lista);
    // Los datos reales tienen duraciones y nombres más largos que los simulados: se ponen en la fila con la
    // marca de captura, que es la que se salía de su celda.
    await page.evaluate(() => {
      const fila = document.querySelector(".alumno__captura")!.closest("tr")!;
      fila.querySelector(".alumno__nombre")!.textContent = "Valentina Castro Ledesma";
      const duracion = fila.querySelector("td.tabla__duracion .cifra, td.tabla__duracion")!;
      duracion.textContent = "197 h 21 min";
    });
    const problemas = await page.evaluate(() => {
      const hallados: string[] = [];
      for (const td of document.querySelectorAll(".lista tbody td:first-child")) {
        const celda = td.getBoundingClientRect();
        for (const parte of td.querySelectorAll(".alumno__nombre, .alumno__captura, .alumno__pie")) {
          const r = parte.getBoundingClientRect();
          if (r.right > celda.right + 1) hallados.push(`${parte.className} «${parte.textContent}» ${Math.round(r.right)} > ${Math.round(celda.right)}`);
        }
        // Lo que va a la derecha del alumno no se le monta encima.
        const fila = td.closest("tr")!;
        for (const otra of fila.querySelectorAll("td.tabla__duracion, td.tabla__eventos")) {
          const o = otra.getBoundingClientRect();
          const a = td.getBoundingClientRect();
          const seCruzan = o.left < a.right - 1 && o.right > a.left + 1 && o.top < a.bottom - 1 && o.bottom > a.top + 1;
          if (seCruzan) hallados.push(`${otra.className} encima del alumno «${td.textContent}»`);
        }
      }
      for (const marca of document.querySelectorAll<HTMLElement>(".alumno__captura")) {
        const alto = marca.getBoundingClientRect().height;
        const renglon = parseFloat(getComputedStyle(marca).lineHeight) || 18;
        if (alto > renglon * 1.6) hallados.push(`marca de captura en más de un renglón (${Math.round(alto)} px)`);
      }
      return { hallados, marcas: document.querySelectorAll(".alumno__captura").length };
    });
    expect(problemas.marcas).toBeGreaterThan(0);
    expect(problemas.hallados).toEqual([]);
    const medidas = await page.evaluate(() => ({
      ancho: document.documentElement.scrollWidth,
      visible: document.documentElement.clientWidth,
    }));
    expect(medidas.ancho).toBe(medidas.visible);
  });
}

test("V8: a 390 px, la cuenta del registro va entera en su renglón, debajo del título", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: ALTO });
  await abrir(page, VISTAS.detalleAlto);
  const medidas = await page.evaluate(() => {
    const titulo = document.getElementById("registro-de-eventos-titulo")!.getBoundingClientRect();
    const cuenta = document.querySelector(".detalle__cuenta")!;
    const rangos = [...cuenta.getClientRects()];
    const r = cuenta.getBoundingClientRect();
    return { renglones: new Set(rangos.map((x) => Math.round(x.top))).size, izquierda: r.left, arriba: r.top, tituloIzquierda: titulo.left, tituloAbajo: titulo.bottom };
  });
  expect(medidas.renglones).toBe(1);
  expect(Math.abs(medidas.izquierda - medidas.tituloIzquierda)).toBeLessThanOrEqual(1);
  expect(medidas.arriba).toBeGreaterThanOrEqual(medidas.tituloAbajo - 1);
});

test("A1: sobre la barra oscura, el anillo de foco llega a 3:1 contra su fondo", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.lista);
  const salir = page.locator(".barra button, .barra a").last();
  await salir.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const { sombra, fondo } = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    return {
      sombra: getComputedStyle(el).boxShadow,
      fondo: getComputedStyle(document.querySelector(".barra")!).backgroundColor,
    };
  });
  // La capa de afuera es la última de la sombra.
  const capas = sombra.match(/rgba?\([^)]+\)/g) ?? [];
  expect(capas.length).toBeGreaterThanOrEqual(2);
  expect(contraste(capas[capas.length - 1], fondo)).toBeGreaterThanOrEqual(3);
});

test("A8: el texto chico del pie llega a 4,5:1 sobre su fondo", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.lista);
  const pares = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".pie__descripcion, .pie__titulo, .pie__rol")].map((e) => ({
      color: getComputedStyle(e).color,
      fondo: getComputedStyle(e.closest(".pie")!).backgroundColor,
    }))
  );
  expect(pares.length).toBeGreaterThan(0);
  for (const { color, fondo } of pares) expect(contraste(color, fondo), `${color} sobre ${fondo}`).toBeGreaterThanOrEqual(4.5);
});

test("A2: «Ver» lleva el foco al nombre del alumno y cambia el título; Atrás lo devuelve a ese «Ver»", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.lista);
  const ver = page.getByRole("button", { name: /^Ver la sesión de Lucía Ferreyra/ });
  await ver.click();
  const h1 = page.getByRole("heading", { level: 1, name: "Lucía Ferreyra" });
  await expect(h1).toBeFocused();
  await expect(page).toHaveTitle("Lucía Ferreyra — SAMCE");

  await page.goBack();
  await expect(page.getByRole("button", { name: /^Ver la sesión de Lucía Ferreyra/ })).toBeFocused();
  await expect(page).toHaveTitle("Primer parcial — SAMCE");
});

test("A6: el marco del registro, que no se desplaza, no es una parada del tabulador", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.detalleAlto);
  expect(await page.locator(".eventos__marco").getAttribute("tabindex")).toBeNull();
  await page.locator(".momentos__ir").last().focus();
  await page.keyboard.press("Tab");
  const enfocado = await page.evaluate(() => (document.activeElement as HTMLElement).className);
  expect(enfocado).not.toContain("eventos__marco");
});

test("V7: la tabla con desplazamiento interno lleva la sombra que avisa que siguen filas abajo", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.lista);
  const marco = page.locator(".lista__marco").last();
  const { desplaza, adjunto, imagen } = await marco.evaluate((m) => ({
    desplaza: m.scrollHeight > m.clientHeight,
    adjunto: getComputedStyle(m).backgroundAttachment,
    imagen: getComputedStyle(m).backgroundImage,
  }));
  expect(desplaza).toBe(true);
  expect(adjunto).toBe("local, scroll");
  expect(imagen.match(/linear-gradient/g)).toHaveLength(2);
});

test("V6, VR1-05: una tarjeta de nivel sin sesiones va sin el fondo teñido, con el fondo de los estados y el medidor apagado", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.lista);
  // Los datos simulados tienen sesiones en los tres niveles: se marca una como vacía, como lo hace el componente.
  const { vacia, llena, estado, lamina, segmentoVacia, segmentoLlena } = await page.evaluate(() => {
    const [primera, segunda] = document.querySelectorAll<HTMLElement>(".resumen__tarjetas--niveles .resumen__tarjeta");
    primera.classList.add("resumen__tarjeta--cero");
    const lleno = (t: Element) => getComputedStyle(t.querySelector(".medidor__segmento--lleno")!).backgroundColor;
    return {
      vacia: getComputedStyle(primera).backgroundColor,
      llena: getComputedStyle(segunda).backgroundColor,
      estado: getComputedStyle(document.querySelector(".resumen__tarjeta--estado")!).backgroundColor,
      lamina: getComputedStyle(primera.closest(".lamina")!).backgroundColor,
      segmentoVacia: lleno(primera),
      segmentoLlena: lleno(segunda),
    };
  });
  expect(vacia).toBe(estado);
  expect(vacia).not.toBe(lamina);
  expect(llena).not.toBe(estado);
  // El medidor de la vacía no lleva el tono: gris, como su borde.
  expect(segmentoVacia).not.toBe(segmentoLlena);
  const [r, g, b] = (segmentoVacia.match(/\d+/g) ?? []).map(Number);
  expect(Math.max(r, g, b) - Math.min(r, g, b), segmentoVacia).toBeLessThan(40);
});

// ==== Auditoría en vivo 2 (12/11) ========================================================================

/** Deja en la página `__texto(el)`: dónde empieza y termina el texto de un elemento (no su caja, que suma el relleno). */
async function conMedidaDeTexto(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Solo el texto que se ve: lo que es solo para lectores de pantalla queda afuera de la pantalla.
    (window as unknown as { __texto: (el: Element) => { izquierda: number; derecha: number } }).__texto = (el) => {
      let izquierda = Infinity;
      let derecha = -Infinity;
      const recorrido = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let nodo = recorrido.nextNode(); nodo; nodo = recorrido.nextNode()) {
        if (!nodo.textContent?.trim() || nodo.parentElement?.closest(".solo-lectores")) continue;
        const rango = document.createRange();
        rango.selectNodeContents(nodo);
        const r = rango.getBoundingClientRect();
        izquierda = Math.min(izquierda, r.left);
        derecha = Math.max(derecha, r.right);
      }
      return { izquierda, derecha };
    };
  });
}

type ConTexto = { __texto: (el: Element) => { izquierda: number; derecha: number } };

test("VR1-01: a 1280 px, el texto de «Ver» termina donde su rótulo «Eventos»", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.lista);
  await conMedidaDeTexto(page);
  const medidas = await page.evaluate(() => {
    const { __texto: de } = window as unknown as ConTexto;
    const tabla = document.querySelectorAll(".lista table")[0];
    return {
      rotulo: de(tabla.querySelector("th.tabla__eventos")!).derecha,
      ver: [...tabla.querySelectorAll("td.tabla__eventos .boton-texto")].map((b) => de(b).derecha),
    };
  });
  expect(medidas.ver.length).toBeGreaterThan(0);
  for (const ver of medidas.ver) expect(Math.abs(ver - medidas.rotulo), JSON.stringify(medidas)).toBeLessThanOrEqual(1);
});

test("VR1-01: a 390 px, «Ver» y la duración que va debajo terminan en el mismo borde, sin salirse de la fila", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: ALTO });
  await abrir(page, VISTAS.lista);
  await conMedidaDeTexto(page);
  const filas = await page.evaluate(() => {
    const { __texto: de } = window as unknown as ConTexto;
    return [...document.querySelectorAll(".lista tbody tr")].map((tr) => ({
      ver: de(tr.querySelector("td.tabla__eventos .boton-texto")!).derecha,
      duracion: de(tr.querySelector("td.tabla__duracion")!).derecha,
      boton: tr.querySelector("td.tabla__eventos .boton-texto")!.getBoundingClientRect().right,
      fila: tr.getBoundingClientRect().right,
    }));
  });
  expect(filas.length).toBeGreaterThan(0);
  for (const f of filas) {
    expect(Math.abs(f.ver - f.duracion), JSON.stringify(f)).toBeLessThanOrEqual(1);
    expect(f.boton, JSON.stringify(f)).toBeLessThanOrEqual(f.fila + 0.5);
  }
});

test("VR1-02: a 390 px, «Ver en el registro» empieza donde el nombre del momento", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: ALTO });
  await abrir(page, VISTAS.detalleAlto);
  await conMedidaDeTexto(page);
  const momentos = await page.evaluate(() => {
    const { __texto: de } = window as unknown as ConTexto;
    return [...document.querySelectorAll(".momentos__momento")].map((m) => ({
      titulo: de(m.querySelector(".momentos__titulo")!).izquierda,
      ir: de(m.querySelector(".momentos__ir")!).izquierda,
    }));
  });
  expect(momentos.length).toBeGreaterThan(1);
  for (const m of momentos) expect(Math.abs(m.ir - m.titulo), JSON.stringify(m)).toBeLessThanOrEqual(1);
});

test("VR1-03: a 390 px, las tarjetas de estado caen sobre las columnas de los selectores de abajo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: ALTO });
  await abrir(page, VISTAS.lista);
  const medidas = await page.evaluate(() => {
    const caja = (e: Element) => {
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.left), w: Math.round(r.width) };
    };
    return {
      estados: [...document.querySelectorAll(".resumen__tarjetas--estados .resumen__tarjeta")].slice(0, 2).map(caja),
      controles: [...document.querySelectorAll(".filtros__campo")].slice(0, 2).map(caja),
    };
  });
  expect(medidas.estados).toHaveLength(2);
  medidas.estados.forEach((e, i) => {
    expect(Math.abs(e.x - medidas.controles[i].x), JSON.stringify(medidas)).toBeLessThanOrEqual(1);
    expect(Math.abs(e.w - medidas.controles[i].w), JSON.stringify(medidas)).toBeLessThanOrEqual(1);
  });
});

test("VR1-04: con el teclado, el h1 que recibe el foco al abrir una sesión no se dibuja como un botón", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.lista);
  await page.getByRole("button", { name: /^Ver la sesión de Lucía Ferreyra/ }).focus();
  await page.keyboard.press("Enter");
  const h1 = page.getByRole("heading", { level: 1, name: "Lucía Ferreyra" });
  await expect(h1).toBeFocused();
  const { visible, sombra } = await h1.evaluate((el) => ({
    visible: el.matches(":focus-visible"),
    sombra: getComputedStyle(el).boxShadow,
  }));
  expect(visible).toBe(true);
  expect(sombra).toBe("none");
});

test("A11Y-R1-01: a 1280 px, los «Ver en el registro» seguidos no se pisan y cada uno mide al menos 24 px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.detalleAlto);
  const cajas = await page.evaluate(() =>
    [...document.querySelectorAll(".momentos__ir")].map((b) => {
      const r = b.getBoundingClientRect();
      return { arriba: r.top, abajo: r.bottom, alto: r.height };
    })
  );
  expect(cajas.length).toBeGreaterThan(1);
  for (const c of cajas) expect(c.alto).toBeGreaterThanOrEqual(24);
  for (let i = 1; i < cajas.length; i++) {
    expect(cajas[i].arriba, JSON.stringify(cajas)).toBeGreaterThanOrEqual(cajas[i - 1].abajo);
  }
});

test("A11Y-R1-03: al avanzar con Tab por la lista desplazable, el anillo del «Ver» no queda cortado al pie", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await abrir(page, VISTAS.lista);
  const marco = page.locator(".lista__marco").last();
  await marco.locator(".boton-texto").first().focus();
  const total = await marco.locator(".boton-texto").count();
  const cortados: string[] = [];
  for (let i = 1; i < total; i++) {
    await page.keyboard.press("Tab");
    const medida = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const m = el.closest(".lista__marco");
      if (!m) return null;
      return { nombre: el.getAttribute("aria-label"), abajo: el.getBoundingClientRect().bottom, pie: m.getBoundingClientRect().bottom };
    });
    if (medida && medida.abajo + 4 > medida.pie + 0.5) cortados.push(JSON.stringify(medida));
  }
  expect(cortados).toEqual([]);
});

test("A11Y-R1-04: al abrir una sesión desde la lista desplazada, el detalle empieza arriba, con las migas a la vista", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page, VISTAS.lista);
  const ver = page.locator(".lista__marco").last().locator(".boton-texto").last();
  await ver.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await ver.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page.locator(".eventos tbody tr").first().waitFor();
  const medidas = await page.evaluate(() => ({
    y: window.scrollY,
    migas: document.querySelector(".migas")!.getBoundingClientRect().top,
    barra: document.querySelector(".barra")!.getBoundingClientRect().bottom,
  }));
  expect(medidas.y).toBe(0);
  expect(medidas.migas, JSON.stringify(medidas)).toBeGreaterThanOrEqual(medidas.barra);
});

test("LV2-02: el lector de pantalla lee la cuenta del registro y sus extremos separados por la coma", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.detalleAlto);
  const arbol = await page.locator(".detalle__encabezado").ariaSnapshot();
  expect(arbol).toMatch(/\d+ eventos, de \d{2}:\d{2} a \d{2}:\d{2}/);
});

test("QA2-01: la miga del curso y la ficha de un examen llevan el foco al h1 de la vista nueva", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.lista);
  await page.locator(".migas button").first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Álgebra y Geometría Analítica" })).toBeFocused();

  await page.getByRole("main").getByRole("button", { name: /Primer parcial/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Primer parcial" })).toBeFocused();
});
