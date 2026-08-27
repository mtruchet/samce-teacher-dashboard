/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // El servidor de desarrollo tiene que fallar si el puerto está tomado, en
    // vez de correrse al 5174 en silencio: dos instancias sirviendo versiones
    // distintas del mismo código es la peor forma de perder una tarde.
    strictPort: true,
    watch: {
      // Sondeo en lugar de eventos del sistema de archivos. En Windows los
      // eventos nativos se pierden cuando una herramienta reescribe el archivo
      // entero en vez de modificarlo —lo hacen los formateadores, los scripts
      // y varios editores—, y entonces el servidor sigue sirviendo la versión
      // anterior sin avisar. Cuesta algo de CPU y evita perseguir fantasmas.
      usePolling: true,
      interval: 300,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
  },
});
