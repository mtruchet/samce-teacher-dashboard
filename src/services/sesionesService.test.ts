import { beforeEach, describe, expect, it, vi } from "vitest";
import { EVENTOS_POR_PAGINA, SESIONES_TOPE, SesionVencida, nombreDeAlumno, traerEventos, traerSesiones } from "./sesionesService";

function guardarSesion() {
  sessionStorage.setItem(
    "samce_session",
    JSON.stringify({
      token: "session-jwt",
      username: "docente.demo",
      displayName: "Docente de Prueba",
      role: "docente",
      courseId: 2,
      courseName: "Sistemas de Información II",
    })
  );
}

describe("traerEventos", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    guardarSesion();
  });

  it("pide los eventos de la sesión del examen, con la sesión del panel", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [{ seq: 1 }] });
    vi.stubGlobal("fetch", fetch);

    const eventos = await traerEventos(3, 7);

    expect(eventos).toEqual([{ seq: 1 }]);
    const [url, opciones] = fetch.mock.calls[0];
    expect(url).toBe(`http://localhost:8080/monitored-quizzes/3/sessions/7/events?limit=${EVENTOS_POR_PAGINA}&after_id=0`);
    expect(opciones.headers.Authorization).toBe("Bearer session-jwt");
  });

  it("pide solo lo posterior a lo que ya tiene", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal("fetch", fetch);

    await traerEventos(3, 7, 441);

    expect(fetch.mock.calls[0][0]).toContain("after_id=441");
    // El cursor es el orden de llegada: con after_seq se perdían los eventos que llegaban tarde.
    expect(fetch.mock.calls[0][0]).not.toContain("after_seq");
  });

  it("la primera vez pide desde el principio, con after_id en cero", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal("fetch", fetch);

    await traerEventos(3, 7, 0);

    expect(fetch.mock.calls[0][0]).toContain("after_id=0");
  });

  it("distingue la sesión vencida de cualquier otro fallo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    await expect(traerEventos(3, 7)).rejects.toBeInstanceOf(SesionVencida);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const error = await traerEventos(3, 7).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(SesionVencida);
  });

  it("sin sesión guardada no llama al backend", async () => {
    sessionStorage.clear();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await expect(traerEventos(3, 7)).rejects.toBeInstanceOf(SesionVencida);
    expect(fetch).not.toHaveBeenCalled();
  });
});

// El backend manda un `moodle_user_id` negativo cuando no pudo descifrar la
// identidad del alumno: un centinela, único por sesión, para que el panel no
// junte por error sesiones sin relación. Mostrarlo como «Alumno -29» sería
// enseñar un número interno como si fuera un legajo.
describe("nombreDeAlumno", () => {
  it("usa el nombre cuando llegó", () => {
    expect(nombreDeAlumno({ student_name: "Ana Gómez", moodle_user_id: 41 })).toBe("Ana Gómez");
  });

  it("cae al número del aula virtual cuando no hay nombre", () => {
    expect(nombreDeAlumno({ student_name: "", moodle_user_id: 41 })).toBe("Alumno 41");
  });

  it("no muestra el centinela negativo, porque no identifica a nadie", () => {
    expect(nombreDeAlumno({ student_name: "", moodle_user_id: -29 })).toBe("Alumno sin identificar");
  });
});

describe("traerSesiones", () => {
  beforeEach(() => {
    sessionStorage.clear();
    guardarSesion();
  });

  it("pide las del examen con el límite en la dirección, sin pasar el tope del backend", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal("fetch", fetch);

    await traerSesiones(3, 100);
    await traerSesiones(3, SESIONES_TOPE + 50);

    expect(fetch.mock.calls[0][0]).toBe("http://localhost:8080/monitored-quizzes/3/sessions?limit=100");
    expect(fetch.mock.calls[1][0]).toContain(`limit=${SESIONES_TOPE}`);
  });
});
