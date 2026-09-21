import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sesionesService from "../services/sesionesService";
import { DetalleSesion } from "./DetalleSesion";

const SESION: sesionesService.SesionNumerada = {
  id: 7,
  moodle_attempt_id: 7001,
  moodle_user_id: 41,
  student_name: "Ana Gómez",
  status: "open",
  started_at: "2026-09-21T14:00:00Z",
  examenId: 3,
  cursoId: 2,
  examen: "Primer Parcial",
  curso: "Sistemas de Información II",
  intento: 1,
  intentos: 1,
};

const evento = (seq: number, type: string, data: Record<string, unknown> = {}): sesionesService.Evento => ({
  seq,
  type,
  occurred_at: "2026-09-21T14:05:00.000Z",
  received_at: "2026-09-21T14:05:03.000Z",
  data,
});

const esperar = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

describe("DetalleSesion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("muestra los eventos de la sesión en castellano y en el orden en que llegaron", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([
      evento(1, "focus_lost"),
      evento(2, "clipboard", { action: "paste", length: 340, slot: 1, qtype: "essay" }),
    ]);

    render(<DetalleSesion examenId={3} sesion={SESION} onVencida={() => undefined} />);
    await esperar();

    expect(sesionesService.traerEventos).toHaveBeenCalledWith(3, 7, 0);
    const filas = screen.getAllByRole("row").slice(1);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent("Salió de la ventana");
    expect(filas[1]).toHaveTextContent("Pegó");
    expect(filas[1]).toHaveTextContent("pregunta 1 (ensayo) · 340 caracteres");
    expect(screen.getByText("Ana Gómez · rindiendo ahora")).toBeInTheDocument();
  });

  it("no muestra índice, riesgo ni alertas", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([evento(1, "focus_lost")]);

    render(<DetalleSesion examenId={3} sesion={SESION} onVencida={() => undefined} />);
    await esperar();

    expect(screen.queryByText(/índice|riesgo|alerta|integridad|sospech/i)).not.toBeInTheDocument();
  });

  it("dice que todavía no hay eventos, en vez de mostrar una tabla vacía", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([]);

    render(<DetalleSesion examenId={3} sesion={SESION} onVencida={() => undefined} />);
    await esperar();

    expect(screen.getByText(/Todavía no hay eventos registrados/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("mientras la sesión está abierta pregunta cada pocos segundos solo por lo nuevo", async () => {
    const traer = vi
      .spyOn(sesionesService, "traerEventos")
      .mockResolvedValueOnce([evento(10, "focus_lost"), evento(11, "focus_gained", { away_ms: 4000 })])
      .mockResolvedValueOnce([evento(12, "mouse_leave")]);

    render(<DetalleSesion examenId={3} sesion={SESION} onVencida={() => undefined} />);
    await esperar();
    expect(screen.getAllByRole("row")).toHaveLength(3);

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });

    // La segunda vez pide después del último que ya tenía, y agrega a lo mostrado.
    expect(traer).toHaveBeenLastCalledWith(3, 7, 11);
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(screen.getByText("El cursor salió de la ventana")).toBeInTheDocument();
    expect(screen.getByText("Volvió a la ventana")).toBeInTheDocument();
  });

  it("con la sesión cerrada consulta una vez y no sigue preguntando", async () => {
    const traer = vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([evento(1, "focus_lost")]);

    render(<DetalleSesion examenId={3} sesion={{ ...SESION, status: "closed", closed_at: "2026-09-21T14:40:00Z" }} onVencida={() => undefined} />);
    await esperar();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });

    expect(traer).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Ana Gómez · entregó")).toBeInTheDocument();
  });

  it("al cerrarse la sesión hace una última consulta y deja de preguntar", async () => {
    const traer = vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([]);

    const { rerender } = render(<DetalleSesion examenId={3} sesion={SESION} onVencida={() => undefined} />);
    await esperar();
    const antes = traer.mock.calls.length;

    rerender(<DetalleSesion examenId={3} sesion={{ ...SESION, status: "closed" }} onVencida={() => undefined} />);
    await esperar();
    expect(traer.mock.calls.length).toBe(antes + 1);

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(traer.mock.calls.length).toBe(antes + 1);
  });

  it("junta varias páginas cuando la sesión tiene más eventos que los que entran en una", async () => {
    const pagina = Array.from({ length: sesionesService.EVENTOS_POR_PAGINA }, (_, i) => evento(i + 1, "mouse_enter"));
    const traer = vi
      .spyOn(sesionesService, "traerEventos")
      .mockResolvedValueOnce(pagina)
      .mockResolvedValueOnce([evento(sesionesService.EVENTOS_POR_PAGINA + 1, "mouse_leave")]);

    render(<DetalleSesion examenId={3} sesion={SESION} onVencida={() => undefined} />);
    await esperar();

    expect(traer).toHaveBeenNthCalledWith(2, 3, 7, sesionesService.EVENTOS_POR_PAGINA);
    expect(screen.getByText("El cursor salió de la ventana")).toBeInTheDocument();
  });

  it("si se pierde la conexión conserva lo último que llegó y avisa", async () => {
    vi.spyOn(sesionesService, "traerEventos")
      .mockResolvedValueOnce([evento(1, "focus_lost")])
      .mockRejectedValueOnce(new Error("sin red"));

    render(<DetalleSesion examenId={3} sesion={SESION} onVencida={() => undefined} />);
    await esperar();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });

    expect(screen.getByText(/Sin conexión con el servidor/)).toBeInTheDocument();
    expect(screen.getByText("Salió de la ventana")).toBeInTheDocument();
  });

  it("avisa cuando el token venció, sin tratarlo como un corte de red", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockRejectedValue(new sesionesService.SesionVencida());
    const onVencida = vi.fn();

    render(<DetalleSesion examenId={3} sesion={SESION} onVencida={onVencida} />);
    await esperar();

    expect(onVencida).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Sin conexión/)).not.toBeInTheDocument();
  });

  it("la hora que muestra es la del servidor, y la del reloj del alumno queda en el tooltip", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([
      { ...evento(1, "focus_lost"), occurred_at: "2026-09-21T13:00:00.000Z", received_at: "2026-09-21T14:00:00.000Z" },
    ]);

    render(<DetalleSesion examenId={3} sesion={SESION} onVencida={() => undefined} />);
    await esperar();

    const hora = document.querySelector("time");
    expect(hora?.getAttribute("datetime")).toBe("2026-09-21T14:00:00.000Z");
    expect(hora?.getAttribute("title")).toMatch(/reloj del alumno/);
  });

  it("aclara el número de intento cuando el alumno rindió más de una vez", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([]);

    render(<DetalleSesion examenId={3} sesion={{ ...SESION, intento: 2, intentos: 2 }} onVencida={() => undefined} />);
    await esperar();

    expect(screen.getByText(/intento 2 de 2/)).toBeInTheDocument();
  });

  it("al cambiar de sesión empieza de cero y no mezcla eventos", async () => {
    const traer = vi
      .spyOn(sesionesService, "traerEventos")
      .mockResolvedValueOnce([evento(5, "focus_lost")])
      .mockResolvedValueOnce([evento(1, "mouse_enter")]);

    const { rerender } = render(<DetalleSesion examenId={3} sesion={SESION} onVencida={() => undefined} />);
    await esperar();
    rerender(<DetalleSesion examenId={3} sesion={{ ...SESION, id: 8 }} onVencida={() => undefined} />);
    await esperar();

    expect(traer).toHaveBeenLastCalledWith(3, 8, 0);
    expect(screen.queryByText("Salió de la ventana")).not.toBeInTheDocument();
    expect(screen.getByText("El cursor volvió a la ventana")).toBeInTheDocument();
  });
});
