import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "./App";
import * as authService from "./services/authService";
import * as sesionesService from "./services/sesionesService";

const SESION = {
  token: "session-jwt",
  username: "docente.demo",
  displayName: "Docente de Prueba",
  role: "docente",
  courseId: 2,
  courseName: "Sistemas de Información II",
};

function guardarSesion() {
  sessionStorage.setItem("samce_session", JSON.stringify(SESION));
}

describe("Enrutado y acceso", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.pushState({}, "", "/");
    vi.restoreAllMocks();
    // Sin estos dos, el panel sale a buscar de verdad contra localhost:8080 y
    // la prueba pasa o falla según si el backend está levantado en la máquina
    // de quien la corre. Cada prueba que necesite otra respuesta la pisa.
    vi.spyOn(sesionesService, "traerExamenes").mockResolvedValue([]);
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue([]);
  });

  it("muestra la página pública en la raíz", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(/sin vigilar a nadie/i);
    // El nombre del ítem aparece dos veces a propósito: en el paso escrito y en
    // el menú dibujado. Si alguna vez queda uno solo, el instructivo perdió una
    // de las dos mitades.
    expect(screen.getAllByText(/Panel de supervisión SAMCE/i)).toHaveLength(2);
  });

  it("presenta en la página pública las dos tecnologías del sistema", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: /El alumno sabe, y acepta/i })).toBeInTheDocument();
    expect(screen.getByText(/Machine Learning y Blockchain/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /se puede probar/i })).toBeInTheDocument();
  });

  it("declara en la página pública qué no hace el sistema", async () => {
    render(<App />);

    // Sin la sección de límites, el aviso al alumno es el único lugar donde la
    // página dice qué queda fuera del registro. Si esto se cae, la declaración
    // desaparece entera.
    expect(await screen.findByText(/no se lee lo que escribís/i)).toBeInTheDocument();
    expect(screen.getByText(/Sin cámara, sin micrófono/i)).toBeInTheDocument();
  });

  it("canjea el token de lanzamiento y entra al panel", async () => {
    window.history.pushState({}, "", "/auth/callback?token=un-token-de-lanzamiento");
    vi.spyOn(authService, "verifyMoodleLaunch").mockImplementation(async () => {
      guardarSesion();
      return SESION;
    });

    render(<App />);

    expect(await screen.findByText(/Verificando el acceso/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Escuchando el aula virtual/i })
      ).toBeInTheDocument();
    });
    expect(authService.verifyMoodleLaunch).toHaveBeenCalledWith("un-token-de-lanzamiento");
  });

  it("explica en castellano qué hacer cuando el traspaso falla, sin mostrar el error técnico", async () => {
    window.history.pushState({}, "", "/auth/callback?token=un-token-invalido");
    vi.spyOn(authService, "verifyMoodleLaunch").mockRejectedValue(
      new Error("moodle launch verification failed with status 401"),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/No pudimos validar el acceso/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/vence a los pocos segundos/i)).toBeInTheDocument();
    // El mensaje del backend no debe llegar a la pantalla del docente.
    expect(screen.queryByText(/status 401/i)).not.toBeInTheDocument();
  });

  it("avisa igual cuando la dirección llega sin token", async () => {
    window.history.pushState({}, "", "/auth/callback");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/No pudimos validar el acceso/i)).toBeInTheDocument();
    });
  });

  it("no deja entrar al panel sin sesión, y explica adónde va", async () => {
    window.history.pushState({}, "", "/panel");

    render(<App />);

    // No salta a otra página sin avisar: dice qué pasó y adónde lleva.
    expect(
      await screen.findByRole("heading", { name: /Al panel se entra desde el aula virtual/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Escuchando el aula virtual/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ir ahora al aula virtual/i })).toBeInTheDocument();
  });

  it("expulsa del panel cuando la sesión guardada está rota", async () => {
    // Un objeto verdadero pero sin los campos de una sesión: antes alcanzaba
    // para abrir el área privada.
    sessionStorage.setItem("samce_session", JSON.stringify({ algo: "raro" }));
    window.history.pushState({}, "", "/panel");

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /Al panel se entra desde el aula virtual/i })
    ).toBeInTheDocument();
    expect(sessionStorage.getItem("samce_session")).toBeNull();
  });

  it("deja entrar al panel con una sesión guardada y muestra su identidad", async () => {
    guardarSesion();
    window.history.pushState({}, "", "/panel");

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Escuchando el aula virtual/i })
      ).toBeInTheDocument();
    });
    // La barra muestra el nombre real, no el usuario ni el id, y al lado el
    // atajo a todos sus cursos. La materia es el título de la pantalla, y con
    // eso alcanza: repetirla en la barra no agregaba nada.
    expect(screen.getByText("Docente de Prueba")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Todos mis cursos/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sistemas de Información II" })).toBeInTheDocument();
    // El rol no se muestra: al panel solo entra quien tiene la capacidad.
    expect(screen.queryByText(/^docente$/)).not.toBeInTheDocument();
  });

  it("dice que todavía no hay ningún examen en curso", async () => {
    guardarSesion();
    window.history.pushState({}, "", "/panel");

    render(<App />);

    // Sin sesiones que listar, lo que corresponde es decir que se está
    // esperando, no simular una tabla vacía.
    await waitFor(() => {
      expect(screen.getByText(/todavía no hay ningún examen en curso/i)).toBeInTheDocument();
    });
  });

  it("expulsa del panel cuando el backend rechaza la sesión", async () => {
    guardarSesion();
    // Un 401 del backend llega al panel como SesionVencida. Que pase después de
    // un rato mirando —el token dura ocho horas— lo cubre la prueba de punta a
    // punta; acá lo que importa es qué hace el panel cuando llega.
    vi.spyOn(sesionesService, "traerExamenes").mockRejectedValue(
      new sesionesService.SesionVencida(),
    );
    window.history.pushState({}, "", "/panel?examen=1");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /Tu sesión venció/i })).toBeInTheDocument();
    // No se queda diciendo que es un problema de red sobre una lista congelada.
    expect(screen.queryByText(/Sin conexión/i)).not.toBeInTheDocument();
    // Y la sesión que ya no vale no queda guardada en el navegador.
    expect(sessionStorage.getItem("samce_session")).toBeNull();
  });

  it("con el lanzamiento general muestra todos los cursos y de cuál es cada fila", async () => {
    // El token del enlace general trae la lista de cursos en vez de uno solo.
    sessionStorage.setItem(
      "samce_session",
      JSON.stringify({
        token: "session-jwt",
        username: "docente.demo",
        displayName: "Docente de Prueba",
        role: "docente",
        courseId: 0,
        courseName: "",
        courses: [
          { id: 2, name: "Sistemas de Información II" },
          { id: 3, name: "Bases de Datos" },
        ],
      }),
    );
    vi.spyOn(sesionesService, "traerExamenes").mockResolvedValue([
      { id: 1, moodle_course_id: 2, moodle_quiz_id: 1, name: "Primer Parcial", created_at: "2026-08-26T14:00:00Z" },
      { id: 2, moodle_course_id: 3, moodle_quiz_id: 9, name: "Final", created_at: "2026-08-26T14:00:00Z" },
    ]);
    vi.spyOn(sesionesService, "traerSesiones").mockImplementation(async (examenId: number) => [
      {
        id: examenId,
        moodle_attempt_id: 7000 + examenId,
        moodle_user_id: 40 + examenId,
        student_name: examenId === 1 ? "Ana Gómez" : "Bruno Pérez",
        status: "open" as const,
        started_at: "2026-08-26T14:02:00Z",
      },
    ]);
    window.history.pushState({}, "", "/panel");

    render(<App />);

    // Primer escalón: sus cursos, con lo que está pasando en cada uno. Salen
    // del token, así que aparecen todos y no sólo los que tienen examen.
    const suCurso = await screen.findByRole("button", { name: /Sistemas de Información II/i, });
    expect(suCurso).toHaveTextContent(/1 rindiendo/);
    expect(screen.getByRole("button", { name: /Bases de Datos/i })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    // Estando en el general, el atajo del encabezado no sale al campus: lleva a
    // este mismo primer escalón, así que es un botón y no un enlace.
    expect(screen.queryByRole("link", { name: /Todos mis cursos/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Todos mis cursos/i })).toBeInTheDocument();

    // Segundo escalón: los exámenes de ese curso, y sólo de ese curso.
    fireEvent.click(suCurso);
    expect(await screen.findByRole("button", { name: /Primer Parcial/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Final/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sistemas de Información II" })).toBeInTheDocument();

    // Tercer escalón: recién acá, los alumnos rindiendo.
    fireEvent.click(screen.getByRole("button", { name: /Primer Parcial/i }));
    expect(await screen.findByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Primer Parcial" })).toBeInTheDocument();

    // Y el rastro deja volver a cualquier escalón anterior. Se lo busca dentro
    // del rastro porque la barra tiene otro botón que lleva al mismo lado.
    const rastro = screen.getByRole("navigation", { name: /Dónde estás/i });
    fireEvent.click(within(rastro).getByRole("button", { name: "Todos mis cursos" }));
    expect(await screen.findByRole("button", { name: /Bases de Datos/i })).toBeInTheDocument();
  });

  it("desde un curso el encabezado ofrece todos sus cursos, y es un enlace al campus", async () => {
    guardarSesion();
    vi.spyOn(sesionesService, "traerExamenes").mockResolvedValue([
      { id: 1, moodle_course_id: 2, moodle_quiz_id: 1, name: "Primer Parcial", created_at: "2026-08-26T14:00:00Z" },
    ]);
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue([
      { id: 1, moodle_attempt_id: 7001, moodle_user_id: 41, student_name: "Ana Gómez", status: "open", started_at: "2026-08-26T14:02:00Z" },
    ]);
    window.history.pushState({}, "", "/panel");

    render(<App />);

    const salto = await screen.findByRole("link", { name: /Todos mis cursos/i });
    // Va al campus y no a la API: el token nuevo lo tiene que firmar Moodle,
    // que es el único que sabe en qué cursos da clase el docente.
    expect(salto).toHaveAttribute("href", expect.stringContaining("/local/samce/launch_global.php"));
    // Y el encabezado no repite el nombre de la materia, que ya es el título de
    // la pantalla: ese rótulo además no llevaba a ninguna parte, porque entrando
    // desde un curso este ya es el primer escalón.
    expect(screen.getByRole("heading", { name: "Sistemas de Información II" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sistemas de Información II" })
    ).not.toBeInTheDocument();
    // Y mirando un curso solo, su nombre no se repite en cada fila.
    expect(screen.queryByRole("columnheader", { name: "Curso" })).not.toBeInTheDocument();
  });

  it("lista las sesiones que devuelve el backend", async () => {
    guardarSesion();
    vi.spyOn(sesionesService, "traerExamenes").mockResolvedValue([
      { id: 1, moodle_course_id: 2, moodle_quiz_id: 1, name: "Primer Parcial", created_at: "2026-08-26T14:00:00Z" },
    ]);
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue([
      { id: 1, moodle_attempt_id: 7001, moodle_user_id: 41, student_name: "Ana Gómez", status: "open", started_at: "2026-08-26T14:02:00Z" },
      { id: 2, moodle_attempt_id: 7002, moodle_user_id: 42, student_name: "Bruno Pérez", status: "closed", started_at: "2026-08-26T14:01:00Z", closed_at: "2026-08-26T14:40:00Z" },
    ]);
    window.history.pushState({}, "", "/panel");

    render(<App />);

    // La ficha adelanta lo que hay adentro, para no tener que entrar a cada
    // examen a ver si pasa algo.
    const ficha = await screen.findByRole("button", { name: /Primer Parcial/i });
    expect(ficha).toHaveTextContent(/1 rindiendo/);
    expect(ficha).toHaveTextContent(/1 entregada/);

    // Y al elegirlo se ven sus sesiones.
    fireEvent.click(ficha);
    // El alumno se identifica por su id del aula virtual, que es el puente
    // hacia el campus: el panel no guarda nombres.
    expect(await screen.findByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Finalizadas/i })).toBeInTheDocument();
    // Cada alumno aparece una sola vez, así que el número de intento —que es un
    // identificador interno de Moodle— no hace falta para distinguirlos.
    expect(screen.queryByText(/^intento \d+$/)).not.toBeInTheDocument();
  });

  it("aclara con qué número de intento va cada alumno que rindió más de una vez", async () => {
    guardarSesion();
    vi.spyOn(sesionesService, "traerExamenes").mockResolvedValue([
      { id: 1, moodle_course_id: 2, moodle_quiz_id: 1, name: "Primer Parcial", created_at: "2026-08-26T14:00:00Z" },
    ]);
    // El 41 rindió dos veces. Los identificadores de Moodle vienen desordenados
    // y salteados a propósito: el número que se muestra no sale de ahí.
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue([
      { id: 1, moodle_attempt_id: 90004, moodle_user_id: 41, student_name: "Ana Gómez", status: "open", started_at: "2026-08-26T15:00:00Z" },
      { id: 2, moodle_attempt_id: 7001, moodle_user_id: 41, student_name: "Ana Gómez", status: "closed", started_at: "2026-08-26T14:00:00Z", closed_at: "2026-08-26T14:30:00Z" },
      { id: 3, moodle_attempt_id: 8002, moodle_user_id: 42, student_name: "Bruno Pérez", status: "open", started_at: "2026-08-26T14:10:00Z" },
    ]);
    window.history.pushState({}, "", "/panel?examen=1");

    render(<App />);

    // Se numeran por orden de comienzo, no por el identificador de Moodle: el
    // que empezó a las 14 es el primero aunque su id sea el más chico.
    expect(await screen.findByText(/intento 1 de 2/)).toBeInTheDocument();
    expect(screen.getByText(/intento 2 de 2/)).toBeInTheDocument();
    expect(screen.queryByText(/90004|7001|8002/)).not.toBeInTheDocument();
    // Al que rindió una sola vez no se le aclara nada.
    expect(screen.queryByText(/de 1$/)).not.toBeInTheDocument();
  });

  it("cae en el número del aula virtual cuando el nombre no llegó", async () => {
    guardarSesion();
    vi.spyOn(sesionesService, "traerExamenes").mockResolvedValue([
      { id: 1, moodle_course_id: 2, moodle_quiz_id: 1, name: "Primer Parcial", created_at: "2026-08-26T14:00:00Z" },
    ]);
    // Una sesión registrada antes de que el aula virtual empezara a mandar el
    // nombre. La fila tiene que seguir sirviendo: sin identificar al alumno no
    // hay nada que supervisar.
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue([
      { id: 1, moodle_attempt_id: 7001, moodle_user_id: 41, student_name: "", status: "open", started_at: "2026-08-26T14:02:00Z" },
      { id: 2, moodle_attempt_id: 7002, moodle_user_id: 42, student_name: "Bruno Pérez", status: "open", started_at: "2026-08-26T14:03:00Z" },
    ]);
    window.history.pushState({}, "", "/panel?examen=1");

    render(<App />);

    expect(await screen.findByText("Alumno 41")).toBeInTheDocument();
    expect(screen.getByText("Bruno Pérez")).toBeInTheDocument();
    // Y el que sí tiene nombre no pierde su número, que es el puente al campus.
    expect(screen.getByText(/Alumno 42/)).toBeInTheDocument();
  });

  it("redirige al inicio cualquier dirección desconocida", () => {
    window.history.pushState({}, "", "/una-ruta-que-no-existe");

    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/sin vigilar a nadie/i);
  });
});
