import { defineConfig, devices } from "@playwright/test";

/**
 * Las pruebas que solo se pueden hacer en un navegador de verdad: el foco, los colores forzados y el ancho
 * de un teléfono (390 px). Las de componentes corren en jsdom con Vitest; estas, en Chromium sin ventana.
 *
 * El panel se construye aparte (dist-navegador) con la API apuntando a «/api» del mismo origen, y cada
 * prueba contesta esos pedidos con datos falsos (page.route). Nunca se habla con el backend real.
 *
 * El puerto es el 4317 a propósito: el 5173 es el del servidor de desarrollo y los 8000, 8001 y 8080 son
 * del backend y del campus en la máquina de trabajo.
 */
const PUERTO = 4317;

export default defineConfig({
  testDir: "./pruebas-navegador",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    trace: "retain-on-failure",
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx vite build --outDir dist-navegador --emptyOutDir && npx vite preview --outDir dist-navegador --port ${PUERTO} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PUERTO}`,
    // Siempre uno propio: reusar uno levantado a mano podría servir una construcción contra otra API.
    reuseExistingServer: false,
    timeout: 180_000,
    env: { VITE_API_URL: "/api", VITE_MOODLE_URL: "http://campus.simulado.invalid" },
  },
});
