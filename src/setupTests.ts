import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";

// Las pantallas se cargan con `lazy`: la primera prueba que entra a una paga
// la transformación del módulo dentro del plazo de `findBy`. Con el segundo por
// defecto, una máquina cargada hacía fallar pruebas que en la corrida
// siguiente pasaban.
configure({ asyncUtilTimeout: 3000 });

// Sin esto, @testing-library/react no desmonta los componentes entre tests
// del mismo archivo cuando vitest no corre con `globals: true` (no es el
// caso acá), y los renders se van acumulando en el DOM entre tests.
afterEach(() => {
  cleanup();
});
