import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ESPERA_BUSQUEDA_MS, FiltrosSesiones } from "./FiltrosSesiones";

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
});
