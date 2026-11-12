/**
 * Lo único de Node que usan las pruebas de navegador y playwright.config.ts: las variables de entorno (CI y
 * CAPTURAS). Se declara acá para no sumar @types/node como dependencia solo por esto.
 */
declare const process: { env: Record<string, string | undefined> };
