import { test } from "@playwright/test";
import { abrir, simularBackend, VISTAS } from "./simulacion";

/**
 * Capturas para revisar a ojo el hilo conductor (no son una prueba): la lista, la lista filtrada por «Sin
 * alertas» y tres detalles, a 1280 y a 390 px. Solo corren si se indica la carpeta de destino:
 *
 *   CAPTURAS=ruta/a/la/carpeta npx playwright test capturas
 *
 * Sin la variable se saltean, así la CI no escribe archivos.
 */
const DESTINO = process.env.CAPTURAS;

const PANTALLAS = [
  ["lista", VISTAS.lista],
  ["lista-sin-alertas", VISTAS.listaSinAlertas],
  ["detalle-riesgo-alto", VISTAS.detalleAlto],
  ["detalle-no-analizado", VISTAS.detalleNoAnalizado],
  ["detalle-en-curso", VISTAS.detalleEnCurso],
] as const;

for (const ancho of [1280, 390]) {
  for (const [nombre, vista] of PANTALLAS) {
    test(`captura ${nombre} a ${ancho} px`, async ({ page }) => {
      test.skip(!DESTINO, "sin carpeta de destino (CAPTURAS)");
      await simularBackend(page);
      await page.setViewportSize({ width: ancho, height: 900 });
      await abrir(page, vista);
      await page.screenshot({ path: `${DESTINO}/${nombre}-${ancho}.png`, fullPage: true });
    });
  }
}
