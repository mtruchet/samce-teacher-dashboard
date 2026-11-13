import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sesionesService from "../services/sesionesService";
import { conAnalisis, esperar, pagina, resumen, sesion, simularSesiones } from "../test/fabricas";
import { expectLenguajeLlano } from "../test/lenguaje";
import { EXAMEN, direccion, entregadaHaceRato, ingresar, montar, rindiendo, ultimoPedido } from "../test/panel";

/**
 * Los filtros de la lista de sesiones (HU04_T02, §4.1 de la especificación): viven en la dirección, van en
 * cada pedido, sobreviven al refresco, a Atrás y a las migas, y se anuncian una vez por vista.
 */

const CADENCIA = sesionesService.CADENCIA_MS;
const viva = () => screen.getByRole("status", { name: "Resultado del filtro" });
const resultado = () => document.querySelector(".control__resultado");
/** Sin filtro, el renglón del resultado está en su lugar pero vacío: sin cifra, sin botón y oculto a los lectores. */
function expectRenglonVacio() {
  const renglon = resultado();
  expect(renglon).not.toBeNull();
  expect(renglon!.textContent).toBe("");
  expect(renglon).toHaveAttribute("aria-hidden", "true");
  expect(screen.queryByRole("button", { name: "Quitar filtros" })).toBeNull();
}

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
    // El mismo botón secundario que «Mostrar 50 más» del registro (V5).
    expect(screen.getByRole("button", { name: "Ver más sesiones" })).toHaveClass("boton-secundario");
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

  it("con un filtro dice «N de M sesiones», y el grupo que quedó vacío lo dice adentro", async () => {
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(
      pagina([{ ...entregadaHaceRato(), ...conAnalisis("high") }], 1)
    );
    montar("/panel?examen=1&nivel=high");
    await esperar();
    expect(resultado()).toHaveTextContent("1 de 2 sesiones");
    expect(screen.getByRole("heading", { name: "Finalizadas" })).toBeInTheDocument();
    // Bruno sigue rindiendo, pero sin alertas: «En curso» no tiene ninguna de riesgo alto, y lo dice en su
    // lugar. El grupo no desaparece: si lo hiciera, «Finalizadas» subiría a ocupar su lugar.
    const enCurso = screen.getByRole("heading", { name: "En curso" }).closest("section")!;
    expect(enCurso).toHaveTextContent("Ninguna sesión en curso coincide con el filtro.");
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
    // Ordenar no es filtrar: el renglón de resultado queda vacío.
    expectRenglonVacio();
  });

  it("abrir una sesión sin filtros no vuelve a pedir la lista", async () => {
    const traer = simularSesiones([rindiendo]);
    montar("/panel?examen=1");
    await esperar();
    const antes = traer.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /Ver la sesión de Bruno Pérez/ }));
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
    montar("/panel?examen=1");
    await esperar();
    fireEvent.change(screen.getByLabelText("Nivel de riesgo"), { target: { value: "high" } });
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
    montar("/panel?examen=1");
    await esperar();
    fireEvent.change(screen.getByLabelText("Nivel de riesgo"), { target: { value: "high" } });
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
    // El vacío va dentro de cada grupo, y no en una lámina aparte que reemplazaba a los dos.
    expect(screen.queryByText("Ninguna sesión coincide con el filtro.")).toBeNull();
    expect(screen.getByRole("heading", { name: "En curso" }).closest("section")).toHaveTextContent(
      "Ninguna sesión en curso coincide con el filtro."
    );
    expect(screen.getByRole("heading", { name: "Finalizadas" }).closest("section")).toHaveTextContent(
      "Ninguna sesión finalizada coincide con el filtro."
    );
    expect(resultado()).toHaveTextContent("0 de 2 sesiones");
    expect(screen.getAllByRole("button", { name: "Quitar filtros" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Quitar filtros" }));
    await esperar();
    expect(direccion().toString()).toBe("examen=1&orden=risk_level");
    expect(traer).toHaveBeenLastCalledWith(1, 50, expect.objectContaining({ nivel: undefined, q: undefined, orden: "risk_level" }));
  });

  it("sin filtro el renglón de resultado está vacío en su lugar, dentro de la lámina de control", async () => {
    simularSesiones([rindiendo]);
    montar("/panel?examen=1");
    await esperar();
    expectRenglonVacio();
    expect(resultado()!.closest(".control")).not.toBeNull();
    expect(document.querySelector(".filtros-resultado")).toBeNull();
    // Entre la lámina de control y los grupos no queda ningún hijo suelto del panel que ocupe lugar.
    const control = document.querySelector(".panel > .control")!;
    expect(control.nextElementSibling).toHaveClass("panel__listas");
    expect(control.nextElementSibling!.firstElementChild).toHaveClass("lista");
  });

  it("con un filtro y nadie rindiendo, «En curso» sigue diciendo que no hay sesiones vigentes", async () => {
    vi.mocked(sesionesService.traerExamenes).mockResolvedValue([{ ...EXAMEN, open_sessions: 0 }]);
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(
      pagina([{ ...entregadaHaceRato(), ...conAnalisis("high") }], 1)
    );
    montar("/panel?examen=1&nivel=high");
    await esperar();
    expect(screen.getByRole("heading", { name: "En curso" }).closest("section")).toHaveTextContent(
      "No hay sesiones de examen vigentes."
    );
    expect(screen.queryByText("Ninguna sesión en curso coincide con el filtro.")).toBeNull();
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
  it("abrir un enlace que ya trae un filtro no anuncia nada: el anuncio es solo por acción del docente", async () => {
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([rindiendo], 1));
    montar("/panel?examen=1&nivel=high");
    await esperar();
    expect(resultado()).toHaveTextContent("1 de 2 sesiones");
    expect(viva().textContent).toBe("");
    await esperar(CADENCIA);
    expect(viva().textContent).toBe("");
  });

  it("«Quitar filtros» lleva el foco al selector de nivel, y no lo deja en el cuerpo de la página", async () => {
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([], 0));
    montar("/panel?examen=1&nivel=high&q=nadie");
    await esperar();
    const quitar = screen.getByRole("button", { name: "Quitar filtros" });
    quitar.focus();
    fireEvent.click(quitar);
    await esperar();
    expectRenglonVacio();
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByLabelText("Nivel de riesgo")).toHaveFocus();
  });

  it("con un filtro y la lista cortada, las cabeceras de los grupos no llevan cifra: la única es «N de M»", async () => {
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(
      pagina([{ ...entregadaHaceRato(), ...conAnalisis("high") }], 120)
    );
    montar("/panel?examen=1&nivel=high");
    await esperar();
    expect(screen.getByRole("button", { name: "Ver más sesiones" })).toBeInTheDocument();
    const finalizadas = screen.getByRole("heading", { name: "Finalizadas" }).closest("section")!;
    expect(finalizadas.querySelector(".lamina__cuenta")).toBeNull();
  });

  it("con un filtro y todas las coincidencias cargadas, cada grupo cuenta sus filas", async () => {
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(
      pagina([{ ...entregadaHaceRato(), ...conAnalisis("high") }], 1)
    );
    montar("/panel?examen=1&nivel=high");
    await esperar();
    const finalizadas = screen.getByRole("heading", { name: "Finalizadas" }).closest("section")!;
    expect(finalizadas.querySelector(".lamina__cuenta")).toHaveTextContent("1");
  });

  it("después de «Quitar filtros», la región viva ya no dice la cifra del filtro (A4)", async () => {
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([rindiendo], 1));
    montar("/panel?examen=1");
    await esperar();
    fireEvent.change(screen.getByLabelText("Nivel de riesgo"), { target: { value: "high" } });
    await esperar();
    expect(viva()).toHaveTextContent("1 de 2 sesiones");

    fireEvent.click(screen.getByRole("button", { name: "Quitar filtros" }));
    await esperar();
    expectRenglonVacio();
    expect(viva().textContent).toBe("");
  });

  it("al volver con Atrás a otra vista filtrada, la región viva no conserva la cifra de la anterior (M3)", async () => {
    vi.spyOn(sesionesService, "traerSesiones").mockImplementation(async (_e, _l, filtros) =>
      filtros?.nivel === "medium" ? pagina([], 0) : pagina([rindiendo], 1)
    );
    montar("/panel?examen=1&nivel=high");
    await esperar();
    fireEvent.change(screen.getByLabelText("Nivel de riesgo"), { target: { value: "medium" } });
    await esperar();
    expect(viva()).toHaveTextContent("0 de 2 sesiones");

    fireEvent.click(screen.getByRole("button", { name: "Atrás del navegador" }));
    await esperar();
    expect(resultado()).toHaveTextContent("1 de 2 sesiones");
    expect(viva().textContent).toBe("");
  });

  it("con un filtro sin resultados hay una sola región «Resultado del filtro», la viva (L7, H14)", async () => {
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([], 0));
    montar("/panel?examen=1&nivel=high");
    await esperar();
    expect(document.querySelectorAll('[aria-label="Resultado del filtro"]')).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "Resumen de la evaluación" })).toBeNull();
    expect(screen.getByRole("region", { name: "Resumen y filtros de la evaluación" })).toBeInTheDocument();
  });

  it("una respuesta tardía de otro examen no pisa la lista del examen elegido (H06)", async () => {
    let contestarTarde: (p: sesionesService.PaginaDeSesiones) => void = () => undefined;
    vi.spyOn(sesionesService, "traerSesiones").mockImplementation((examen) =>
      examen === 1
        ? new Promise((listo) => {
            contestarTarde = listo;
          })
        : Promise.resolve(pagina([{ ...rindiendo, id: 20, student_name: "Del Segundo" }], 1))
    );
    montar("/panel?examen=1", ["/panel?examen=2"]);
    await esperar();

    fireEvent.click(screen.getByRole("button", { name: "Atrás del navegador" }));
    await esperar();
    expect(screen.getByText("Del Segundo")).toBeInTheDocument();

    contestarTarde(pagina([{ ...rindiendo, id: 10, student_name: "Del Primero" }], 1));
    await esperar();
    expect(screen.queryByText("Del Primero")).toBeNull();
    expect(screen.getByText("Del Segundo")).toBeInTheDocument();
  });

  it("el vacío del filtro va dentro de la lámina de cada grupo", async () => {
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina([], 0));
    montar("/panel?examen=1&nivel=high");
    await esperar();
    expect(screen.queryByText("Ninguna sesión coincide con el filtro.")).toBeNull();
    expect(screen.getByText("Ninguna sesión en curso coincide con el filtro.").closest(".lamina.lista")).not.toBeNull();
    expect(screen.getByText("Ninguna sesión finalizada coincide con el filtro.").closest(".lamina.lista")).not.toBeNull();
  });

  describe("mientras la vista pedida no contesta", () => {
    // Treinta sesiones: una rindiendo y veintinueve entregadas, diez de ellas de riesgo alto.
    const treinta = Array.from({ length: 30 }, (_, i) =>
      sesion({
        id: 100 + i,
        moodle_user_id: 300 + i,
        moodle_attempt_id: 9000 + i,
        student_name: `Alumno ${i}`,
        status: i === 0 ? "open" : "closed",
        ...(i > 0 && i <= 10 ? conAnalisis("high") : {}),
      })
    );
    const altas = treinta.filter((s) => s.risk_level === "high");
    const delResumen = resumen({ risk_high: 10, no_alerts: 20 });
    const listas = () => document.querySelector(".panel__listas")!;
    const filas = () => document.querySelectorAll("button[data-sesion]").length;
    const cuentaFinalizadas = () =>
      screen.getByRole("heading", { name: "Finalizadas" }).closest("section")!.querySelector(".lamina__cuenta");

    /** Contesta la primera vista enseguida y deja la siguiente esperando hasta `contestar()`. */
    function conLaSegundaDemorada() {
      let contestar: () => void = () => undefined;
      vi.mocked(sesionesService.traerExamenes).mockResolvedValue([{ ...EXAMEN, open_sessions: 1, closed_sessions: 29 }]);
      let primera: string | null = null;
      vi.spyOn(sesionesService, "traerSesiones").mockImplementation((_e, _l, filtros) => {
        const respuesta = filtros?.nivel ? pagina(altas, 10, delResumen) : pagina(treinta, 30, delResumen);
        const clave = filtros?.nivel ?? "";
        primera ??= clave;
        if (clave === primera) return Promise.resolve(respuesta);
        return new Promise((listo) => {
          contestar = () => listo(respuesta);
        });
      });
      return () => contestar();
    }

    it("al tocar una tarjeta, la lista sigue siendo la anterior entera y se marca como ocupada", async () => {
      const contestar = conLaSegundaDemorada();
      montar("/panel?examen=1");
      await esperar();
      expect(filas()).toBe(30);
      expect(listas()).not.toHaveAttribute("aria-busy");

      fireEvent.click(screen.getByRole("button", { name: "Riesgo alto: 10 sesiones" }));
      await esperar();
      // La tarjeta ya está marcada, pero la lista es la de antes, completa y coherente: sin «Se ven con
      // «Ver más sesiones».», que salía de armar los grupos como filtrados con las filas sin filtrar.
      expect(screen.getByRole("button", { name: "Riesgo alto: 10 sesiones" })).toHaveAttribute("aria-pressed", "true");
      expect(listas()).toHaveAttribute("aria-busy", "true");
      expect(filas()).toBe(30);
      expect(screen.queryByText("Se ven con «Ver más sesiones».")).toBeNull();
      expect(cuentaFinalizadas()).toHaveTextContent("29");

      contestar();
      await esperar();
      expect(listas()).not.toHaveAttribute("aria-busy");
      expect(filas()).toBe(10);
    });

    it("al quitar los filtros, la lista filtrada no ofrece «Ver más sesiones» mientras llega la completa", async () => {
      const contestar = conLaSegundaDemorada();
      montar("/panel?examen=1&nivel=high");
      await esperar();
      expect(filas()).toBe(10);

      fireEvent.click(screen.getByRole("button", { name: "Quitar filtros" }));
      await esperar();
      expect(listas()).toHaveAttribute("aria-busy", "true");
      expect(filas()).toBe(10);
      expect(screen.queryByRole("button", { name: "Ver más sesiones" })).toBeNull();
      expect(cuentaFinalizadas()).toHaveTextContent("10");

      contestar();
      await esperar();
      expect(listas()).not.toHaveAttribute("aria-busy");
      expect(filas()).toBe(30);
    });

    it("volver a una vista ya vista la dibuja enseguida con lo último que se supo de ella", async () => {
      const contestar = conLaSegundaDemorada();
      montar("/panel?examen=1");
      await esperar();
      fireEvent.click(screen.getByRole("button", { name: "Riesgo alto: 10 sesiones" }));
      await esperar();
      contestar();
      await esperar();
      expect(filas()).toBe(10);

      // La vista sin filtro ya se vio: se dibuja con las treinta en el mismo momento, y la respuesta nueva
      // (que también contesta enseguida) la confirma sin marcarla como ocupada.
      fireEvent.click(screen.getByRole("button", { name: "Quitar filtros" }));
      expect(filas()).toBe(30);
      await esperar();
      expect(filas()).toBe(30);
      expect(listas()).not.toHaveAttribute("aria-busy");
    });
  });
});
