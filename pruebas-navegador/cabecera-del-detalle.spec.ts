import { expect, test } from "@playwright/test";
import { abrir, simularBackend, VISTAS } from "./simulacion";

/**
 * Las cinco mejoras que Facundo aprobó el 13/11 sobre el plan de armonía (su sección «7. Para Facundo»): la ficha
 * de la sesión como renglón de la cabecera, el aviso de captura con caja propia, la frase del veredicto a 15 px,
 * el fondo del panel un escalón más oscuro y el pie con su jerarquía de tintas. Se miden en un navegador porque
 * jsdom no aplica CSS. El backend va simulado (ver simulacion.ts).
 */

const ALTO = 844;

test.beforeEach(async ({ page }) => {
  await simularBackend(page);
});

for (const ancho of [1280, 390]) {
  test(`a ${ancho} px, la ficha de la sesión es un renglón sin caja debajo del nombre, al ras de él`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: ALTO });
    await abrir(page, VISTAS.detalleAlto);
    const m = await page.evaluate(() => {
      const h1 = document.querySelector<HTMLElement>("h1.panel__curso")!.getBoundingClientRect();
      const ficha = document.querySelector<HTMLElement>(".detalle__sesion")!;
      const caja = ficha.getBoundingClientRect();
      const estilo = getComputedStyle(ficha);
      const primera = document.querySelector(".detalle")!.firstElementChild as HTMLElement;
      return {
        h1Izquierda: h1.left,
        h1Abajo: h1.bottom,
        fichaIzquierda: caja.left,
        fichaArriba: caja.top,
        fondo: estilo.backgroundColor,
        sombra: estilo.boxShadow,
        relleno: estilo.paddingLeft,
        letra: estilo.fontSize,
        renglon: estilo.lineHeight,
        primeraEsLamina: primera.classList.contains("lamina"),
      };
    });
    // Al ras del nombre, sin relleno ni caja.
    expect(Math.abs(m.fichaIzquierda - m.h1Izquierda), JSON.stringify(m)).toBeLessThan(1);
    expect(m.fondo).toBe("rgba(0, 0, 0, 0)");
    expect(m.sombra).toBe("none");
    expect(m.relleno).toBe("0px");
    // Justo debajo: el paso chico (--e2), no el de entre láminas.
    expect(m.fichaArriba - m.h1Abajo, JSON.stringify(m)).toBeGreaterThanOrEqual(0);
    expect(m.fichaArriba - m.h1Abajo, JSON.stringify(m)).toBeLessThanOrEqual(8.5);
    // En la escala de una fila (13/20).
    expect(m.letra).toBe("13px");
    expect(m.renglon).toBe("20px");
    // La primera pieza del detalle (sin aviso de captura) ya es la lámina del análisis, no la ficha.
    expect(m.primeraEsLamina).toBe(true);
  });
}

test("a 390 px, en una sesión en curso la ficha va entre el nombre y el pulso", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: ALTO });
  await abrir(page, VISTAS.detalleEnCurso);
  const m = await page.evaluate(() => {
    const abajo = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    return { h1: abajo("h1.panel__curso").bottom, ficha: abajo(".detalle__sesion"), pulso: abajo(".panel__encabezado .enlace").top };
  });
  expect(m.ficha.top).toBeGreaterThanOrEqual(m.h1);
  expect(m.pulso).toBeGreaterThanOrEqual(m.ficha.bottom);
});

test("a 1280 px, en una sesión en curso el pulso sigue a la altura del nombre, a la derecha", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.detalleEnCurso);
  const m = await page.evaluate(() => {
    const caja = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const h1 = caja("h1.panel__curso");
    const pulso = caja(".panel__encabezado .enlace");
    return { h1Arriba: h1.top, h1Abajo: h1.bottom, pulsoArriba: pulso.top, pulsoIzquierda: pulso.left, ficha: caja(".detalle__sesion").right };
  });
  expect(m.pulsoArriba).toBeLessThan(m.h1Abajo);
  expect(m.pulsoArriba).toBeGreaterThanOrEqual(m.h1Arriba - 1);
  expect(m.pulsoIzquierda).toBeGreaterThan(m.ficha);
});

