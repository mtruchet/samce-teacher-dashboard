import { expect, test, type Page } from "@playwright/test";
import { abrir, simularBackend, VISTAS } from "./simulacion";

/**
 * El fondo de la página del panel bajó un escalón, de --sup-2 a --sup-3 (13/11), para que la lámina de apoyo del
 * registro se despegue. Lo que va directo sobre la página tiene que seguir llegando a 4,5:1 (WCAG 1.4.3): las
 * migas, el título, la ficha de la sesión, el pulso, los avisos y las notas. La landing no cambia. El backend va
 * simulado (ver simulacion.ts).
 */

const ALTO = 844;

test.beforeEach(async ({ page }) => {
  await simularBackend(page);
});

/**
 * Cada texto de la página cuyo fondo efectivo es el de la página misma (ningún antepasado pinta un fondo propio),
 * con su relación de contraste contra ese fondo. El color del texto se compone sobre el fondo si es translúcido.
 */
async function textosSobreLaPagina(page: Page) {
  return page.evaluate(() => {
    const leer = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([x, y, z]: number[]) => {
      const canal = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * canal(x) + 0.7152 * canal(y) + 0.0722 * canal(z);
    };
    const contraste = (adelante: string, fondo: string) => {
      const [r, g, b, a = 1] = leer(adelante);
      const [R, G, B] = leer(fondo);
      const mezcla = [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)];
      const [claro, oscuro] = [lum(mezcla), lum([R, G, B])].sort((p, q) => q - p);
      return (claro + 0.05) / (oscuro + 0.05);
    };
    const pagina = getComputedStyle(document.body).backgroundColor;
    const opaco = (c: string) => c !== "rgba(0, 0, 0, 0)" && c !== "transparent";
    const hallados: { texto: string; clase: string; relacion: number }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("main *")) {
      const propio = [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? "")
        .join("")
        .trim();
      if (!propio) continue;
      const caja = el.getBoundingClientRect();
      if (caja.width === 0 || caja.height === 0 || getComputedStyle(el).visibility === "hidden") continue;
      let fondoPropio = false;
      for (let a: HTMLElement | null = el; a && a !== document.body; a = a.parentElement) {
        if (opaco(getComputedStyle(a).backgroundColor)) {
          fondoPropio = true;
          break;
        }
      }
      if (fondoPropio) continue;
      hallados.push({
        texto: propio.slice(0, 40),
        clase: el.className.toString(),
        relacion: Math.round(contraste(getComputedStyle(el).color, pagina) * 100) / 100,
      });
    }
    return { pagina, hallados };
  });
}

for (const ancho of [1280, 390]) {
  for (const [nombre, vista] of [
    ["la lista", VISTAS.lista],
    ["la lista filtrada", VISTAS.listaRiesgoAlto],
    ["el detalle con alertas", VISTAS.detalleAlto],
    ["el detalle con un aviso de captura", VISTAS.detalleNoSePudo],
    ["el detalle en curso", VISTAS.detalleEnCurso],
  ] as const) {
    test(`a ${ancho} px, en ${nombre} todo texto directo sobre la página llega a 4,5:1`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: ALTO });
      await abrir(page, vista);
      const { pagina, hallados } = await textosSobreLaPagina(page);
      // La página es --sup-3 (#eef5f7).
      expect(pagina).toBe("rgb(238, 245, 247)");
      // Hay algo que medir: al menos las migas y el título.
      expect(hallados.length).toBeGreaterThan(1);
      expect(hallados.filter((h) => h.relacion < 4.5)).toEqual([]);
    });
  }
}

test("la lámina de apoyo del registro tiene otro fondo que la página, y la del análisis también", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await abrir(page, VISTAS.detalleAlto);
  const fondos = await page.evaluate(() => ({
    pagina: getComputedStyle(document.body).backgroundColor,
    apoyo: getComputedStyle(document.querySelector(".lamina--apoyo")!).backgroundColor,
    analisis: getComputedStyle(document.querySelector(".detalle .lamina:not(.lamina--apoyo)")!).backgroundColor,
  }));
  expect(fondos.apoyo).toBe("rgb(247, 251, 252)");
  expect(fondos.analisis).toBe("rgb(255, 255, 255)");
  expect(new Set(Object.values(fondos)).size).toBe(3);
});

test("la landing no cambia de fondo: su página sigue en --sup-1", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: ALTO });
  await page.goto("/");
  await page.locator("footer").waitFor();
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(255, 255, 255)");
});
