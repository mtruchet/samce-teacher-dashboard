import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { eventosCriticos } from "../eventos";
import { METRICAS } from "../metricas";
import type { AlertaDeSesion, EntradaDelHistorial } from "../services/sesionesService";
import { alerta as alertaVigente, entradaDelHistorial, evento, metricasDelCierre } from "../test/fabricas";
import { MODELO_453, MODELO_454 } from "../test/explicaciones";
import { choquesConLasListas, expectLenguajeLlano } from "../test/lenguaje";
import { CronologiaSesion } from "./CronologiaSesion";
import { EvolucionRiesgo } from "./EvolucionRiesgo";
import { HistorialAlertas } from "./HistorialAlertas";
import { MetricasSesion } from "./MetricasSesion";

const METRICAS_CIERRE = metricasDelCierre({ silence_longest_s: null });

/** El aviso del historial cuando un análisis posterior cambió el texto sin cambiar el nivel (D6), tal cual. */
const D6 = "Un análisis posterior reemplazó esta explicación por otra, sin cambiar el nivel de riesgo.";

/** Una entrada y una alerta de toda la sesión en riesgo bajo, con un texto corto; cada caso pisa lo suyo. */
const PRIMERO = { level: "low", explanation: "Primero.", recorded_at: "2026-11-10T13:05:00Z" } as const;
const entrada = (cambios: Partial<EntradaDelHistorial> = {}) => entradaDelHistorial({ ...PRIMERO, ...cambios });
const alerta = (cambios: Partial<AlertaDeSesion> = {}) =>
  alertaVigente({ level: PRIMERO.level, explanation: PRIMERO.explanation, level_since: PRIMERO.recorded_at, ...cambios });

