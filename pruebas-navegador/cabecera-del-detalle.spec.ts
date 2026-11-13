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
