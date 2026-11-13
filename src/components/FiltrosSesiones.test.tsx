import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectLenguajeLlano } from "../test/lenguaje";
import { ESPERA_BUSQUEDA_MS, FiltrosSesiones, type ControlBusqueda } from "./FiltrosSesiones";

describe("FiltrosSesiones", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("cada control tiene su etiqueta y muestra los valores que recibe", () => {
    render(<FiltrosSesiones filtros={{ nivel: "high", estado: "finished", q: "Ana", orden: "risk_level" }} onCambio={() => {}} />);
    expect(screen.getByLabelText("Nivel de riesgo")).toHaveValue("high");
    expect(screen.getByLabelText("Estado")).toHaveValue("finished");
    expect(screen.getByLabelText("Buscar alumno")).toHaveValue("Ana");
    expect(screen.getByLabelText("Ordenar por")).toHaveValue("risk_level");
  });

  it("el orden predeterminado es por hora de inicio y elegirlo de nuevo lo borra", () => {
    const onCambio = vi.fn();
    render(<FiltrosSesiones filtros={{ orden: "risk_level" }} onCambio={onCambio} />);
    fireEvent.change(screen.getByLabelText("Ordenar por"), { target: { value: "started_at" } });
    expect(onCambio).toHaveBeenLastCalledWith({ orden: undefined });
  });

  it("«Todos» y «Todas» borran el filtro", () => {
    const onCambio = vi.fn();
    render(<FiltrosSesiones filtros={{ nivel: "low", estado: "open" }} onCambio={onCambio} />);
    fireEvent.change(screen.getByLabelText("Nivel de riesgo"), { target: { value: "" } });
    expect(onCambio).toHaveBeenLastCalledWith({ nivel: undefined });
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "" } });
    expect(onCambio).toHaveBeenLastCalledWith({ estado: undefined });
  });

  it("si desde afuera llega la misma búsqueda sin el espacio del borde, el campo conserva «Juan » (H03)", () => {
    const onCambio = vi.fn();
    const { rerender } = render(<FiltrosSesiones filtros={{}} onCambio={onCambio} />);
    const campo = screen.getByLabelText("Buscar alumno");
    fireEvent.change(campo, { target: { value: "Juan " } });
    // Antes de que termine la espera, Atrás trae una dirección con q=Juan (la dirección guarda sin espacios).
    rerender(<FiltrosSesiones filtros={{ q: "Juan" }} onCambio={onCambio} />);
    expect(campo).toHaveValue("Juan ");
    // Y lo que se estaba esperando escribir ya no vale.
    act(() => vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS));
    expect(onCambio).not.toHaveBeenCalled();
  });

  it("la búsqueda espera a que se deje de escribir y no busca espacios", () => {
    const onCambio = vi.fn();
    render(<FiltrosSesiones filtros={{}} onCambio={onCambio} />);
    const campo = screen.getByLabelText("Buscar alumno");
    fireEvent.change(campo, { target: { value: "Nú" } });
    fireEvent.change(campo, { target: { value: "Núñez" } });
    act(() => vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS - 1));
    expect(onCambio).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onCambio).toHaveBeenCalledTimes(1);
    expect(onCambio).toHaveBeenLastCalledWith({ q: "Núñez" });

    fireEvent.change(campo, { target: { value: "   " } });
    act(() => vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS));
    expect(onCambio).toHaveBeenLastCalledWith({ q: undefined });
  });

  it("si la búsqueda cambia desde afuera, el campo la sigue", () => {
    const { rerender } = render(<FiltrosSesiones filtros={{ q: "Ana" }} onCambio={() => {}} />);
    rerender(<FiltrosSesiones filtros={{}} onCambio={() => {}} />);
    expect(screen.getByLabelText("Buscar alumno")).toHaveValue("");
  });

  it("los niveles se nombran como en el resto del panel, del más alto al más bajo", () => {
    const { container } = render(<FiltrosSesiones filtros={{}} onCambio={() => {}} />);
    const opciones = [...(screen.getByLabelText("Nivel de riesgo") as HTMLSelectElement).options];
    expect(opciones.map((o) => [o.value, o.text])).toEqual([
      ["", "Todos"],
      ["high", "Riesgo alto"],
      ["medium", "Riesgo medio"],
      ["low", "Riesgo bajo"],
    ]);
    const orden = [...(screen.getByLabelText("Ordenar por") as HTMLSelectElement).options].map((o) => o.text);
    expect(orden).toEqual(["Hora de inicio", "Nivel de riesgo"]);
    expectLenguajeLlano(container);
  });

  it("la espera llama a la última función recibida, no a la de cuando se tecleó", () => {
    const vieja = vi.fn();
    const nueva = vi.fn();
    const { rerender } = render(<FiltrosSesiones filtros={{}} onCambio={vieja} />);
    fireEvent.change(screen.getByLabelText("Buscar alumno"), { target: { value: "Ana" } });
    rerender(<FiltrosSesiones filtros={{ nivel: "high" }} onCambio={nueva} />);
    act(() => vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS));
    expect(vieja).not.toHaveBeenCalled();
    expect(nueva).toHaveBeenCalledWith({ q: "Ana" });
  });

  it("la búsqueda guardada sin el espacio final no le borra el espacio al campo", () => {
    const onCambio = vi.fn();
    const { rerender } = render(<FiltrosSesiones filtros={{}} onCambio={onCambio} />);
    const campo = screen.getByLabelText("Buscar alumno");
    fireEvent.change(campo, { target: { value: "Juan " } });
    act(() => vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS));
    expect(onCambio).toHaveBeenLastCalledWith({ q: "Juan" });
    rerender(<FiltrosSesiones filtros={{ q: "Juan" }} onCambio={onCambio} />);
    expect(campo).toHaveValue("Juan ");
  });

  it("si la búsqueda cambia desde afuera mientras se espera, lo tecleado no se escribe", () => {
    const onCambio = vi.fn();
    const { rerender } = render(<FiltrosSesiones filtros={{ q: "Ana" }} onCambio={onCambio} />);
    fireEvent.change(screen.getByLabelText("Buscar alumno"), { target: { value: "Ana M" } });
    rerender(<FiltrosSesiones filtros={{}} onCambio={onCambio} />);
    act(() => vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS));
    expect(onCambio).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Buscar alumno")).toHaveValue("");
  });

  it("lo tecleado mientras llega la búsqueda que mandó el propio campo no se pierde", () => {
    // react-router confirma la navegación en una transición: la dirección con «Ana» llega después de que el
    // docente siguió escribiendo. Acá el padre tarda en pasarle la búsqueda nueva, igual que en el navegador.
    const onCambio = vi.fn();
    const { rerender } = render(<FiltrosSesiones filtros={{}} onCambio={onCambio} />);
    const campo = screen.getByLabelText("Buscar alumno");
    fireEvent.change(campo, { target: { value: "Ana" } });
    act(() => vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS));
    expect(onCambio).toHaveBeenLastCalledWith({ q: "Ana" });
    fireEvent.change(campo, { target: { value: "Anax" } });
    rerender(<FiltrosSesiones filtros={{ q: "Ana" }} onCambio={onCambio} />);
    expect(campo).toHaveValue("Anax");
    act(() => vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS));
    expect(onCambio).toHaveBeenLastCalledWith({ q: "Anax" });
  });

  it("avisa que la búsqueda está en espera desde la primera tecla hasta que llega a la dirección", () => {
    // Durante los 300 ms de espera el campo ya decía otra cosa y la lista seguía sin marcar como ocupada.
    const onEspera = vi.fn();
    const onCambio = vi.fn();
    const { rerender } = render(<FiltrosSesiones filtros={{}} onCambio={onCambio} onEspera={onEspera} />);
    expect(onEspera).toHaveBeenLastCalledWith(false);
    const campo = screen.getByLabelText("Buscar alumno");
    fireEvent.change(campo, { target: { value: "ma" } });
    expect(onEspera).toHaveBeenLastCalledWith(true);
    // Se mandó, pero la dirección todavía no la confirmó: sigue en espera.
    act(() => vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS));
    expect(onCambio).toHaveBeenLastCalledWith({ q: "ma" });
    expect(onEspera).toHaveBeenLastCalledWith(true);
    rerender(<FiltrosSesiones filtros={{ q: "ma" }} onCambio={onCambio} onEspera={onEspera} />);
    expect(onEspera).toHaveBeenLastCalledWith(false);

    // Lo mismo que ya está en la dirección («ma» y un espacio) no espera nada.
    fireEvent.change(campo, { target: { value: "ma " } });
    expect(onEspera).toHaveBeenLastCalledWith(true);
    act(() => vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS));
    expect(onEspera).toHaveBeenLastCalledWith(false);
  });

  it("al cancelar una búsqueda que ya está en la dirección, sigue en espera hasta que la dirección la pierde", () => {
    const onEspera = vi.fn();
    const ref = { current: null as ControlBusqueda | null };
    const { rerender } = render(
      <FiltrosSesiones filtros={{ q: "ma" }} onCambio={() => {}} onEspera={onEspera} controlRef={ref} />
    );
    act(() => ref.current!.cancelarBusqueda());
    expect(screen.getByLabelText("Buscar alumno")).toHaveValue("");
    expect(onEspera).toHaveBeenLastCalledWith(true);
    rerender(<FiltrosSesiones filtros={{}} onCambio={() => {}} onEspera={onEspera} controlRef={ref} />);
    expect(onEspera).toHaveBeenLastCalledWith(false);
  });
});
