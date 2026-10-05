import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sesionesService from "../services/sesionesService";
import { esperar, evento, sesionNumerada } from "../test/fabricas";
import { horaCorta, horaExacta } from "../eventos";
import { DetalleSesion } from "./DetalleSesion";

const SESION = sesionNumerada();
const nada = () => undefined;

describe("DetalleSesion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("muestra los eventos de la sesión en castellano, del más reciente al más viejo", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([
      evento(1, "focus_lost"),
      evento(2, "clipboard", { action: "paste", length: 340, slot: 1, qtype: "essay" }),
    ]);

    render(<DetalleSesion sesion={SESION} onVencida={nada} />);
    await esperar();

    expect(sesionesService.traerEventos).toHaveBeenCalledWith(3, 7, 0);
    const filas = screen.getAllByRole("row").slice(1);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent("Pegó");
    expect(filas[0]).toHaveTextContent("pregunta 1 (ensayo), 340 caracteres");
    expect(filas[1]).toHaveTextContent("Pasó a otra ventana");
    // Quién es el alumno lo dice el título de la pantalla, no esta vista, con
    // o sin nombre. El estado sí, porque es lo único que cambia solo.
    expect(screen.queryByText("Ana Gómez")).not.toBeInTheDocument();
    expect(screen.queryByText(/Alumno 41/)).not.toBeInTheDocument();
    expect(screen.getByText("rindiendo ahora")).toBeInTheDocument();
  });

  it("pide por orden de llegada y muestra el evento tardío donde llegó", async () => {
    const traer = vi.spyOn(sesionesService, "traerEventos");
    traer.mockResolvedValueOnce([
      evento(10, "focus_lost", {}, { id: 1 }),
      evento(30, "focus_gained", {}, { id: 2 }),
    ]);
    render(<DetalleSesion sesion={SESION} onVencida={nada} />);
    await esperar();

    // Llega después, con un seq menor al último visto: con el cursor por seq se perdía.
    traer.mockResolvedValueOnce([
      evento(20, "clipboard", { action: "copy", length: 5 }, { id: 3, received_at: "2026-09-21T14:05:10.000Z" }),
    ]);
    await esperar(5000);

    expect(traer).toHaveBeenLastCalledWith(3, 7, 2);
    const filas = screen.getAllByRole("row").slice(1);
    expect(filas).toHaveLength(3);
    // Se ordena con la misma hora que se muestra, la de llegada: el tardío queda
    // arriba, como el más reciente, y no intercalado con una hora anterior.
    expect(filas[0]).toHaveTextContent("Copió");
  });

  it("dentro de un mismo envío respeta el orden en que ocurrieron", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([
      evento(2, "focus_gained", { away_ms: 4000 }, { id: 5 }),
      evento(1, "focus_lost", {}, { id: 6 }),
    ]);
    render(<DetalleSesion sesion={SESION} onVencida={nada} />);
    await esperar();

    const filas = screen.getAllByRole("row").slice(1);
    expect(filas[0]).toHaveTextContent("Volvió a la ventana del examen");
    expect(filas[1]).toHaveTextContent("Pasó a otra ventana");
  });

  it("mientras la sesión está abierta pregunta cada pocos segundos solo por lo nuevo", async () => {
    const traer = vi
      .spyOn(sesionesService, "traerEventos")
      .mockResolvedValueOnce([evento(10, "focus_lost"), evento(11, "focus_gained", { away_ms: 4000 })])
      .mockResolvedValueOnce([evento(12, "mouse_leave")]);

    render(<DetalleSesion sesion={SESION} onVencida={nada} />);
    await esperar();
    expect(screen.getAllByRole("row")).toHaveLength(3);

    await esperar(5000);

    // La segunda vez pide después del último que ya tenía, y agrega a lo mostrado.
    expect(traer).toHaveBeenLastCalledWith(3, 7, 11);
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(screen.getByText("El mouse salió del área del examen")).toBeInTheDocument();
  });

  it("después de la entrega sigue preguntando unos minutos, y después deja", async () => {
    const traer = vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([]);
    const recien = new Date(Date.now() - 60_000).toISOString();
    render(<DetalleSesion sesion={{ ...SESION, status: "closed", closed_at: recien }} onVencida={nada} />);
    await esperar();
    await esperar(5000);
    expect(traer).toHaveBeenCalledTimes(2);

    traer.mockClear();
    const viejo = new Date(Date.now() - 60 * 60_000).toISOString();
    render(<DetalleSesion sesion={{ ...SESION, id: 9, status: "closed", closed_at: viejo }} onVencida={nada} />);
    await esperar();
    await esperar(15000);
    // La de hace una hora se consulta una sola vez; la reciente siguió sus consultas.
    expect(traer.mock.calls.filter(([, sesion]) => sesion === 9)).toHaveLength(1);
    expect(screen.getAllByText("entregó")).toHaveLength(2);
  });

  it("al cerrarse la sesión conserva lo mostrado, pide solo lo que falta y deja de preguntar", async () => {
    const traer = vi.spyOn(sesionesService, "traerEventos");
    traer.mockResolvedValueOnce([evento(1, "focus_lost"), evento(2, "focus_gained")]);
    const { rerender } = render(<DetalleSesion sesion={SESION} onVencida={nada} />);
    await esperar();
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(2);

    traer.mockResolvedValue([]);
    traer.mockResolvedValueOnce([evento(3, "visibility_hidden")]);
    rerender(<DetalleSesion sesion={{ ...SESION, status: "closed" }} onVencida={nada} />);
    await esperar();

    // No volvió a pedir desde cero: pidió después del último que ya tenía.
    expect(traer).toHaveBeenLastCalledWith(3, 7, 2);
    expect(traer).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(3);

    await esperar(30_000);
    expect(traer).toHaveBeenCalledTimes(2);
  });

  // El aviso de una página sin captura lo manda Moodle en una tarea que puede
  // tardar más que los minutos posteriores al cierre. Mientras la sesión esté
  // marcada y el aviso no esté en el registro, se sigue preguntando.
  it("sigue preguntando hasta que llega el aviso de una página sin captura", async () => {
    const viejo = new Date(Date.now() - 60 * 60_000).toISOString();
    const traer = vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([]);
    const onConsulta = vi.fn();
    render(
      <DetalleSesion
        sesion={{ ...SESION, status: "closed", closed_at: viejo, capture: { state: "js_disabled" } }}
        onVencida={nada}
        onConsulta={onConsulta}
      />,
    );
    await esperar();
    await esperar(10_000);
    expect(traer).toHaveBeenCalledTimes(3);
    expect(onConsulta).toHaveBeenLastCalledWith(true, false);

    traer.mockResolvedValueOnce([evento(1, "capture_status", { state: "js_disabled" })]);
    await esperar(5000);
    expect(screen.getByText("La captura no estuvo activa")).toBeInTheDocument();

    // Llegó: deja de preguntar y avisa que el registro ya no se actualiza.
    await esperar(30_000);
    expect(traer).toHaveBeenCalledTimes(4);
    expect(onConsulta).toHaveBeenLastCalledWith(false, false);
  });

  it("si la sesión se marca sin captura después de dejar de preguntar, vuelve a consultar", async () => {
    const viejo = new Date(Date.now() - 60 * 60_000).toISOString();
    const cerrada = { ...SESION, status: "closed" as const, closed_at: viejo };
    const traer = vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([]);
    const { rerender } = render(<DetalleSesion sesion={{ ...cerrada, capture: { state: "ok" } }} onVencida={nada} />);
    await esperar();
    await esperar(30_000);
    expect(traer).toHaveBeenCalledTimes(1);

    traer.mockResolvedValueOnce([evento(1, "capture_status", { state: "no_start" })]);
    rerender(<DetalleSesion sesion={{ ...cerrada, capture: { state: "no_start" } }} onVencida={nada} />);
    await esperar();
    expect(traer).toHaveBeenCalledTimes(2);
    expect(screen.getByText("La captura no estuvo activa")).toBeInTheDocument();
    await esperar(30_000);
    expect(traer).toHaveBeenCalledTimes(2);
  });

  it("le avisa a quien la muestra que el registro no se pudo actualizar, y cuando vuelve", async () => {
    const traer = vi.spyOn(sesionesService, "traerEventos")
      .mockResolvedValueOnce([evento(1, "focus_lost")])
      .mockRejectedValueOnce(new Error("sin red"))
      .mockResolvedValue([]);
    const onConsulta = vi.fn();
    render(<DetalleSesion sesion={SESION} onVencida={nada} onConsulta={onConsulta} />);
    await esperar();
    expect(onConsulta).toHaveBeenLastCalledWith(true, false);

    await esperar(5000);
    expect(traer).toHaveBeenCalledTimes(2);
    expect(onConsulta).toHaveBeenLastCalledWith(true, true);
    // Lo que ya había llegado sigue a la vista, con el aviso.
    expect(screen.getByText(/No se pudo actualizar el registro/)).toBeInTheDocument();
    expect(screen.getByText("Pasó a otra ventana")).toBeInTheDocument();

    await esperar(5000);
    expect(onConsulta).toHaveBeenLastCalledWith(true, false);
  });

  it("sin eventos lo dice, sin tabla vacía, y aclara que aparecen al abrirse la página", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([]);

    render(<DetalleSesion sesion={SESION} onVencida={nada} />);
    await esperar();

    expect(screen.getByText(/Todavía no hay eventos registrados/)).toBeInTheDocument();
    expect(screen.getByText(/en cuanto se abre la página del examen/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("le explica al docente por qué una sesión no tuvo captura", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([]);

    render(<DetalleSesion sesion={{ ...SESION, capture: { state: "none" } }} onVencida={nada} />);
    await esperar();

    expect(screen.getByRole("note")).toHaveTextContent(/No quedó registrada ninguna actividad/);
  });

  it("no dice nada de la captura cuando estuvo bien", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([evento(1, "focus_lost")]);

    render(<DetalleSesion sesion={{ ...SESION, capture: { state: "ok" } }} onVencida={nada} />);
    await esperar();

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("no muestra índice, riesgo ni alertas", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([evento(1, "focus_lost")]);

    render(<DetalleSesion sesion={SESION} onVencida={nada} />);
    await esperar();

    expect(screen.queryByText(/índice|riesgo|alerta|integridad|sospech/i)).not.toBeInTheDocument();
  });

  it("no le dice «entregó» a un intento que quedó sin entregar", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([evento(1, "focus_lost")]);

    render(<DetalleSesion sesion={{ ...SESION, status: "abandoned", closed_at: "2026-09-21T14:40:00Z" }} onVencida={nada} />);
    await esperar();

    // «abandoned» es justo lo que no se entregó. La lista, del mismo dato,
    // dice «sin entregar»: dos pantallas del mismo registro no pueden
    // contradecirse.
    expect(screen.getByText("sin entregar")).toBeInTheDocument();
    expect(screen.queryByText("entregó")).not.toBeInTheDocument();
  });

  it("junta varias páginas cuando la sesión tiene más eventos que los que entran en una", async () => {
    const pagina = Array.from({ length: sesionesService.EVENTOS_POR_PAGINA }, (_, i) => evento(i + 1, "mouse_enter"));
    const traer = vi
      .spyOn(sesionesService, "traerEventos")
      .mockResolvedValueOnce(pagina)
      .mockResolvedValueOnce([evento(sesionesService.EVENTOS_POR_PAGINA + 1, "mouse_leave")]);

    render(<DetalleSesion sesion={SESION} onVencida={nada} />);
    await esperar();

    expect(traer).toHaveBeenNthCalledWith(2, 3, 7, sesionesService.EVENTOS_POR_PAGINA);
    expect(screen.getByText("El mouse salió del área del examen")).toBeInTheDocument();
  });

  it("avisa cuando el token venció, sin tratarlo como un corte de red", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockRejectedValue(new sesionesService.SesionVencida());
    const onVencida = vi.fn();

    render(<DetalleSesion sesion={SESION} onVencida={onVencida} />);
    await esperar();

    expect(onVencida).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/No se pudo actualizar el registro/)).not.toBeInTheDocument();
  });

  it("la hora que muestra es la del servidor, y la del reloj del alumno queda en el tooltip", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([
      evento(1, "focus_lost", {}, { occurred_at: "2026-09-21T13:00:00.000Z", received_at: "2026-09-21T14:00:00.000Z" }),
    ]);

    render(<DetalleSesion sesion={SESION} onVencida={nada} />);
    await esperar();

    // Contra el TEXTO y no solo contra los atributos: el docente lee el hijo del
    // <time>, no su `datetime`. Con las aserciones puestas sobre los atributos,
    // cambiar la línea a `occurred_at` mostraba el reloj del alumno —el que el
    // proyecto declara no confiable— y la suite seguía en verde.
    const hora = document.querySelector("time");
    expect(hora).toHaveTextContent(horaExacta("2026-09-21T14:00:00.000Z"));
    expect(hora?.getAttribute("datetime")).toBe("2026-09-21T14:00:00.000Z");
    expect(hora?.getAttribute("title")).toBe(`Según el reloj del alumno: ${horaExacta("2026-09-21T13:00:00.000Z")}`);
    // Y las dos horas tienen que ser distintas, o el caso no probaría nada.
    expect(horaExacta("2026-09-21T14:00:00.000Z")).not.toBe(horaExacta("2026-09-21T13:00:00.000Z"));
  });

  // El vacío del registro se elige por si el ciclo sigue preguntando, no por si
  // la sesión está abierta: entre las dos cosas hay hasta diez minutos después
  // del cierre, y sin plazo si falta el aviso de una página sin captura.
  it("con el intento cerrado hace rato dice que no quedó ningún evento", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([]);
    const cerradaHaceRato = sesionNumerada({
      status: "closed",
      closed_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    });

    render(<DetalleSesion sesion={cerradaHaceRato} onVencida={nada} />);
    await esperar();

    expect(screen.getByText("No quedó ningún evento registrado en esta sesión.")).toBeInTheDocument();
  });

  it("mientras siga preguntando no dice que no quedó ninguno, aunque el intento ya se haya entregado", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([]);
    const reciénCerrada = sesionNumerada({
      status: "closed",
      closed_at: new Date(Date.now() - 60_000).toISOString(),
    });

    render(<DetalleSesion sesion={reciénCerrada} onVencida={nada} />);
    await esperar();

    expect(screen.getByText(/Todavía no hay eventos registrados/)).toBeInTheDocument();
    expect(screen.queryByText("No quedó ningún evento registrado en esta sesión.")).not.toBeInTheDocument();
    // Y no le promete al docente que van a aparecer al abrirse la página del
    // examen: esa página ya se cerró.
    expect(screen.queryByText(/en cuanto se abre la página del examen/)).not.toBeInTheDocument();
    expect(screen.getByText(/solo puede aparecer lo que haya quedado en camino/)).toBeInTheDocument();
  });

  // La única fila del registro que no es un evento. `huecos.test.ts` prueba la
  // función sobre datos, pero la fila dibujada no la tocaba ninguna prueba:
  // todos los eventos de las fábricas caen dentro del mismo minuto, así que la
  // rama nunca se ejecutaba y el silencio podía desaparecer, invertir sus
  // extremos o caer del lado equivocado con la suite entera en verde.
  it("marca el silencio entre dos eventos lejanos, en su lugar y con sus dos horas", async () => {
    const antes = "2026-09-21T14:00:00.000Z";
    const despues = "2026-09-21T14:05:00.000Z";
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([
      evento(1, "focus_lost", {}, { id: 1, received_at: antes, occurred_at: antes }),
      evento(2, "mouse_leave", {}, { id: 2, received_at: despues, occurred_at: despues }),
    ]);

    render(<DetalleSesion sesion={SESION} onVencida={nada} />);
    await esperar();

    const filas = screen.getAllByRole("row").slice(1);
    expect(filas).toHaveLength(3);
    // La tabla va del más reciente al más viejo: el silencio queda en el medio.
    expect(filas[0]).toHaveTextContent("El mouse salió del área del examen");
    expect(filas[1]).toHaveTextContent(
      `sin eventos recibidos entre ${horaCorta(antes)} y ${horaCorta(despues)}`
    );
    expect(filas[2]).toHaveTextContent("Pasó a otra ventana");
    // Y el silencio no se cuenta como un evento más.
    expect(screen.getByText("2", { selector: ".lista__cuenta" })).toBeInTheDocument();
  });

  it("aclara el número de intento cuando el alumno rindió más de una vez", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([]);

    render(<DetalleSesion sesion={{ ...SESION, intento: 2, intentos: 2 }} onVencida={nada} />);
    await esperar();

    expect(screen.getByText(/intento 2 de 2/)).toBeInTheDocument();
  });

  // El panel se redibuja con cada respuesta de su propia consulta y le pasa a
  // esta pantalla funciones nuevas cada vez: eso no puede reiniciar la consulta.
  it("no reinicia la consulta cuando quien la muestra se redibuja con una función nueva", async () => {
    const traer = vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([evento(1, "focus_lost")]);

    const { rerender } = render(<DetalleSesion sesion={SESION} onVencida={() => undefined} />);
    await esperar();
    expect(screen.getByText("Pasó a otra ventana")).toBeInTheDocument();

    for (let segundo = 0; segundo < 3; segundo++) {
      rerender(<DetalleSesion sesion={{ ...SESION }} onVencida={() => undefined} />);
      await esperar(1000);
      expect(screen.getByText("Pasó a otra ventana")).toBeInTheDocument();
      expect(screen.queryByText(/Cargando los eventos/)).not.toBeInTheDocument();
    }

    // Pasaron 3 s: todavía no toca la próxima consulta (es cada 5 s), y no hubo ninguna de más.
    expect(traer).toHaveBeenCalledTimes(1);
  });

  it("si el token vence llama a la función más reciente que recibió", async () => {
    vi.spyOn(sesionesService, "traerEventos")
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new sesionesService.SesionVencida());
    const primera = vi.fn();
    const ultima = vi.fn();

    const { rerender } = render(<DetalleSesion sesion={SESION} onVencida={primera} />);
    await esperar();
    rerender(<DetalleSesion sesion={SESION} onVencida={ultima} />);
    await esperar(5000);

    expect(ultima).toHaveBeenCalledTimes(1);
    expect(primera).not.toHaveBeenCalled();
  });

  // El panel le pone `key` con el id de la sesión: cambiar de sesión la monta
  // de nuevo y no arrastra nada de la anterior.
  it("con otra sesión (otro key) empieza de cero y no mezcla eventos", async () => {
    const traer = vi
      .spyOn(sesionesService, "traerEventos")
      .mockResolvedValueOnce([evento(5, "focus_lost")])
      .mockResolvedValueOnce([evento(1, "mouse_enter")]);

    const { rerender } = render(<DetalleSesion key={7} sesion={SESION} onVencida={nada} />);
    await esperar();
    rerender(<DetalleSesion key={8} sesion={{ ...SESION, id: 8 }} onVencida={nada} />);
    await esperar();

    expect(traer).toHaveBeenLastCalledWith(3, 8, 0);
    expect(screen.queryByText("Pasó a otra ventana")).not.toBeInTheDocument();
    expect(screen.getByText("El mouse entró en el área del examen")).toBeInTheDocument();
  });

  it("si la primera consulta falla no dice que no hay eventos", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockRejectedValue(new Error("sin red"));
    render(<DetalleSesion sesion={SESION} onVencida={nada} />);
    await esperar();

    expect(screen.getByText(/No se pudo actualizar el registro/)).toBeInTheDocument();
    expect(screen.queryByText(/Todavía no hay eventos/)).not.toBeInTheDocument();
  });

  it("con un servidor lento no superpone consultas", async () => {
    let resolver: (v: sesionesService.Evento[]) => void = () => undefined;
    const traer = vi.spyOn(sesionesService, "traerEventos").mockImplementation(
      () => new Promise((r) => { resolver = r; })
    );
    render(<DetalleSesion sesion={SESION} onVencida={nada} />);
    await esperar(12000);
    // La primera sigue sin contestar: no salió ninguna otra.
    expect(traer).toHaveBeenCalledTimes(1);

    await act(async () => { resolver([evento(1, "focus_lost")]); await vi.advanceTimersByTimeAsync(0); });
    await esperar(5000);
    expect(traer).toHaveBeenCalledTimes(2);
  });

  it("un lote repetido no duplica filas", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([evento(1, "focus_lost"), evento(2, "focus_gained")]);

    render(<DetalleSesion sesion={SESION} onVencida={nada} />);
    await esperar();
    await esperar(5000);
    await esperar(5000);

    // Tres consultas, los mismos dos eventos: se deduplica por `id`, dos filas.
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(2);
  });
});
