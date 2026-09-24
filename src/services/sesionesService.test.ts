import { beforeEach, describe, expect, it, vi } from "vitest";
import { EVENTOS_POR_PAGINA, SesionVencida, traerEventos } from "./sesionesService";

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