for (const ancho of [1280, 390]) {
  test(`a ${ancho} px, el aviso de captura va en su caja, con el texto al ras del de las láminas y 4,5:1 o más`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: ALTO });
    await abrir(page, VISTAS.detalleNoSePudo);
    const m = await page.evaluate(() => {
      const aviso = document.querySelector<HTMLElement>(".detalle__captura")!;
      const e = getComputedStyle(aviso);
      const lamina = document.querySelector<HTMLElement>(".detalle .lamina")!;
      const titulo = lamina.querySelector<HTMLElement>(".lamina__titulo")!;
      const rango = document.createRange();
      rango.selectNodeContents(aviso);
      return {
        fondo: e.backgroundColor,
        pagina: getComputedStyle(document.body).backgroundColor,
        radio: e.borderTopLeftRadius,
        radioLamina: getComputedStyle(lamina).borderTopLeftRadius,
        sombra: e.boxShadow,
        bordeIzquierdo: e.borderLeftWidth,
        color: e.color,
        fuerte: getComputedStyle(aviso.querySelector("strong")!).color,
        cajaIzquierda: aviso.getBoundingClientRect().left,
        laminaIzquierda: lamina.getBoundingClientRect().left,
        textoIzquierda: rango.getBoundingClientRect().left,
        tituloIzquierda: titulo.getBoundingClientRect().left,
      };
    });
    // Una caja propia: --sup-1 sobre la página --sup-3, con el anillo, sin la marca, y con las esquinas de la
    // lámina de abajo: ocupa una fila entera de la pila, y con otro radio las esquinas cambiaban de fila a fila.
    expect(m.fondo).toBe("rgb(255, 255, 255)");
    expect(m.fondo).not.toBe(m.pagina);
    expect(m.radio).toBe("16px");
    expect(m.radio).toBe(m.radioLamina);
    expect(m.sombra).toContain("inset");
    expect(m.bordeIzquierdo).toBe("0px");
    // Alineada con las láminas, y su texto con el de ellas.
    expect(Math.abs(m.cajaIzquierda - m.laminaIzquierda)).toBeLessThan(1);
    expect(Math.abs(m.textoIzquierda - m.tituloIzquierda)).toBeLessThan(1);
    // --tinta-media y --tinta sobre blanco.
    expect(m.color).toBe("rgb(62, 83, 91)");
    expect(m.fuerte).toBe("rgb(20, 35, 42)");
  });
}

test("con colores forzados el aviso de captura conserva su contorno", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.detalleNoSePudo);
  const contorno = await page.locator(".detalle__captura").evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(contorno).toBe("solid");
});

for (const [ancho, cuadro] of [[1280, 56], [390, 40]] as const) {
  test(`a ${ancho} px, la frase del veredicto va a 15/20, debajo del título de la lámina, con el cuadro de ${cuadro} px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: ALTO });
    await abrir(page, VISTAS.detalleAlto);
    const m = await page.evaluate(() => {
      const frase = document.querySelector<HTMLElement>(".veredicto__frase")!;
      const icono = document.querySelector<HTMLElement>(".veredicto__icono")!.getBoundingClientRect();
      const titulo = frase.closest(".lamina")!.querySelector<HTMLElement>(".lamina__titulo")!;
      const rango = document.createRange();
      rango.selectNodeContents(frase);
      const primerRenglon = rango.getClientRects()[0];
      const e = getComputedStyle(frase);
      return {
        letra: e.fontSize,
        renglon: e.lineHeight,
        titulo: getComputedStyle(titulo).fontSize,
        bajada: getComputedStyle(document.querySelector(".veredicto__bajada")!).fontSize,
        cuadro: [Math.round(icono.width), Math.round(icono.height)],
        // El centro del primer renglón de la frase contra el centro del cuadro.
        desvio: Math.abs(primerRenglon.top + primerRenglon.height / 2 - (icono.top + icono.height / 2)),
      };
    });
    expect(m.letra).toBe("15px");
    expect(m.renglon).toBe("20px");
    expect(parseFloat(m.titulo)).toBeGreaterThan(15);
    expect(parseFloat(m.bajada)).toBeLessThan(15);
    expect(m.cuadro).toEqual([cuadro, cuadro]);
    expect(m.desvio, JSON.stringify(m)).toBeLessThanOrEqual(2);
  });
}
