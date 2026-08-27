import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Transcurrido } from "./Transcurrido";

/**
 * El contador de la fila.
 *
 * Va sin segundos: quien avisa que la pantalla sigue viva es la cuenta
 * regresiva del encabezado, que es una sola. Acá los segundos se multiplicaban
 * por cada alumno y hacían parpadear la tabla entera para decir algo que a
 * nadie le importa, que es el segundo exacto en que arrancó un examen.
 */

const INICIO = "2026-08-26T15:00:00Z";
const en = (segundos: number) => new Date(Date.parse(INICIO) + segundos * 1000);

describe("Transcurrido", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(en(0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("dice «recién» durante el primer minuto, en vez de un cero que no informa", () => {
    vi.setSystemTime(en(14));
    render(<Transcurrido inicio={INICIO} />);
    expect(screen.getByText("recién")).toBeInTheDocument();
  });

  it("pasa a minutos al cumplirse el primero", () => {
    vi.setSystemTime(en(59));
    const { rerender } = render(<Transcurrido inicio={INICIO} />);
    expect(screen.getByText("recién")).toBeInTheDocument();

    vi.setSystemTime(en(60));
    rerender(<Transcurrido inicio={INICIO} key="otra" />);
    expect(screen.getByText("1 min")).toBeInTheDocument();
  });

  it("avanza solo, sin que nadie lo toque", () => {
    vi.setSystemTime(en(600));
    render(<Transcurrido inicio={INICIO} />);
    expect(screen.getByText("10 min")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(60000));
    expect(screen.getByText("11 min")).toBeInTheDocument();
  });

  it("agrega las horas recién cuando hacen falta", () => {
    vi.setSystemTime(en(3599));
    const { rerender } = render(<Transcurrido inicio={INICIO} />);
    expect(screen.getByText("59 min")).toBeInTheDocument();

    vi.setSystemTime(en(4052));
    rerender(<Transcurrido inicio={INICIO} key="otra" />);
    expect(screen.getByText("1 h 07")).toBeInTheDocument();
  });

  it("se detiene en el cierre y no sigue corriendo", () => {
    vi.setSystemTime(en(600));
    render(<Transcurrido inicio={INICIO} cierre={en(125).toISOString()} />);
    expect(screen.getByText("2 min")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(120000));
    expect(screen.getByText("2 min")).toBeInTheDocument();
  });

  it("no muestra tiempos negativos si el reloj del servidor va adelantado", () => {
    vi.setSystemTime(en(-30));
    render(<Transcurrido inicio={INICIO} />);
    expect(screen.getByText("recién")).toBeInTheDocument();
  });
});