describe("Métricas de la sesión", () => {
  const metricas = (props: Partial<Parameters<typeof MetricasSesion>[0]> = {}) =>
    render(
      <MetricasSesion metricas={METRICAS_CIERRE} estado="analyzed" abierta={false} veredictoDiceNoDisponible={false} {...props} />
    );

  it("con la sesión finalizada y analizada: seis, con su rótulo y su valor, sin cajas, sin la dimensión y sin las proporciones", () => {
    const { container } = metricas();
    expect(screen.getByRole("heading", { level: 3, name: "Métricas de la sesión" })).toBeInTheDocument();
    const filas = [...container.querySelectorAll(".metricas__metrica")];
    expect(filas).toHaveLength(6);
    expect(filas.map((f) => f.querySelector("dt")?.textContent)).toEqual(METRICAS.map((m) => m.rotulo));
    expect(screen.getByText("un minuto y 35 segundos")).toBeInTheDocument();
    expect(screen.getByText("1.240 letras")).toBeInTheDocument();
    expect(screen.getByText("4,2 teclas por segundo")).toBeInTheDocument();
    expect(screen.getByText("Sin dato en esta sesión")).toBeInTheDocument();
    for (const m of METRICAS) expect(container).not.toHaveTextContent(m.dimension);
    expect(container.textContent).not.toMatch(/0[,.]12|0[,.]4\b/);
    expect(container.querySelector("[class*='barra'], [class*='comparacion']")).toBeNull();
    expectLenguajeLlano(container);
  });

  it("los ceros dicen lo que pasó, en las tres métricas que lo necesitan", () => {
    metricas({ metricas: metricasDelCierre({ outside_longest_s: 0, largest_paste_chars: 0, mouse_idle_longest_s: 0, silence_longest_s: 60 }) });
    expect(screen.getByText("No estuvo en otra ventana ni en otra pestaña")).toBeInTheDocument();
    expect(screen.getByText("No pegó texto")).toBeInTheDocument();
    expect(screen.getByText("menos de 15 segundos")).toBeInTheDocument();
    expect(screen.getByText("un minuto")).toBeInTheDocument();
  });

  it("con la sesión abierta dice que se muestran al terminar", () => {
    metricas({ metricas: null, abierta: true });
    expect(screen.getByText("Las métricas se muestran cuando la sesión termina.")).toBeInTheDocument();
    expect(document.querySelector(".metricas")).toBeNull();
  });

  it("si la sesión no se pudo analizar o todavía no se analizó no se dibuja: el veredicto ya lo dice", () => {
    for (const estado of ["insufficient_evidence", "not_analyzed"] as const) {
      const { container, unmount } = metricas({ estado });
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it("no disponible: no se dibuja si el veredicto ya lo dijo, y si no, lo dice una vez", () => {
    const { container, unmount } = metricas({ estado: "unavailable", veredictoDiceNoDisponible: true });
    expect(container).toBeEmptyDOMElement();
    unmount();

    metricas({ estado: "unavailable" });
    expect(screen.getByText("Las métricas no están disponibles para esta sesión.")).toBeInTheDocument();
    expect(document.querySelector(".metricas")).toBeNull();
  });

  it("finalizada y analizada sin métricas del cierre: dice que no están disponibles", () => {
    metricas({ metricas: null });
    expect(screen.getByText("Las métricas no están disponibles para esta sesión.")).toBeInTheDocument();
  });
});

describe("Historial de alertas", () => {
  it("cada entrada con la hora del análisis en su renglón, la marca y el rótulo del nivel con su origen", () => {
    const { container } = render(
      <HistorialAlertas
        historial={[entrada(), entrada({ level: "high", explanation: "Después.", recorded_at: "2026-11-10T13:20:00Z" })]}
        alertas={[alerta({ level: "high", explanation: "Después." })]}
      />
    );
    expect(screen.getByRole("heading", { level: 3, name: "Historial de alertas" })).toBeInTheDocument();
    const entradas = [...container.querySelectorAll<HTMLElement>(".historial__entrada")];
    expect(entradas).toHaveLength(2);
    for (const e of entradas) {
      expect(e).toHaveClass("marca-nivel");
      expect(e.querySelector(".historial__hora")).toHaveTextContent(/^Análisis de las \d{2}:\d{2}$/);
    }
    expect(entradas.map((e) => e.dataset.nivel)).toEqual(["low", "high"]);
    expect(entradas[1].querySelector(".rotulo-nivel")).toHaveTextContent("Riesgo alto En toda la sesión");
    expect(screen.queryByText(/Se detectó/)).not.toBeInTheDocument();
    expect(screen.queryByText(/reemplazó esta explicación/)).not.toBeInTheDocument();
    expectLenguajeLlano(container);
  });

  it("aclara una sola vez las entradas copiadas, y avisa si un análisis posterior reemplazó la explicación", () => {
    const { container } = render(
      <HistorialAlertas
        historial={[entrada({ carried_over: true }), entrada({ origin: "event", carried_over: true })]}
        alertas={[alerta({ explanation: "Otra peor." }), alerta({ origin: "event" })]}
      />
    );
    expect(screen.getAllByText(/el recorrido anterior de cada alerta no quedó registrado/)).toHaveLength(1);
    expect(screen.getByText(/reemplazó esta explicación/)).toBeInTheDocument();
    expect(screen.getByText(D6)).toBeInTheDocument();
    // La entrada reemplazada va abierta: es la única forma de leer el texto viejo.
    const [reemplazada] = container.querySelectorAll(".historial__entrada");
    expect(reemplazada.querySelector("details")).toBeNull();
    expectLenguajeLlano(container);
  });

  it("si la alerta vigente está en otro nivel que la última entrada, no avisa: la subida explica el cambio de texto", () => {
    render(<HistorialAlertas historial={[entrada({ level: "medium" })]} alertas={[alerta({ level: "high", explanation: "Otra." })]} />);
    expect(screen.queryByText(D6)).not.toBeInTheDocument();
  });

  it("la explicación igual a la vigente queda plegada; la distinta, abierta", () => {
    const { container } = render(
      <HistorialAlertas
        historial={[entrada({ explanation: "Antes." }), entrada({ level: "medium", recorded_at: "2026-11-10T13:20:00Z" })]}
        alertas={[alerta({ level: "medium" })]}
      />
    );
    const [distinta, igual] = container.querySelectorAll<HTMLElement>(".historial__entrada");
    expect(distinta.querySelector("details")).toBeNull();
    expect(within(distinta).getByText("Antes.")).toBeVisible();
    const plegado = igual.querySelector("details") as HTMLDetailsElement;
    expect(plegado).not.toBeNull();
    expect(plegado.open).toBe(false);
    expect(within(plegado).getByText("Ver la explicación").tagName).toBe("SUMMARY");
    expect(within(plegado).getByText("Primero.")).toBeInTheDocument();
  });

  it("una explicación de varias líneas se lee con la misma forma que la tarjeta, sin títulos de más", () => {
    const { container } = render(
      <HistorialAlertas historial={[entrada({ explanation: MODELO_453 })]} alertas={[alerta({ level: "medium", explanation: MODELO_454 })]} />
    );
    const explicacion = container.querySelector(".explicacion--historial") as HTMLElement;
    expect(explicacion.querySelector(".analisis__hecho")).toHaveTextContent(MODELO_453.split("\n")[0]);
    expect(explicacion.querySelector(".analisis__subtitulo")).toHaveTextContent("Lo que más se notó");
    expect([...explicacion.querySelectorAll(".analisis__lista li")].map((li) => li.textContent)).toEqual([
      "El texto largo que pegó a las 09:35 en la pregunta 3.",
      "En general, se tomó más tiempo que la mayoría para responder.",
    ]);
    // Un solo título en el apartado: el del historial.
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(container.textContent).not.toContain("•");
    expectLenguajeLlano(container);
  });
});

describe("Cómo cambió el riesgo", () => {
  it("una escalera en niveles, desde el inicio, con la hora de cada análisis arriba del rótulo", () => {
    const { container } = render(
      <EvolucionRiesgo
        historial={[entrada(), entrada({ origin: "event", level: "medium", recorded_at: "2026-11-10T13:30:00Z" })]}
        alertas={[]}
        estado="analyzed"
      />
    );
    expect(screen.getByRole("heading", { level: 3, name: "Cómo cambió el riesgo" })).toBeInTheDocument();
    const pasos = [...container.querySelectorAll<HTMLElement>(".pasos .paso")];
    expect(pasos.map((p) => p.textContent)).toEqual([
      "Desde el inicio: sin alertas",
      expect.stringMatching(/^Análisis de las \d{2}:\d{2}Riesgo bajo$/),
      expect.stringMatching(/^Análisis de las \d{2}:\d{2}Riesgo medio$/),
    ]);
    // La hora en su renglón, nunca pegada al medidor con dos puntos.
    expect(pasos[1].querySelector(".paso__hora")?.nextElementSibling).toHaveClass("rotulo-nivel");
    expect(pasos[0].querySelector(".medidor")).toBeNull();
    // Las flechas entre pasos no se leen.
    const flechas = container.querySelectorAll(".pasos__flecha");
    expect(flechas).toHaveLength(2);
    for (const f of flechas) expect(f).toHaveAttribute("aria-hidden", "true");
    expect(container.textContent).not.toMatch(/índice|\d+ de 100/);
    expectLenguajeLlano(container);
  });

  it("sin alertas, el estado del último análisis, en minúscula después de los dos puntos", () => {
    const textos = {
      analyzed: "Desde el inicio: sin alertas",
      not_analyzed: "Desde el inicio: sin analizar",
      insufficient_evidence: "Desde el inicio: no se pudo analizar",
      unavailable: "Desde el inicio: análisis no disponible",
    } as const;
    for (const [estado, texto] of Object.entries(textos)) {
      const { unmount } = render(<EvolucionRiesgo historial={[]} alertas={[]} estado={estado as keyof typeof textos} />);
      expect(screen.getByText(texto)).toBeInTheDocument();
      unmount();
    }
  });

  it("con una copiada y una alerta vigente sin entradas: sin registro de esa parte, y el otro origen aparte", () => {
    const { container } = render(
      <EvolucionRiesgo
        historial={[entrada({ carried_over: true })]}
        alertas={[alerta(), alerta({ origin: "event", level: "high", explanation: "Pegó." })]}
        estado="analyzed"
      />
    );
    const pasos = [...container.querySelectorAll(".pasos .paso")].map((p) => p.textContent);
    expect(pasos[0]).toBe("Desde el inicio: sin registro de esta parte del examen");
    expect(pasos[1]).toMatch(/Riesgo bajo$/);
    expect(screen.getByText("En un momento de la sesión: riesgo alto, sin registro de cuándo llegó a ese nivel.")).toBeInTheDocument();
    expectLenguajeLlano(container);
  });
});

describe("Momentos para revisar", () => {
  it("los tres tipos de eventos críticos, en el orden del registro", () => {
    const eventos = [
      evento(1, "keystroke"),
      evento(2, "clipboard", { action: "copy" }),
      evento(3, "clipboard", { action: "paste" }),
      evento(4, "fullscreen", { on: false, source: "api" }),
      evento(5, "resize"),
      evento(6, "fullscreen", { on: false, source: "size" }),
      evento(7, "focus_lost"),
      evento(8, "focus_gained", { away_ms: 3000 }),
      evento(9, "connection", { online: false }),
    ];
    expect(eventosCriticos(eventos).map((c) => [c.evento.id, c.titulo])).toEqual([
      [3, "Pegó un texto"],
      [4, "Salió de pantalla completa"],
      [7, "Pasó a otra ventana"],
    ]);
  });

  it("una salida a otra pestaña (ocultación y pérdida de foco seguidas) figura una sola vez", () => {
    const eventos = [evento(1, "visibility_hidden"), evento(2, "focus_lost"), evento(3, "visibility_visible"), evento(4, "focus_lost")];
    expect(eventosCriticos(eventos).map((c) => [c.evento.id, c.titulo])).toEqual([
      [1, "El examen dejó de verse en pantalla"],
      [4, "Pasó a otra ventana"],
    ]);
  });

  it("cada momento lleva a su fila del registro, con un nombre que dice cuál es", () => {
    const onIrAlEvento = vi.fn();
    const { container } = render(
      <CronologiaSesion eventos={[evento(3, "clipboard", { action: "paste" })]} onIrAlEvento={onIrAlEvento} />
    );
    expect(screen.getByRole("heading", { level: 3, name: "Momentos para revisar" })).toBeInTheDocument();
    const boton = screen.getByRole("button", { name: /^Ver en el registro: Pegó un texto, a las \d{2}:\d{2}$/ });
    expect(boton).toHaveClass("boton-texto");
    expect(boton).toHaveTextContent("Ver en el registro");
    fireEvent.click(boton);
    expect(onIrAlEvento).toHaveBeenCalledWith(3);
    // El mismo ícono que la fila del registro, oculto para los lectores.
    expect(container.querySelector(".momentos__que svg")).toHaveAttribute("aria-hidden", "true");
    expectLenguajeLlano(container);
  });

  it("un pegado que no es texto se nombra como en su fila del registro", () => {
    render(<CronologiaSesion eventos={[evento(3, "clipboard", { action: "paste", non_text: true })]} onIrAlEvento={() => {}} />);
    expect(screen.getByText("Pegó contenido que no es texto")).toBeInTheDocument();
  });

  it("sin eventos críticos lo dice", () => {
    const { container } = render(<CronologiaSesion eventos={[evento(1, "keystroke")]} onIrAlEvento={() => {}} />);
    expect(
      screen.getByText("No pegó texto, no cambió de ventana ni de pestaña y no salió de pantalla completa.")
    ).toBeInTheDocument();
    expect(choquesConLasListas([container.textContent ?? ""])).toEqual([]);
  });
});
