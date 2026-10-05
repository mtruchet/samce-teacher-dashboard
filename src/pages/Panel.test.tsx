import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sesionesService from "../services/sesionesService";
import { esperar, evento } from "../test/fabricas";
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
const QUIETO = "Intento terminado, el registro ya no se actualiza";
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
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue([entregadaHaceRato(), rindiendo]);
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("en una sesión cerrada hace más de diez minutos dice que el registro ya no se actualiza", async () => {
    montar("/panel?examen=1&sesion=5");
    await esperar();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ana Gómez");
    expect(screen.getByText(QUIETO)).toBeInTheDocument();
    expect(screen.queryByText(EN_VIVO)).not.toBeInTheDocument();
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
        limite > sesionesService.SESIONES_POR_PAGINA ? [...primeraPagina, vieja] : primeraPagina
    );

    montar("/panel?examen=1&sesion=55");
    await esperar();

    expect(sesionesService.traerSesiones).toHaveBeenLastCalledWith(1, 2 * sesionesService.SESIONES_POR_PAGINA);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Carla Ruiz");
  });

  it("si se corta la lista de sesiones, eso se avisa antes que el registro quieto", async () => {
    montar("/panel?examen=1&sesion=5");
    await esperar();
    expect(screen.getByText(QUIETO)).toBeInTheDocument();

    vi.mocked(sesionesService.traerExamenes).mockRejectedValue(new Error("sin red"));
    await esperar(5000);

    expect(screen.getByText(SIN_CONEXION)).toBeInTheDocument();
    expect(screen.queryByText(QUIETO)).not.toBeInTheDocument();
  });

  it("al entrar a otra sesión que sigue abierta, el pulso vuelve a decir «En vivo»", async () => {
    montar("/panel?examen=1&sesion=5");
    await esperar();
    expect(screen.getByText(QUIETO)).toBeInTheDocument();

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
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue([]);
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
    expect(traer).toHaveBeenLastCalledWith(1, 100);

    fireEvent.click(screen.getByRole("button", { name: "Sistemas de Información II" }));
    await esperar();
    fireEvent.click(screen.getByRole("button", { name: /Primer Parcial/ }));
    await esperar();

    expect(traer).toHaveBeenLastCalledWith(1, 50);
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
    expect(traer).toHaveBeenLastCalledWith(1, 100);

    const examenesAntes = vi.mocked(sesionesService.traerExamenes).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Atrás del navegador" }));
    await esperar();

    expect(vi.mocked(sesionesService.traerExamenes).mock.calls.length).toBe(examenesAntes + 1);
    expect(traer).not.toHaveBeenCalledWith(2, 100);
    expect(traer).toHaveBeenLastCalledWith(2, 50);
  });
});
