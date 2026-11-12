import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sesionesService from "../services/sesionesService";
import { conAnalisis, esperar, pagina, sesion, simularSesiones } from "../test/fabricas";
import { expectLenguajeLlano } from "../test/lenguaje";
import { EXAMEN, direccion, entregadaHaceRato, ingresar, montar, rindiendo, ultimoPedido } from "../test/panel";

/**
 * Los filtros de la lista de sesiones (HU04_T02, §4.1 de la especificación): viven en la dirección, van en
 * cada pedido, sobreviven al refresco, a Atrás y a las migas, y se anuncian una vez por vista.
 */

const CADENCIA = sesionesService.CADENCIA_MS;
const viva = () => screen.getByRole("status", { name: "Resultado del filtro" });
const resultado = () => document.querySelector(".control__resultado");

describe("HU04_T02 §4.1 (pendiente 10): los filtros de la lista de sesiones", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ingresar();
    vi.spyOn(sesionesService, "traerExamenes").mockResolvedValue([EXAMEN, { ...EXAMEN, id: 2, name: "Segundo Parcial" }]);
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([]);
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue({
      state: "not_analyzed", reason: null, calculated_at: null, alerts: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("el filtro sobrevive dos vueltas de la actualización automática", async () => {
    const traer = simularSesiones([rindiendo]);
    montar("/panel?examen=1&nivel=high&estado=open&q=bru&orden=risk_level");
    await esperar();
    const pedido = { nivel: "high", estado: "open", analisis: undefined, q: "bru", orden: "risk_level" };
    expect(traer).toHaveBeenLastCalledWith(1, 50, pedido);

    await esperar(CADENCIA);
    await esperar(CADENCIA);
    expect(traer.mock.calls.length).toBeGreaterThanOrEqual(3);
    for (const [, , filtros] of traer.mock.calls) expect(filtros).toEqual(pedido);
    expect(screen.getByLabelText("Nivel de riesgo")).toHaveValue("high");
    expect(screen.getByLabelText("Buscar alumno")).toHaveValue("bru");
  });

  it("nivel o análisis escritos fuera de la barra (un enlace, una tarjeta) van al pedido", async () => {
    const traer = simularSesiones([rindiendo]);
    montar("/panel?examen=1&analisis=not_analyzed");
    await esperar();
    expect(ultimoPedido()).toEqual(expect.objectContaining({ analisis: "not_analyzed", nivel: undefined }));

    // Un enlace escrito a mano con los dos: los dos se leen, y el que manda es el que se elige después.
    fireEvent.change(screen.getByLabelText("Nivel de riesgo"), { target: { value: "low" } });
    await esperar();
    expect(traer).toHaveBeenLastCalledWith(1, 50, expect.objectContaining({ nivel: "low", analisis: undefined }));
    expect(direccion().get("analisis")).toBeNull();
  });

  it("Atrás vuelve a la vista anterior, y una búsqueda tipeada deja una sola entrada en el historial", async () => {
    simularSesiones([rindiendo]);
    montar("/panel?examen=1");
    await esperar();

    fireEvent.change(screen.getByLabelText("Nivel de riesgo"), { target: { value: "high" } });
    await esperar();
    // Tres pausas al escribir: la primera deja una entrada, las siguientes la reemplazan.
    const campo = screen.getByLabelText("Buscar alumno");
    for (const parcial of ["A", "An", "Ana"]) {
      fireEvent.change(campo, { target: { value: parcial } });
      await esperar(400);
    }
    expect(direccion().toString()).toBe("examen=1&nivel=high&q=Ana");

    fireEvent.click(screen.getByRole("button", { name: "Atrás del navegador" }));
    await esperar();
    expect(direccion().toString()).toBe("examen=1&nivel=high");
    expect(screen.getByLabelText("Buscar alumno")).toHaveValue("");
    expect(ultimoPedido()).toEqual(expect.objectContaining({ nivel: "high", q: undefined }));

    fireEvent.click(screen.getByRole("button", { name: "Atrás del navegador" }));
    await esperar();
    expect(direccion().toString()).toBe("examen=1");
    expect(screen.getByLabelText("Nivel de riesgo")).toHaveValue("");
  });

  it("elegir lo que ya está elegido no deja una entrada nueva en el historial", async () => {
    simularSesiones([rindiendo]);
    montar("/panel?examen=1&nivel=high", ["/panel?examen=1"]);
    await esperar();
    fireEvent.change(screen.getByLabelText("Ordenar por"), { target: { value: "started_at" } });
    await esperar();
    fireEvent.click(screen.getByRole("button", { name: "Atrás del navegador" }));
    await esperar();
    expect(direccion().toString()).toBe("examen=1");
  });

  it("P5: la miga del examen, desde el detalle, vuelve a la lista con el filtro", async () => {
    simularSesiones([rindiendo]);
    montar("/panel?examen=1&sesion=6&nivel=high");
    await esperar();
    expect(screen.getByRole("heading", { level: 1, name: "Bruno Pérez" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Primer Parcial" }));
    await esperar();
    expect(direccion().get("nivel")).toBe("high");
    expect(direccion().get("sesion")).toBeNull();
    expect(screen.getByLabelText("Nivel de riesgo")).toHaveValue("high");
  });

  it("otra evaluación abre sin filtros y con el orden predeterminado", async () => {
    const traer = simularSesiones([rindiendo]);
    montar("/panel?examen=1&nivel=high&orden=risk_level");
    await esperar();

    fireEvent.click(screen.getByRole("button", { name: "Sistemas de Información II" }));
    await esperar();
    fireEvent.click(screen.getByRole("button", { name: /Segundo Parcial/ }));
    await esperar();
    expect(direccion().toString()).toBe("examen=2");
    expect(traer).toHaveBeenLastCalledWith(2, 50, expect.objectContaining({ nivel: undefined, orden: undefined }));
  });

  it("«Ver más sesiones» cuenta con el total del filtro, no con el del examen", async () => {
    vi.mocked(sesionesService.traerExamenes).mockResolvedValue([{ ...EXAMEN, closed_sessions: 200 }]);
    const cincuenta = Array.from({ length: 50 }, (_, i) =>
      sesion({ id: 100 + i, moodle_user_id: 300 + i, moodle_attempt_id: 9000 + i, student_name: `Alumno ${i}`, status: "closed" })
    );
    const traer = vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina(cincuenta, 50));
    montar("/panel?examen=1&estado=finished");
    await esperar();
    // El filtro tiene justo 50: ya están todas, aunque el examen tenga 201.
    expect(resultado()).toHaveTextContent("50 de 201 sesiones");
    expect(screen.queryByRole("button", { name: "Ver más sesiones" })).toBeNull();

    traer.mockResolvedValue(pagina(cincuenta, 80));
    await esperar(CADENCIA);
    fireEvent.click(screen.getByRole("button", { name: "Ver más sesiones" }));
    await esperar();
    expect(traer).toHaveBeenLastCalledWith(1, 100, expect.objectContaining({ estado: "finished" }));
  });

  it("con un filtro, «intento 2 de 3» sale del backend aunque los otros intentos no estén en la lista", async () => {
    simularSesiones([{ ...rindiendo, attempt_number: 2, attempts_total: 3 }]);
    montar("/panel?examen=1&q=bruno");
    await esperar();
    expect(screen.getByText("intento 2 de 3")).toBeInTheDocument();
  });

  it("con un filtro dice «N de M sesiones» y no dibuja el grupo que quedó vacío", async () => {
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(
      pagina([{ ...entregadaHaceRato(), ...conAnalisis("high") }], 1)
    );
    montar("/panel?examen=1&nivel=high");
    await esperar();
    expect(resultado()).toHaveTextContent("1 de 2 sesiones");
    expect(screen.getByRole("heading", { name: "Finalizadas" })).toBeInTheDocument();
    // Bruno sigue rindiendo, pero sin alertas: «En curso» no tiene ninguna de riesgo alto.
    expect(screen.queryByRole("heading", { name: "En curso" })).toBeNull();
    expect(screen.queryByText("No hay sesiones de examen vigentes.")).toBeNull();
  });

  it("con «En curso» y el detalle abierto, la sesión que se entrega no se pierde", async () => {
    const traer = simularSesiones([rindiendo]);
    montar("/panel?examen=1&sesion=6&estado=open");
    await esperar();
    expect(screen.getByRole("heading", { level: 1, name: "Bruno Pérez" })).toBeInTheDocument();
    // Con el detalle abierto se pide sin filtrar.
    expect(ultimoPedido()).toEqual(expect.objectContaining({ estado: undefined }));

    traer.mockResolvedValue(pagina([{ ...rindiendo, status: "closed", closed_at: new Date().toISOString() }]));
    await esperar(CADENCIA);
    expect(screen.getByRole("heading", { level: 1, name: "Bruno Pérez" })).toBeInTheDocument();
    expect(direccion().get("sesion")).toBe("6");
    expect(direccion().get("estado")).toBe("open");
  });

  it("la búsqueda «Juan » conserva el espacio que se acaba de escribir", async () => {
    const traer = simularSesiones([rindiendo]);
    montar("/panel?examen=1");
    await esperar();
    const campo = screen.getByLabelText("Buscar alumno");
    fireEvent.change(campo, { target: { value: "Juan " } });
    await esperar(400);
    expect(direccion().get("q")).toBe("Juan");
    expect(traer).toHaveBeenLastCalledWith(1, 50, expect.objectContaining({ q: "Juan" }));
    expect(campo).toHaveValue("Juan ");

    // El docente sigue escribiendo «Juan Pérez» sin perder el espacio.
    fireEvent.change(campo, { target: { value: "Juan P" } });
    await esperar(400);
    expect(direccion().get("q")).toBe("Juan P");
  });

  it("con «Ana» tipeado, elegir «Riesgo alto» antes de los 300 ms no vuelve a dejar solo la búsqueda", async () => {
    const traer = simularSesiones([rindiendo]);
    montar("/panel?examen=1");
    await esperar();
    fireEvent.change(screen.getByLabelText("Buscar alumno"), { target: { value: "Ana" } });
    await esperar(100);
    fireEvent.change(screen.getByLabelText("Nivel de riesgo"), { target: { value: "high" } });
    await esperar(400);
    expect(direccion().toString()).toBe("examen=1&nivel=high&q=Ana");
    expect(screen.getByLabelText("Nivel de riesgo")).toHaveValue("high");
    expect(traer).toHaveBeenLastCalledWith(1, 50, expect.objectContaining({ nivel: "high", q: "Ana" }));
  });

  it("si la búsqueda se borra desde afuera, lo que se estaba por buscar ya no se escribe", async () => {
    simularSesiones([rindiendo]);
    montar("/panel?examen=1&q=Ana");
    await esperar();
    fireEvent.change(screen.getByLabelText("Buscar alumno"), { target: { value: "Ana M" } });
    await esperar(100);
    fireEvent.click(screen.getByRole("button", { name: "Quitar filtros" }));
    await esperar(400);
    expect(direccion().toString()).toBe("examen=1");
    expect(screen.getByLabelText("Buscar alumno")).toHaveValue("");
  });

  it("el orden por nivel se mantiene en la segunda vuelta y con «Ver más sesiones»", async () => {
    vi.mocked(sesionesService.traerExamenes).mockResolvedValue([{ ...EXAMEN, closed_sessions: 120 }]);
    const traer = simularSesiones([]);
    montar("/panel?examen=1");
    await esperar();
    fireEvent.change(screen.getByLabelText("Ordenar por"), { target: { value: "risk_level" } });
    await esperar();
    expect(direccion().get("orden")).toBe("risk_level");
    await esperar(CADENCIA);
    expect(traer).toHaveBeenLastCalledWith(1, 50, expect.objectContaining({ orden: "risk_level" }));

    fireEvent.click(screen.getByRole("button", { name: "Ver más sesiones" }));
    await esperar();
    expect(traer).toHaveBeenLastCalledWith(1, 100, expect.objectContaining({ orden: "risk_level" }));
    // Ordenar no es filtrar: no hay renglón de resultado.
    expect(resultado()).toBeNull();
  });

  it("abrir una sesión sin filtros no vuelve a pedir la lista", async () => {
    const traer = simularSesiones([rindiendo]);
    montar("/panel?examen=1");
    await esperar();
    const antes = traer.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /Ver los eventos de Bruno Pérez/ }));
    await esperar();
    expect(screen.getByRole("heading", { level: 1, name: "Bruno Pérez" })).toBeInTheDocument();
    expect(traer.mock.calls.length).toBe(antes);
  });

  it("con una sesión abierta en el detalle, la lista se pide sin filtrar y con el orden elegido", async () => {
    const traer = simularSesiones([rindiendo]);
    montar("/panel?examen=1&sesion=6&nivel=high&estado=finished&orden=risk_level");
    await esperar();
    expect(traer).toHaveBeenLastCalledWith(1, 50, expect.objectContaining({ nivel: undefined, estado: undefined, orden: "risk_level" }));
  });

  it("«N de M» se anuncia una vez por vista: el refresco cambia la cifra a la vista sin volver a anunciarla", async () => {
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([rindiendo], 1));
    montar("/panel?examen=1&nivel=high");
    await esperar();
    expect(viva()).toHaveTextContent("1 de 2 sesiones");
    const nodo = viva().firstElementChild;

    vi.mocked(sesionesService.traerExamenes).mockResolvedValue([{ ...EXAMEN, open_sessions: 2 }]);
    await esperar(CADENCIA);
    expect(resultado()).toHaveTextContent("1 de 3 sesiones");
    await esperar(CADENCIA);
    expect(viva()).toHaveTextContent("1 de 2 sesiones");
    expect(viva().firstElementChild).toBe(nodo);
  });

  it("el anuncio se vuelve a leer si se repite: ir a otro filtro y volver con la misma cifra", async () => {
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([rindiendo], 1));
    montar("/panel?examen=1&nivel=high");
    await esperar();
    const primero = viva().firstElementChild;

    fireEvent.change(screen.getByLabelText("Nivel de riesgo"), { target: { value: "medium" } });
    await esperar();
    const segundo = viva().firstElementChild;
    expect(segundo).not.toBe(primero);

    fireEvent.change(screen.getByLabelText("Nivel de riesgo"), { target: { value: "high" } });
    await esperar();
    expect(viva()).toHaveTextContent("1 de 2 sesiones");
    expect(viva().firstElementChild).not.toBe(segundo);
  });

  it("al volver del detalle a una lista filtrada no muestra el total del examen como si fuera el del filtro", async () => {
    // El detalle pide sin filtrar y recibe las dos sesiones del examen. La lista filtrada, al volver, todavía
    // no contestó: hasta que conteste no hay cifra que mostrar, pero «Quitar filtros» sí está.
    vi.spyOn(sesionesService, "traerSesiones").mockImplementation((_examen, _limite, filtros) =>
      filtros?.nivel ? new Promise(() => undefined) : Promise.resolve(pagina([rindiendo, entregadaHaceRato()], 2))
    );
    montar("/panel?examen=1&sesion=6&nivel=high", ["/panel?examen=1&nivel=high"]);
    await esperar();
    expect(screen.getByRole("heading", { level: 1, name: "Bruno Pérez" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Atrás del navegador" }));
    await esperar();
    expect(screen.queryByText(/\d+ de \d+ sesiones/)).toBeNull();
    expect(screen.getAllByRole("button", { name: "Quitar filtros" })).toHaveLength(1);
  });

  it("si ninguna coincide lo dice una vez, con un solo «Quitar filtros», que conserva el orden", async () => {
    const traer = vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([], 0));
    montar("/panel?examen=1&nivel=high&q=nadie&orden=risk_level");
    await esperar();
    expect(screen.getByText("Ninguna sesión coincide con el filtro.")).toBeInTheDocument();
    expect(resultado()).toHaveTextContent("0 de 2 sesiones");
    expect(screen.getAllByRole("button", { name: "Quitar filtros" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Quitar filtros" }));
    await esperar();
    expect(direccion().toString()).toBe("examen=1&orden=risk_level");
    expect(traer).toHaveBeenLastCalledWith(1, 50, expect.objectContaining({ nivel: undefined, q: undefined, orden: "risk_level" }));
  });

  it("sin filtro no hay renglón de resultado entre la lámina de control y «En curso»", async () => {
    simularSesiones([rindiendo]);
    montar("/panel?examen=1");
    await esperar();
    expect(resultado()).toBeNull();
    expect(screen.queryByRole("button", { name: "Quitar filtros" })).toBeNull();
    expect(document.querySelector(".filtros-resultado")).toBeNull();
    // Entre la lámina de control y el primer grupo no queda ningún hijo suelto del panel que ocupe lugar.
    const control = document.querySelector(".panel > .control")!;
    expect(control.nextElementSibling).toHaveClass("lista");
  });

  it("los textos de la barra y de la columna «Análisis» están en lenguaje llano", async () => {
    simularSesiones([
      { ...rindiendo, ...conAnalisis("medium", ["model", "event"]), capture: { state: "none" } },
      { ...entregadaHaceRato(), ...conAnalisis(null, [], "insufficient_evidence") },
    ]);
    montar("/panel?examen=1&nivel=medium");
    await esperar();
    expect(screen.getByRole("option", { name: "Riesgo alto" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Alto" })).toBeNull();
    expectLenguajeLlano(document.querySelector(".control")!);
    for (const tabla of document.querySelectorAll(".lista")) expectLenguajeLlano(tabla, { excluir: ".alumno__captura" });
  });
});
