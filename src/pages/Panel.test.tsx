import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sesionesService from "../services/sesionesService";
import { esperar, evento, pagina, simularSesiones } from "../test/fabricas";
import { Panel } from "./Panel";

/**
 * El panel montado solo, con relojes falsos: el pulso de la cabecera en el
 * registro de un intento, y las páginas de sesiones de un examen.
 *
 * Van acá y no en App.test.tsx porque necesitan relojes falsos: el corte de la
 * lista recién se ve en la segunda consulta, cinco segundos después, y con la
 * app entera las pantallas se cargan con `lazy`, que los relojes falsos no
 * esperan. Montando el panel solo, cada espera es exacta y no depende de lo
 * que tarde la máquina en correr la prueba.
 */

const SESION = {
  token: "session-jwt",
  username: "docente.demo",
  displayName: "Docente de Prueba",
  role: "docente",
  courseId: 2,
  courseName: "Sistemas de Información II",
};

const EXAMEN: sesionesService.ExamenMonitoreado = {
  id: 1,
  moodle_course_id: 2,
  moodle_quiz_id: 1,
  name: "Primer Parcial",
  created_at: "2026-08-26T14:00:00Z",
  open_sessions: 1,
  closed_sessions: 1,
  abandoned_sessions: 0,
};

const EN_VIVO = /En vivo, se actualiza en/;
const QUIETO = "Examen terminado";
const SIN_CONEXION = "No se pudo actualizar esta pantalla. Reintentando.";

/** Una sesión que se entregó hace una hora: el registro se pide una vez y listo. */
function entregadaHaceRato(): sesionesService.Sesion {
  return {
    id: 5,
    moodle_attempt_id: 7001,
    moodle_user_id: 41,
    student_name: "Ana Gómez",
    status: "closed",
    started_at: "2026-08-26T14:02:00Z",
    closed_at: new Date(Date.now() - 60 * 60_000).toISOString(),
  };
}

const rindiendo: sesionesService.Sesion = {
  id: 6,
  moodle_attempt_id: 7002,
  moodle_user_id: 42,
  student_name: "Bruno Pérez",
  status: "open",
  started_at: "2026-08-26T14:03:00Z",
};

/** El botón «Atrás» del navegador, para las pruebas que recorren el historial. */
function Atras() {
  const navegar = useNavigate();
  return <button onClick={() => navegar(-1)}>Atrás del navegador</button>;
}

function montar(direccion: string, antes: string[] = []) {
  return render(
    <MemoryRouter initialEntries={[...antes, direccion]} initialIndex={antes.length}>
      <Atras />
      <Panel />
    </MemoryRouter>
  );
}

