import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { evento } from "../test/fabricas";
import { ListaEventos, TANDA } from "./ListaEventos";

/** `n` eventos de mouse seguidos, cinco segundos uno del otro, sin silencios entre medio. */
function eventos(n: number) {
  return Array.from({ length: n }, (_, i) =>
    evento(i + 1, i === 0 ? "clipboard" : "mouse_activity", i === 0 ? { action: "paste", slot: 3, length: 301 } : { moves: 3 }, {
      received_at: new Date(Date.parse("2026-11-03T12:28:00.000Z") + i * 5000).toISOString(),
    })
  );
}

function filas() {
  return screen.getAllByRole("row").slice(1);
}

describe("ListaEventos", () => {
  it("con pocos eventos los muestra todos y no ofrece ver más", () => {
    render(<ListaEventos eventos={eventos(12)} />);

    expect(filas()).toHaveLength(12);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/Se ven los/)).not.toBeInTheDocument();
  });

  it("con muchos muestra los más recientes, dice cuántos de cuántos y deja llegar al resto", () => {
    render(<ListaEventos eventos={eventos(194)} />);

    expect(filas()).toHaveLength(TANDA);
    expect(screen.getByText(`Se ven los ${TANDA} eventos más recientes de 194.`)).toBeInTheDocument();
    // El primero del examen (el pegado, el más viejo) todavía no se ve.
    expect(screen.queryByText("Pegó un texto")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: `Mostrar ${TANDA} más` }));
    expect(filas()).toHaveLength(2 * TANDA);

    fireEvent.click(screen.getByRole("button", { name: "Mostrar todos" }));
    expect(filas()).toHaveLength(194);
    expect(screen.getByText("Pegó un texto")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("el último «Mostrar más» dice cuántos quedan, no la tanda entera", () => {
    render(<ListaEventos eventos={eventos(TANDA + 7)} />);

    fireEvent.click(screen.getByRole("button", { name: "Mostrar 7 más" }));
    expect(filas()).toHaveLength(TANDA + 7);
  });

  it("no junta ni esconde filas por su tipo: las de mouse se ven igual que las demás", () => {
    render(<ListaEventos eventos={eventos(30)} />);

    const deMouse = screen.getAllByText("Movimiento del mouse");
    expect(deMouse).toHaveLength(29);
    for (const fila of filas()) expect(fila.className).toBe("");
  });

  it("sin desplazamiento interno: la tabla crece con la página", () => {
    const { container } = render(<ListaEventos eventos={eventos(194)} />);

    const marco = container.querySelector(".eventos__marco") as HTMLElement;
    expect(marco.style.maxHeight).toBe("");
  });
});
