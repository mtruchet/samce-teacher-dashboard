import { expect, test } from "@playwright/test";
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

test("V6: una tarjeta de nivel sin sesiones va sin el fondo teñido, con el fondo de la lámina", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.lista);
  // Los datos simulados tienen sesiones en los tres niveles: se marca una como vacía, como lo hace el componente.
  const { vacia, llena, lamina } = await page.evaluate(() => {
    const [primera, segunda] = document.querySelectorAll<HTMLElement>(".resumen__tarjetas--niveles .resumen__tarjeta");
    primera.classList.add("resumen__tarjeta--cero");
    return {
      vacia: getComputedStyle(primera).backgroundColor,
      llena: getComputedStyle(segunda).backgroundColor,
      lamina: getComputedStyle(primera.closest(".lamina")!).backgroundColor,
    };
  });
  expect(vacia).toBe(lamina);
  expect(llena).not.toBe(lamina);
});
