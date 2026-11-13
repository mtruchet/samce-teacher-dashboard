import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sesionesService from "../services/sesionesService";
import { esperar, evento, pagina, simularSesiones } from "../test/fabricas";
import { EXAMEN, entregadaHaceRato, ingresar, montar, rindiendo } from "../test/panel";

/**
 * El panel montado solo, con relojes falsos: el pulso de la cabecera en el
 * registro de un intento, y las páginas de sesiones de un examen. Los filtros,
 * el resumen y el anuncio de alertas de la lista van en Panel.filtros,
 * Panel.resumen y Panel.alertas.
 *
 * Van acá y no en App.test.tsx porque necesitan relojes falsos: el corte de la
 * lista recién se ve en la segunda consulta, cinco segundos después, y con la
 * app entera las pantallas se cargan con `lazy`, que los relojes falsos no
 * esperan. Montando el panel solo, cada espera es exacta y no depende de lo
 * que tarde la máquina en correr la prueba.
 */

const EN_VIVO = /En vivo, se actualiza en/;
const QUIETO = "Examen terminado";
const SIN_CONEXION = "No se pudo actualizar esta pantalla. Reintentando.";

describe("El pulso del panel en el registro de un intento", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ingresar();
    vi.spyOn(sesionesService, "traerExamenes").mockResolvedValue([EXAMEN]);
    simularSesiones([entregadaHaceRato(), rindiendo]);
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([]);
    // El apartado «Análisis de la sesión» hace su propia consulta: sin esta simulación sale a buscar al backend de verdad.
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue({
      state: "not_analyzed", reason: null, calculated_at: null, alerts: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("en una sesión cerrada hace más de diez minutos no muestra el pulso: el estado ya lo dice la ficha", async () => {
    montar("/panel?examen=1&sesion=5");
    await esperar();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ana Gómez");
    // Ni «Examen terminado», que repetía el «Entregó» de la ficha, ni la tira de rayitas apagada.
    expect(document.querySelector(".enlace")).toBeNull();
    expect(screen.queryByText(QUIETO)).not.toBeInTheDocument();
    expect(screen.queryByText(EN_VIVO)).not.toBeInTheDocument();
    expect(screen.queryByText("Esta pantalla ya no se actualiza")).not.toBeInTheDocument();
  });

  // Volver a un enlace guardado, o apretar F5, sobre una sesión que ya no entra
  // en la primera página: el panel tiene que pedir más páginas hasta encontrarla
  // en vez de devolver al docente a la lista. Ninguna prueba ejercitaba esa rama,
  // porque `traerSesiones` devolvía siempre lo mismo sin importar el límite
  // pedido, y en un parcial con más de cincuenta intentos es el caso normal.
  it("entra a una sesión que quedó fuera de la primera página pidiendo la siguiente", async () => {
    const vieja: sesionesService.Sesion = {
      id: 55,
      moodle_attempt_id: 7055,
      moodle_user_id: 90,
      student_name: "Carla Ruiz",
      status: "closed",
      started_at: "2026-08-26T13:00:00Z",
      closed_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    };
    const primeraPagina = Array.from({ length: sesionesService.SESIONES_POR_PAGINA }, (_, i) => ({
      ...rindiendo,
      id: 100 + i,
      moodle_attempt_id: 8000 + i,
      moodle_user_id: 200 + i,
      student_name: `Alumno ${i}`,
    }));
    vi.mocked(sesionesService.traerExamenes).mockResolvedValue([
      { ...EXAMEN, open_sessions: sesionesService.SESIONES_POR_PAGINA, closed_sessions: 1 },
    ]);
    // Carla recién aparece cuando se pide más de una página.
    vi.mocked(sesionesService.traerSesiones).mockImplementation(
      async (_id: number, limite = sesionesService.SESIONES_POR_PAGINA) =>
        pagina(limite > sesionesService.SESIONES_POR_PAGINA ? [...primeraPagina, vieja] : primeraPagina)
    );

    montar("/panel?examen=1&sesion=55");
    await esperar();

    expect(sesionesService.traerSesiones).toHaveBeenLastCalledWith(1, 2 * sesionesService.SESIONES_POR_PAGINA, expect.anything());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Carla Ruiz");
  });

  it("si se corta la lista de sesiones, eso se avisa antes que el registro quieto", async () => {
    montar("/panel?examen=1&sesion=5");
    await esperar();
    expect(document.querySelector(".enlace")).toBeNull();

    vi.mocked(sesionesService.traerExamenes).mockRejectedValue(new Error("sin red"));
    await esperar(5000);

    expect(screen.getByText(SIN_CONEXION)).toBeInTheDocument();
    expect(screen.queryByText(QUIETO)).not.toBeInTheDocument();
  });

  it("en una sesión cerrada hace rato no dice «En vivo» mientras espera el registro", async () => {
    // El registro no contesta: antes, la cabecera decía «En vivo» hasta la primera respuesta, y en un teléfono
    // el pulso que después desaparecía subía todo 35 px. Se mira cada cambio del documento, no solo el final.
    vi.mocked(sesionesService.traerEventos).mockReturnValue(new Promise(() => undefined));
    let dijoEnVivo = false;
    const observador = new MutationObserver(() => {
      const enElDetalle = screen.queryByRole("heading", { level: 1 })?.textContent?.includes("Ana Gómez");
      if (enElDetalle && EN_VIVO.test(document.body.textContent ?? "")) dijoEnVivo = true;
    });
    observador.observe(document.body, { childList: true, subtree: true, characterData: true });
    montar("/panel?examen=1&sesion=5");
    await esperar();
    observador.disconnect();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ana Gómez");
    expect(dijoEnVivo).toBe(false);
    expect(screen.queryByText(EN_VIVO)).not.toBeInTheDocument();
  });

  it("en una sesión abierta dice «En vivo» aunque el registro todavía no haya contestado", async () => {
    vi.mocked(sesionesService.traerEventos).mockReturnValue(new Promise(() => undefined));
    montar("/panel?examen=1&sesion=6");
    await esperar();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Bruno Pérez");
    expect(screen.getByText(EN_VIVO)).toBeInTheDocument();
  });

  it("al entrar a otra sesión que sigue abierta, el pulso vuelve a decir «En vivo»", async () => {
    montar("/panel?examen=1&sesion=5");
    await esperar();
    expect(document.querySelector(".enlace")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Primer Parcial" }));
    await esperar();
    fireEvent.click(screen.getByRole("button", { name: /Ver la sesión de Bruno Pérez/i }));
    await esperar();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Bruno Pérez");
    expect(screen.getByText(EN_VIVO)).toBeInTheDocument();
    expect(screen.queryByText(QUIETO)).not.toBeInTheDocument();
  });

  it("A2: al abrir una sesión el foco va al nombre del alumno y el título lo dice; al volver, al «Ver» de esa fila", async () => {
    montar("/panel?examen=1");
    await esperar();
    expect(document.title).toBe("Primer Parcial — SAMCE");

    const ver = screen.getByRole("button", { name: /Ver la sesión de Bruno Pérez/i });
    ver.focus();
    fireEvent.click(ver);
    await esperar();
    const h1 = screen.getByRole("heading", { level: 1, name: "Bruno Pérez" });
    expect(h1).toHaveFocus();
    expect(h1).toHaveAttribute("tabindex", "-1");
    expect(document.title).toBe("Bruno Pérez — SAMCE");

    fireEvent.click(screen.getByRole("button", { name: "Atrás del navegador" }));
    await esperar();
    expect(screen.getByRole("heading", { level: 1, name: "Primer Parcial" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver la sesión de Bruno Pérez/i })).toHaveFocus();
    expect(document.title).toBe("Primer Parcial — SAMCE");
  });

  it("A2: abrir el panel directamente en una sesión no mueve el foco", async () => {
    montar("/panel?examen=1&sesion=6");
    await esperar();
    expect(screen.getByRole("heading", { level: 1, name: "Bruno Pérez" })).not.toHaveFocus();
  });

  it("si el registro no se puede actualizar, el pulso no dice «En vivo» aunque la lista ande", async () => {
    vi.mocked(sesionesService.traerEventos)
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("sin red"))
      .mockResolvedValue([]);
    montar("/panel?examen=1&sesion=6");
    await esperar();
    expect(screen.getByText(EN_VIVO)).toBeInTheDocument();

    await esperar(5000);
    expect(screen.getByText(/No se pudo actualizar el registro/)).toBeInTheDocument();
    expect(screen.getByText(SIN_CONEXION)).toBeInTheDocument();
    expect(screen.queryByText(EN_VIVO)).not.toBeInTheDocument();

    // Cuando el registro vuelve a contestar, el pulso vuelve con él.
    await esperar(5000);
    expect(screen.queryByText(/No se pudo actualizar el registro/)).not.toBeInTheDocument();
    expect(screen.getByText(EN_VIVO)).toBeInTheDocument();
  });

  it("la consulta del panel cada cinco segundos no vuelve a montar el registro abierto", async () => {
    // Con un evento el cursor avanza: un registro montado de nuevo volvería a cero.
    vi.mocked(sesionesService.traerEventos).mockResolvedValueOnce([evento(9, "focus_lost")]);
    montar("/panel?examen=1&sesion=6");
    await esperar();
    await esperar(12_000);

    // Si se montara de nuevo, volvería a pedir el registro desde el principio.
    const desdeCero = vi.mocked(sesionesService.traerEventos).mock.calls.filter(([, , despues]) => despues === 0);
    expect(desdeCero).toHaveLength(1);
  });

  it("la cuenta del pulso vuelve a empezar con cada respuesta", async () => {
    montar("/panel?examen=1&sesion=6");
    await esperar();
    expect(screen.getByText(/se actualiza en 5 s/)).toBeInTheDocument();

    await esperar(3000);
    expect(screen.getByText(/se actualiza en 2 s/)).toBeInTheDocument();

    await esperar(2000);
    expect(screen.getByText(/se actualiza en 5 s/)).toBeInTheDocument();
  });
});

describe("Las páginas de sesiones de un examen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ingresar();
    vi.spyOn(sesionesService, "traerExamenes").mockResolvedValue([{ ...EXAMEN, closed_sessions: 120 }]);
    simularSesiones([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("al volver a entrar a un examen empieza de nuevo por las primeras 50", async () => {
    const traer = vi.mocked(sesionesService.traerSesiones);
    montar("/panel?examen=1");
    await esperar();
    fireEvent.click(screen.getByRole("button", { name: "Ver más sesiones" }));
    await esperar();
    expect(traer).toHaveBeenLastCalledWith(1, 100, expect.anything());

    fireEvent.click(screen.getByRole("button", { name: "Sistemas de Información II" }));
    await esperar();
    fireEvent.click(screen.getByRole("button", { name: /Primer Parcial/ }));
    await esperar();

    expect(traer).toHaveBeenLastCalledWith(1, 50, expect.anything());
  });

  // Con el número de páginas reiniciado por un efecto, el cambio de examen
  // salía primero con el número viejo y enseguida se rehacía: dos consultas
  // donde hace falta una.
  it("al pasar directo a otro examen consulta una sola vez, ya con las primeras 50", async () => {
    vi.mocked(sesionesService.traerExamenes).mockResolvedValue([
      { ...EXAMEN, closed_sessions: 120 },
      { ...EXAMEN, id: 2, name: "Segundo Parcial", closed_sessions: 120 },
    ]);
    const traer = vi.mocked(sesionesService.traerSesiones);
    montar("/panel?examen=1", ["/panel?examen=2"]);
    await esperar();
    fireEvent.click(screen.getByRole("button", { name: "Ver más sesiones" }));
    await esperar();
    expect(traer).toHaveBeenLastCalledWith(1, 100, expect.anything());

    const examenesAntes = vi.mocked(sesionesService.traerExamenes).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Atrás del navegador" }));
    await esperar();

    expect(vi.mocked(sesionesService.traerExamenes).mock.calls.length).toBe(examenesAntes + 1);
    expect(traer).not.toHaveBeenCalledWith(2, 100, expect.anything());
    expect(traer).toHaveBeenLastCalledWith(2, 50, expect.anything());
  });
});

describe("Los dos pedidos de la lista salen a la vez", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ingresar();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("las sesiones se piden sin esperar a la lista de exámenes", async () => {
    let contestarExamenes: (lista: sesionesService.ExamenMonitoreado[]) => void = () => undefined;
    vi.spyOn(sesionesService, "traerExamenes").mockReturnValue(
      new Promise((listo) => {
        contestarExamenes = listo;
      })
    );
    const traer = simularSesiones([rindiendo]);
    montar("/panel?examen=1&nivel=high");
    await esperar();
    // La lista de exámenes todavía no contestó, y las sesiones ya se pidieron, con el filtro de la dirección.
    expect(traer).toHaveBeenCalledWith(1, 50, expect.objectContaining({ nivel: "high" }));

    contestarExamenes([EXAMEN]);
    await esperar();
    expect(screen.getByRole("heading", { level: 1, name: "Primer Parcial" })).toBeInTheDocument();
  });

  it("de un examen que no es del docente, el rechazo del backend no se toma como un corte", async () => {
    vi.spyOn(sesionesService, "traerExamenes").mockResolvedValue([EXAMEN]);
    vi.spyOn(sesionesService, "traerSesiones").mockRejectedValue(new Error("Error 404"));
    montar("/panel?examen=999");
    await esperar();
    // Vuelve a los exámenes del curso, sin avisar un problema de conexión que no hubo.
    expect(screen.getByRole("heading", { level: 1, name: "Sistemas de Información II" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Primer Parcial/ })).toBeInTheDocument();
    expect(screen.queryByText(SIN_CONEXION)).toBeNull();
  });

  it("de un examen del docente, un fallo de red sí es un corte", async () => {
    vi.spyOn(sesionesService, "traerExamenes").mockResolvedValue([EXAMEN]);
    vi.spyOn(sesionesService, "traerSesiones").mockRejectedValue(new TypeError("Failed to fetch"));
    montar("/panel?examen=1");
    await esperar();
    expect(screen.getByText(SIN_CONEXION)).toBeInTheDocument();
  });

  it("si el token venció al pedir las sesiones, se avisa la sesión vencida y no un corte", async () => {
    vi.spyOn(sesionesService, "traerExamenes").mockResolvedValue([EXAMEN]);
    vi.spyOn(sesionesService, "traerSesiones").mockRejectedValue(new sesionesService.SesionVencida());
    montar("/panel?examen=1");
    await esperar();
    expect(screen.queryByText(SIN_CONEXION)).toBeNull();
    expect(screen.queryByRole("heading", { level: 1, name: "Primer Parcial" })).toBeNull();
  });
});
