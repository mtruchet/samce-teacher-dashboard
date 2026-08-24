import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Sin esto, @testing-library/react no desmonta los componentes entre tests
// del mismo archivo cuando vitest no corre con `globals: true` (no es el
// caso acá), y los renders se van acumulando en el DOM entre tests.
afterEach(() => {
  cleanup();
});
