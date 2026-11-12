import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NIVELES_DE_RIESGO } from "../services/sesionesService";
import { expectLenguajeLlano } from "../test/lenguaje";
import { RotuloNivel } from "./RotuloNivel";

describe("RotuloNivel", () => {
  it.each(NIVELES_DE_RIESGO.map((nivel, i) => [nivel, i + 1] as const))(
    "%s: «Riesgo …» escrito, el medidor oculto con %i segmentos llenos y el tono de data-nivel",
    (nivel, llenos) => {
      const { container } = render(<RotuloNivel nivel={nivel} />);
      const rotulo = container.querySelector(".rotulo-nivel")!;
      expect(rotulo).toHaveAttribute("data-nivel", nivel);
      expect(rotulo.querySelector(".rotulo-nivel__nivel")?.textContent).toMatch(/^Riesgo (bajo|medio|alto)$/);
      expect(rotulo.querySelector(".medidor")).toHaveAttribute("aria-hidden", "true");
      expect(rotulo.querySelectorAll(".medidor__segmento--lleno")).toHaveLength(llenos);
      expect(rotulo.querySelector(".rotulo-nivel__separador")).toBeNull();
    }
  );

  it("con complemento, una línea vertical oculta y el complemento aparte", () => {
    const { container } = render(<RotuloNivel nivel="high" complemento="En toda la sesión" />);
    expect(container.querySelector(".rotulo-nivel__separador")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".rotulo-nivel__complemento")).toHaveTextContent("En toda la sesión");
    expect(container.querySelector(".rotulo-nivel")).toHaveTextContent("Riesgo alto En toda la sesión");
    expectLenguajeLlano(container);
  });
});
