import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sesionesService from "../services/sesionesService";
import { analisis, esperar, pagina, resumen, sesionNumerada } from "../test/fabricas";
import { horaCorta } from "../eventos";
import { EXAMEN, entregadaHaceRato, ingresar, montar } from "../test/panel";
import { FichaSesion } from "./FichaSesion";

const SESION = sesionNumerada();

describe("FichaSesion", () => {
  it("dice si entregó, qué intento es, cuándo empezó y cuánto duró, en un solo renglón", () => {
    const entregada = {
      ...SESION, intento: 5, intentos: 5, status: "closed" as const,
      started_at: "2026-11-03T12:11:33Z", closed_at: "2026-11-03T12:27:46Z",
    };
    const { container } = render(<FichaSesion sesion={entregada} />);

    const ficha = container.querySelector(".detalle__sesion") as HTMLElement;
    expect(within(ficha).getByText("Entregó")).toBeInTheDocument();
    expect(ficha).toHaveTextContent("Intento 5 de 5");
    // Con la fecha: con varios parciales, la hora sola no decía qué día (ronda 3).
    const dia = new Date("2026-11-03T12:11:33Z").toLocaleDateString("es-AR", { day: "numeric", month: "numeric", year: "numeric" });
    expect(dia).toMatch(/^\d{1,2}\/11\/2026$/);
    expect(ficha).toHaveTextContent(`Empezó el ${dia} a las ${horaCorta("2026-11-03T12:11:33Z")}`);
    // El estado, como una etiqueta.
    expect(within(ficha).getByText("Entregó")).toHaveClass("detalle__estado");
    // La misma duración que la lista de sesiones, con el mismo componente.
    expect(ficha).toHaveTextContent("Duró 16 min");
    // El estado una sola vez.
    expect(screen.getAllByText("Entregó")).toHaveLength(1);
  });

  it("con un solo intento no dice qué intento es, y abierta no dice cuánto duró", () => {
    const { container } = render(<FichaSesion sesion={SESION} />);

    const ficha = container.querySelector(".detalle__sesion") as HTMLElement;
    expect(within(ficha).getByText("Rindiendo ahora")).toHaveClass("detalle__estado", "detalle__estado--vivo");
    expect(ficha).not.toHaveTextContent(/Intento/);
    expect(ficha).not.toHaveTextContent(/Duró/);
    expect(ficha).toHaveTextContent(/Empezó el \d{1,2}\/\d{1,2}\/\d{4} a las \d{2}:\d{2}/);
  });

  it("aclara el número de intento cuando el alumno rindió más de una vez", () => {
    render(<FichaSesion sesion={{ ...SESION, intento: 2, intentos: 2 }} />);
    expect(screen.getByText(/Intento 2 de 2/)).toBeInTheDocument();
  });

  it("no le dice «entregó» a un intento que quedó sin entregar, ni le pone duración", () => {
    // «abandoned» es justo lo que no se entregó. La lista, del mismo dato, dice «sin entregar»: dos pantallas
    // del mismo registro no pueden contradecirse.
    render(<FichaSesion sesion={{ ...SESION, status: "abandoned", closed_at: "2026-09-21T14:40:00Z" }} />);
    expect(screen.getByText("Sin entregar")).toBeInTheDocument();
    expect(screen.queryByText("Entregó")).not.toBeInTheDocument();
    // Sin duración, como en la lista: el cierre de un abandono no es cuándo dejó de rendir.
    expect(screen.queryByText(/Duró/)).not.toBeInTheDocument();
  });
});

describe("La ficha en el panel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ingresar();
    vi.spyOn(sesionesService, "traerExamenes").mockResolvedValue([EXAMEN]);
    vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(
      pagina([{ ...entregadaHaceRato(), attempt_number: 2, attempts_total: 3 }], 1, resumen({ no_alerts: 1 })),
    );
    vi.spyOn(sesionesService, "traerEventos").mockResolvedValue([]);
    vi.spyOn(sesionesService, "traerAnalisis").mockResolvedValue(analisis({ state: "not_analyzed", calculated_at: null }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("va en la cabecera, en la misma columna que el nombre del alumno y justo debajo de él, sin caja", async () => {
    montar("/panel?examen=1&sesion=5");
    await esperar();
    await esperar();

    const h1 = screen.getByRole("heading", { level: 1 });
    const ficha = document.querySelector(".detalle__sesion") as HTMLElement;
    expect(ficha).not.toBeNull();
    // Hermana del h1, dentro del titular, y fuera del detalle: es un renglón de la cabecera, no una lámina.
    expect(ficha.parentElement).toBe(h1.parentElement);
    expect(h1.parentElement).toHaveClass("panel__titular");
    expect(h1.nextElementSibling).toBe(ficha);
    expect(ficha.closest(".detalle")).toBeNull();
    expect(ficha.closest(".panel__cabecera")).not.toBeNull();
    expect(ficha).toHaveTextContent("Entregó");
    expect(ficha).toHaveTextContent("Intento 2 de 3");
    // Una sola vez en la pantalla.
    expect(screen.getAllByText("Entregó")).toHaveLength(1);
  });

  it("en la lista no hay ficha", async () => {
    montar("/panel?examen=1");
    await esperar();
    expect(document.querySelector(".lista")).not.toBeNull();
    expect(document.querySelector(".detalle__sesion")).toBeNull();
  });
});
