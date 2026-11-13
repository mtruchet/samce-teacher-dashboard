import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { evento } from "../test/fabricas";
import { expectLenguajeLlano } from "../test/lenguaje";
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

  it("al mostrar todas, el foco va a la primera fila nueva y no vuelve al principio de la página", () => {
    render(<ListaEventos eventos={eventos(194)} />);
    const boton = screen.getByRole("button", { name: "Mostrar todos" });
    boton.focus();
    fireEvent.click(boton);
    // Del más reciente al más viejo: después de los 50 que se veían (194 a 145) sigue el 144.
    expect(document.getElementById("evento-144")).toHaveFocus();
  });

  it("«Mostrar 50 más» lleva el foco a la primera fila nueva, no lo deja en el botón que baja fuera de la pantalla", () => {
    render(<ListaEventos eventos={eventos(194)} />);
    const boton = screen.getByRole("button", { name: `Mostrar ${TANDA} más` });
    boton.focus();
    fireEvent.click(boton);
    // Se veían del 194 al 145: la fila 51 es la del 144, y es una fila, no un botón.
    expect(document.activeElement).toBe(document.getElementById("evento-144"));
    expect(document.activeElement?.tagName).toBe("TR");
  });

  it("los eventos nuevos entran arriba y no sacan la última fila que se veía", () => {
    const { rerender } = render(<ListaEventos eventos={eventos(120)} />);
    const ultima = filas()[filas().length - 1];
    const id = ultima.id;
    rerender(<ListaEventos eventos={eventos(130)} />);
    expect(document.getElementById(id)).toBeInTheDocument();
    expect(filas()).toHaveLength(TANDA + 10);
  });

  it("después de «Mostrar todos», los eventos nuevos no vuelven a esconder nada", () => {
    const { rerender } = render(<ListaEventos eventos={eventos(120)} />);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar todos" }));
    rerender(<ListaEventos eventos={eventos(125)} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(filas()).toHaveLength(125);
  });

  it("la fila a la que se saltó sigue a la vista cuando llegan eventos nuevos", () => {
    const { rerender } = render(<ListaEventos eventos={eventos(120)} destacado={{ id: 1, vez: 1 }} />);
    expect(document.getElementById("evento-1")).toBeInTheDocument();
    rerender(<ListaEventos eventos={eventos(127)} destacado={{ id: 1, vez: 1 }} />);
    expect(document.getElementById("evento-1")).toBeInTheDocument();
  });

  it("la fila con el foco lo conserva cuando llegan eventos nuevos", () => {
    const { rerender } = render(<ListaEventos eventos={eventos(120)} />);
    const fila = filas()[TANDA - 1];
    fila.focus();
    rerender(<ListaEventos eventos={eventos(125)} />);
    expect(document.activeElement).toBe(fila);
  });

  it("un registro que se montó vacío muestra la primera tanda cuando llegan los eventos", () => {
    const { rerender } = render(<ListaEventos eventos={[]} vacio={<p>Nada</p>} />);
    rerender(<ListaEventos eventos={eventos(70)} />);
    expect(filas()).toHaveLength(TANDA);
    expect(screen.getByText(`Se ven los ${TANDA} eventos más recientes de 70.`)).toBeInTheDocument();
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

  it("si la tabla entra en su marco, el marco no es una parada del tabulador ni repite el nombre del registro (A6)", () => {
    const { container } = render(<ListaEventos eventos={eventos(3)} />);
    const marco = container.querySelector(".eventos__marco") as HTMLElement;
    expect(marco).not.toHaveAttribute("tabindex");
    expect(marco).not.toHaveAttribute("role");
    expect(screen.queryByRole("group", { name: "Registro de eventos" })).toBeNull();
  });

  it("si la tabla no entra, el marco se puede enfocar para desplazarlo con el teclado (A6)", () => {
    const ancho = vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(900);
    const visible = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    const { container } = render(<ListaEventos eventos={eventos(3)} />);
    expect(container.querySelector(".eventos__marco")).toHaveAttribute("tabindex", "0");
    ancho.mockRestore();
    visible.mockRestore();
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

  it("después del salto, «Mostrar N más» no vuelve a llevar el foco a la fila del salto", () => {
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

      // Llega un evento: la cifra visible cambia, la región viva no. Entra arriba sin sacar ninguna de abajo.
      rerender(<ListaEventos eventos={eventos(195)} />);
      expect(screen.getByText(`Se ven los ${TANDA + 1} eventos más recientes de 195.`)).toBeInTheDocument();
      expect(region.firstChild).toBe(antes);
      expect(region).toHaveTextContent("");
      // El texto visible ya no es una región viva.
      expect(screen.getByText(`Se ven los ${TANDA + 1} eventos más recientes de 195.`)).not.toHaveAttribute("role");

      expect(screen.getByRole("button", { name: `Mostrar ${TANDA} más` })).toHaveClass("boton-secundario");
      fireEvent.click(screen.getByRole("button", { name: `Mostrar ${TANDA} más` }));
      expect(region.firstChild).not.toBe(antes);
      expect(region).toHaveTextContent(`Se ven los ${2 * TANDA + 1} eventos más recientes de 195.`);
    });

    it("«Mostrar todos» anuncia «Se ven los M eventos.», en lenguaje llano (H04; texto a confirmar por Facundo)", () => {
      const { container } = render(<ListaEventos eventos={eventos(1240)} />);
      fireEvent.click(screen.getByRole("button", { name: "Mostrar todos" }));
      const region = screen.getByRole("status", { name: "Eventos a la vista" });
      expect(region.textContent).toBe("Se ven los 1.240 eventos.");
      expectLenguajeLlano(region);
      expect(container).toBeTruthy();
    });
  });
});