describe("El pulso del panel en el registro de un intento", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    sessionStorage.setItem("samce_session", JSON.stringify(SESION));
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

  it("al entrar a otra sesión que sigue abierta, el pulso vuelve a decir «En vivo»", async () => {
    montar("/panel?examen=1&sesion=5");
    await esperar();
    expect(document.querySelector(".enlace")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Primer Parcial" }));
    await esperar();
    fireEvent.click(screen.getByRole("button", { name: /Ver los eventos de Bruno Pérez/i }));
    await esperar();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Bruno Pérez");
    expect(screen.getByText(EN_VIVO)).toBeInTheDocument();
    expect(screen.queryByText(QUIETO)).not.toBeInTheDocument();
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
    sessionStorage.clear();
    sessionStorage.setItem("samce_session", JSON.stringify(SESION));
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

describe("Los filtros de la lista de sesiones", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    sessionStorage.setItem("samce_session", JSON.stringify(SESION));
    vi.spyOn(sesionesService, "traerExamenes").mockResolvedValue([EXAMEN, { ...EXAMEN, id: 2, name: "Segundo Parcial" }]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("pide la lista con los filtros de la dirección en cada vuelta", async () => {
    const traer = simularSesiones([rindiendo]);
    montar("/panel?examen=1&nivel=high&estado=open&q=bru&orden=risk_level");
    await esperar();
    expect(traer).toHaveBeenLastCalledWith(1, 50, { nivel: "high", estado: "open", analisis: undefined, q: "bru", orden: "risk_level" });
    await esperar(sesionesService.CADENCIA_MS);
    expect(traer.mock.calls.length).toBeGreaterThan(1);
    expect(traer).toHaveBeenLastCalledWith(1, 50, expect.objectContaining({ nivel: "high", q: "bru" }));
  });

  it("con un filtro dice «N de M sesiones» y no dibuja el grupo vacío", async () => {
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([rindiendo], 1));
    montar("/panel?examen=1&nivel=high");
    await esperar();
    // Una vez a la vista y una en la región viva.
    expect(screen.getAllByText("1 de 2 sesiones")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "En curso" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Finalizadas" })).toBeNull();
  });

  it("«N de M» se anuncia una vez por filtro: el refresco cambia la cifra a la vista sin volver a anunciarla", async () => {
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([rindiendo], 1));
    montar("/panel?examen=1&nivel=high");
    await esperar();
    const viva = () => screen.getAllByRole("status").find((r) => /de \d+ sesiones/.test(r.textContent ?? ""));
    expect(viva()).toHaveTextContent("1 de 2 sesiones");
    const nodo = viva()!.firstElementChild;
    vi.mocked(sesionesService.traerExamenes).mockResolvedValue([{ ...EXAMEN, open_sessions: 2 }]);
    await esperar(sesionesService.CADENCIA_MS);
    expect(document.querySelector(".filtros-resultado")).toHaveTextContent("1 de 3 sesiones");
    expect(viva()).toHaveTextContent("1 de 2 sesiones");
    expect(viva()!.firstElementChild).toBe(nodo);
  });

  it("al volver del detalle a una lista filtrada no muestra el total del examen como si fuera el del filtro", async () => {
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([]);
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue({
      state: "not_analyzed", reason: null, calculated_at: null, alerts: [],
    });
    // El detalle pide sin filtrar y recibe las dos sesiones del examen. La lista filtrada, al volver, todavía
    // no contestó: hasta que conteste no hay cifra que mostrar.
    vi.spyOn(sesionesService, "traerSesiones").mockImplementation((_examen, _limite, filtros) =>
      filtros?.nivel ? new Promise(() => undefined) : Promise.resolve(pagina([rindiendo, entregadaHaceRato()], 2))
    );
    montar("/panel?examen=1&sesion=6&nivel=high", ["/panel?examen=1&nivel=high"]);
    await esperar();
    expect(screen.getByRole("heading", { level: 1, name: "Bruno Pérez" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Atrás del navegador" }));
    await esperar();
    expect(screen.queryByText(/\d+ de \d+ sesiones/)).toBeNull();
    expect(document.querySelector(".filtros-resultado")).toHaveTextContent("");
  });

  it("si ninguna coincide lo dice, y «Quitar filtros» vuelve a la lista completa", async () => {
    const traer = vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([], 0));
    montar("/panel?examen=1&nivel=high&q=nadie&orden=risk_level");
    await esperar();
    expect(screen.getByText("Ninguna sesión coincide con el filtro.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Quitar filtros" }));
    await esperar();
    // Quita los filtros y conserva el orden elegido.
    expect(traer).toHaveBeenLastCalledWith(1, 50, { nivel: undefined, estado: undefined, analisis: undefined, q: undefined, orden: "risk_level" });
  });

  it("elegir un nivel en la barra lo pide, y la búsqueda espera a que se deje de escribir", async () => {
    const traer = simularSesiones([rindiendo]);
    montar("/panel?examen=1");
    await esperar();

    fireEvent.change(screen.getByLabelText("Nivel de riesgo"), { target: { value: "medium" } });
    await esperar();
    expect(traer).toHaveBeenLastCalledWith(1, 50, expect.objectContaining({ nivel: "medium" }));

    fireEvent.change(screen.getByLabelText("Buscar alumno"), { target: { value: "Ana" } });
    await esperar(100);
    expect(traer).not.toHaveBeenLastCalledWith(1, 50, expect.objectContaining({ q: "Ana" }));
    await esperar(300);
    expect(traer).toHaveBeenLastCalledWith(1, 50, expect.objectContaining({ nivel: "medium", q: "Ana" }));
  });

  it("con una sesión abierta en el detalle, la lista se pide sin filtrar", async () => {
    const traer = simularSesiones([rindiendo]);
    montar("/panel?examen=1&sesion=6&nivel=high&estado=finished");
    await esperar();
    expect(traer).toHaveBeenLastCalledWith(1, 50, { orden: undefined });
  });

  it("el intento sale del backend cuando lo manda", async () => {
    simularSesiones([{ ...rindiendo, attempt_number: 2, attempts_total: 3 }]);
    montar("/panel?examen=1");
    await esperar();
    expect(screen.getByText("intento 2 de 3")).toBeInTheDocument();
  });
});

describe("El resumen de la evaluación en el panel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    sessionStorage.setItem("samce_session", JSON.stringify(SESION));
    vi.spyOn(sesionesService, "traerExamenes").mockResolvedValue([EXAMEN]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const RESUMEN = { total: 2, risk_high: 1, risk_medium: 0, risk_low: 0, no_alerts: 1, not_analyzed: 0, insufficient_evidence: 0, unavailable: 0 };

  it("se dibuja arriba de la lista y una tarjeta filtra la lista", async () => {
    const traer = vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue({ sesiones: [rindiendo], total: 2, resumen: RESUMEN });
    montar("/panel?examen=1");
    await esperar();
    fireEvent.click(screen.getByRole("button", { name: "Riesgo alto: 1 sesión" }));
    await esperar();
    expect(traer).toHaveBeenLastCalledWith(1, 50, expect.objectContaining({ nivel: "high" }));
    expect(screen.getByLabelText("Nivel de riesgo")).toHaveValue("high");
  });

  it("con un backend sin el resumen no se dibuja", async () => {
    simularSesiones([rindiendo]);
    montar("/panel?examen=1");
    await esperar();
    expect(screen.queryByRole("heading", { name: "Resumen de la evaluación" })).toBeNull();
  });
});
