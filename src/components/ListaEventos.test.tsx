import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("lleva a una fila que no estaba entre las visibles: la muestra, le da el foco y la resalta", () => {
    const muchos = Array.from({ length: TANDA + 20 }, (_, i) => evento(i + 1, "keystroke", { count: 1 }));
    const { rerender } = render(<ListaEventos eventos={muchos} />);
    // La primera fila del registro es la más reciente: la del id 1 queda fuera de la primera tanda.
    expect(document.getElementById("evento-1")).toBeNull();

    rerender(<ListaEventos eventos={muchos} destacado={{ id: 1, vez: 1 }} />);
    const fila = document.getElementById("evento-1");
    expect(fila).not.toBeNull();
    expect(fila).toHaveFocus();
    expect(fila).toHaveClass("eventos__fila--destacada");
  });

  it("después del salto, «Mostrar N más» deja el foco en el botón", () => {
    const muchos = Array.from({ length: TANDA * 3 }, (_, i) => evento(i + 1, "keystroke", { count: 1 }));
    const { rerender } = render(<ListaEventos eventos={muchos} />);
    rerender(<ListaEventos eventos={muchos} destacado={{ id: TANDA * 3, vez: 1 }} />);
    const boton = screen.getByRole("button", { name: `Mostrar ${TANDA} más` });
    boton.focus();
    fireEvent.click(boton);
    expect(document.getElementById(`evento-${TANDA * 3}`)).not.toHaveFocus();
  });

  it("después del salto, un evento nuevo no le saca el foco al docente", () => {
    const muchos = Array.from({ length: TANDA * 3 }, (_, i) => evento(i + 1, "keystroke", { count: 1 }));
    const { rerender } = render(<ListaEventos eventos={muchos} />);
    // La fila pedida queda justo en el borde de lo que se ve: un evento nuevo arriba la empuja afuera.
    rerender(<ListaEventos eventos={muchos} destacado={{ id: TANDA * 2, vez: 1 }} />);
    const boton = screen.getByRole("button", { name: "Mostrar todos" });
    boton.focus();
    const mas = [...muchos, evento(TANDA * 3 + 1, "keystroke", { count: 1 })];
    rerender(<ListaEventos eventos={mas} destacado={{ id: TANDA * 2, vez: 1 }} />);
    expect(boton).toHaveFocus();
  });

  it("pedir de nuevo el mismo evento vuelve a llevar el foco", () => {
    const muchos = Array.from({ length: TANDA * 3 }, (_, i) => evento(i + 1, "keystroke", { count: 1 }));
    const { rerender } = render(<ListaEventos eventos={muchos} destacado={{ id: TANDA * 2, vez: 1 }} />);
    screen.getByRole("button", { name: "Mostrar todos" }).focus();
    rerender(<ListaEventos eventos={muchos} destacado={{ id: TANDA * 2, vez: 2 }} />);
    expect(document.getElementById(`evento-${TANDA * 2}`)).toHaveFocus();
  });
  describe("salto y anuncios", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("dos saltos seguidos dejan una sola fila resaltada, y a los dos segundos ninguna", () => {
      vi.useFakeTimers();
      const lista = eventos(10);
      const { container, rerender } = render(<ListaEventos eventos={lista} />);

      rerender(<ListaEventos eventos={lista} destacado={{ id: 3, vez: 1 }} />);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      rerender(<ListaEventos eventos={lista} destacado={{ id: 5, vez: 2 }} />);

      const resaltadas = container.querySelectorAll(".eventos__fila--destacada");
      expect(resaltadas).toHaveLength(1);
      expect(resaltadas[0].id).toBe("evento-5");
      expect(document.getElementById("evento-5")).toHaveFocus();

      // El temporizador del primer salto se canceló: a los 1,5 s del segundo la fila sigue resaltada.
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(container.querySelectorAll(".eventos__fila--destacada")).toHaveLength(1);

      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(container.querySelectorAll(".eventos__fila--destacada")).toHaveLength(0);
    });

    it("un evento nuevo no reescribe la región viva, y «Mostrar 50 más» pone la frase en un nodo nuevo", () => {
      const { rerender } = render(<ListaEventos eventos={eventos(194)} />);
      const region = screen.getByRole("status", { name: "Eventos a la vista" });
      const antes = region.firstChild;
      expect(region).toHaveTextContent("");

      // Llega un evento: la cifra visible cambia, la región viva no.
      rerender(<ListaEventos eventos={eventos(195)} />);
      expect(screen.getByText(`Se ven los ${TANDA} eventos más recientes de 195.`)).toBeInTheDocument();
      expect(region.firstChild).toBe(antes);
      expect(region).toHaveTextContent("");
      // El texto visible ya no es una región viva.
      expect(screen.getByText(`Se ven los ${TANDA} eventos más recientes de 195.`)).not.toHaveAttribute("role");

      fireEvent.click(screen.getByRole("button", { name: `Mostrar ${TANDA} más` }));
      expect(region.firstChild).not.toBe(antes);
      expect(region).toHaveTextContent(`Se ven los ${2 * TANDA} eventos más recientes de 195.`);
    });
  });
});

