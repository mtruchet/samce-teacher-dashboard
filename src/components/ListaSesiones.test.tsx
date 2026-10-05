import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sesionNumerada } from "../test/fabricas";
import { ListaSesiones } from "./ListaSesiones";

const sesion = (id: number, started_at: string) =>
  sesionNumerada({ id, moodle_attempt_id: 7000 + id, moodle_user_id: 40 + id, student_name: `Alumno ${id}`, started_at });

const verEventos = () => undefined;

/** El recuento que acompaña al título de la lista. */
const recuento = (titulo: string) => within(screen.getByRole("heading", { name: titulo }).parentElement!);

describe("ListaSesiones", () => {
  it("cuando la lista está cortada, el recuento dice cuántas hay en total", () => {
    render(
      <ListaSesiones titulo="En curso" sesiones={[sesion(1, new Date().toISOString())]} total={80} onVerEventos={verEventos} />,
    );
    expect(recuento("En curso").getByText("1 de 80")).toBeInTheDocument();
  });

  it("con la lista completa muestra solo el número", () => {
    render(
      <ListaSesiones titulo="En curso" sesiones={[sesion(1, new Date().toISOString())]} total={1} onVerEventos={verEventos} />,
    );
    expect(recuento("En curso").getByText("1")).toBeInTheDocument();
  });

  it("un intento sin entregar no muestra una duración que el panel no conoce", () => {
    const abandonada = {
      ...sesion(3, new Date().toISOString()),
      status: "abandoned" as const,
      closed_at: new Date().toISOString(),
    };
    render(<ListaSesiones titulo="Finalizadas" sesiones={[abandonada]} cerradas onVerEventos={verEventos} />);
    // Por texto y no por getByLabelText: ese busca el atributo en el DOM, así
    // que daba verde incluso cuando la etiqueta colgaba de un elemento que no
    // admite nombre de autor y ningún lector de pantalla la anunciaba.
    expect(screen.getByText("duración desconocida")).toBeInTheDocument();
    expect(screen.getByText("sin entregar")).toBeInTheDocument();
  });

  it("si el intento no empezó hoy, el comienzo lleva la fecha", () => {
    const ayer = new Date(Date.now() - 24 * 3600 * 1000);
    render(<ListaSesiones titulo="Finalizadas" sesiones={[sesion(2, ayer.toISOString())]} cerradas onVerEventos={verEventos} />);
    const fecha = ayer.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
    expect(screen.getByText((texto) => texto.startsWith(`${fecha} `))).toBeInTheDocument();
  });
});
