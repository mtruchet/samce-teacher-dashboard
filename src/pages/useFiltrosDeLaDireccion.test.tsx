import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { useFiltrosDeLaDireccion } from "./useFiltrosDeLaDireccion";

function conRouter(inicial: string) {
  return ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[inicial]}>{children}</MemoryRouter>;
}

function useConDireccion() {
  return { ...useFiltrosDeLaDireccion(), busqueda: useLocation().search };
}

describe("useFiltrosDeLaDireccion", () => {
  it("dos cambios seguidos, antes de que se confirme la dirección, parten uno del otro", () => {
    const { result } = renderHook(useConDireccion, { wrapper: conRouter("/panel?examen=7") });
    const { aplicarFiltros } = result.current;
    act(() => {
      // La misma función de la misma vuelta, dos veces: la segunda no puede partir de la dirección vieja.
      aplicarFiltros({ nivel: "high" });
      aplicarFiltros({ q: "Ana" });
    });
    expect(result.current.busqueda).toBe("?examen=7&nivel=high&q=Ana");
  });

  it("«Quitar filtros» conserva el orden", () => {
    const { result } = renderHook(useConDireccion, {
      wrapper: conRouter("/panel?examen=7&nivel=low&q=Ana&orden=risk_level"),
    });
    act(() => result.current.quitarFiltros());
    expect(result.current.busqueda).toBe("?examen=7&orden=risk_level");
  });
});
