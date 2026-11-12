import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { eventosCriticos } from "../eventos";
import { METRICAS, letras, minutosYSegundos, porSegundo } from "../metricas";
import type { AlertaDeSesion, EntradaDelHistorial } from "../services/sesionesService";
import { alerta as alertaVigente, entradaDelHistorial, evento, metricasDelCierre } from "../test/fabricas";
import { CronologiaSesion } from "./CronologiaSesion";
import { EvolucionRiesgo } from "./EvolucionRiesgo";
import { HistorialAlertas } from "./HistorialAlertas";
import { MetricasSesion } from "./MetricasSesion";

/** Las palabras que las rondas con los docentes sacaron de los textos del panel. */
const PROHIBIDAS = /%|proporci|caracteres|habitual|fuera del examen|salida más larga|portapapeles|captura|índice|integridad|esperad|promedio/i;

const METRICAS_CIERRE = metricasDelCierre({ silence_longest_s: null });

/** Una entrada y una alerta de toda la sesión en riesgo bajo, con un texto corto; cada caso pisa lo suyo. */
const PRIMERO = { level: "low", explanation: "Primero.", recorded_at: "2026-11-10T13:05:00Z" } as const;
const entrada = (cambios: Partial<EntradaDelHistorial> = {}) => entradaDelHistorial({ ...PRIMERO, ...cambios });
const alerta = (cambios: Partial<AlertaDeSesion> = {}) =>
  alertaVigente({ level: PRIMERO.level, explanation: PRIMERO.explanation, level_since: PRIMERO.recorded_at, ...cambios });

describe("Métricas de la sesión", () => {
  it("con la sesión finalizada y analizada: una por dimensión, con su valor y sin las proporciones", () => {
    const { container } = render(<MetricasSesion metricas={METRICAS_CIERRE} estado="analyzed" abierta={false} />);
    expect(container.querySelectorAll(".detalle-analisis__metrica")).toHaveLength(6);
    expect(screen.getByText("1 minuto y 35 segundos")).toBeInTheDocument();
    expect(screen.getByText("1.240 letras")).toBeInTheDocument();
    expect(screen.getByText("4,2 teclas por segundo")).toBeInTheDocument();
    expect(screen.getByText("Sin dato en esta sesión")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(PROHIBIDAS);
    expect(container.querySelector("[class*='barra'], [class*='comparacion']")).toBeNull();
  });

  it("con la sesión abierta dice que se muestran al terminar", () => {
    render(<MetricasSesion metricas={null} estado="analyzed" abierta />);
    expect(screen.getByText("Las métricas se muestran cuando la sesión termina.")).toBeInTheDocument();
  });

  it("sin evidencia suficiente no muestra ninguna, aunque el servidor las mandara", () => {
    const { container } = render(<MetricasSesion metricas={METRICAS_CIERRE} estado="insufficient_evidence" abierta={false} />);
    expect(screen.getByText("Esta sesión no se pudo analizar.")).toBeInTheDocument();
    expect(container.querySelector(".detalle-analisis__metrica")).toBeNull();
  });

  it("sin métricas del cierre dice que no están disponibles", () => {
    render(<MetricasSesion metricas={null} estado="unavailable" abierta={false} />);
    expect(screen.getByText("Las métricas no están disponibles para esta sesión.")).toBeInTheDocument();
  });

  it("los rótulos y los formatos respetan las rondas con los docentes", () => {
    for (const m of METRICAS) expect(`${m.dimension} ${m.rotulo}`).not.toMatch(PROHIBIDAS);
    expect(minutosYSegundos(60)).toBe("1 minuto");
    expect(porSegundo(1)).toBe("1 tecla por segundo");
    expect(letras(1)).toBe("1 letra");
  });
});

describe("Historial de alertas", () => {
  it("cada entrada con la hora del análisis rotulada como tal, su nivel y su origen", () => {
    render(
      <HistorialAlertas
        historial={[entrada(), entrada({ level: "high", explanation: "Después.", recorded_at: "2026-11-10T13:20:00Z" })]}
        alertas={[alerta({ level: "high", explanation: "Después." })]}
      />
    );
    expect(screen.getAllByText(/^Análisis de las/)).toHaveLength(2);
    expect(screen.queryByText(/Se detectó/)).not.toBeInTheDocument();
    expect(screen.getByText("Riesgo alto")).toBeInTheDocument();
    expect(screen.getAllByText("En toda la sesión")).toHaveLength(2);
    expect(screen.queryByText(/se actualizó después/)).not.toBeInTheDocument();
  });

  it("aclara las entradas copiadas y avisa si la explicación vigente cambió después", () => {
    render(<HistorialAlertas historial={[entrada({ carried_over: true })]} alertas={[alerta({ explanation: "Otra peor." })]} />);
    expect(screen.getByText(/el recorrido anterior de cada alerta no quedó registrado/)).toBeInTheDocument();
    expect(screen.getByText("La explicación se actualizó después; la vigente es la de la alerta de arriba.")).toBeInTheDocument();
  });
});

describe("Cómo cambió el riesgo", () => {
  it("en niveles, desde el inicio, con la hora de cada análisis", () => {
    const { container } = render(
      <EvolucionRiesgo historial={[entrada(), entrada({ origin: "event", level: "medium", recorded_at: "2026-11-10T13:30:00Z" })]} alertas={[]} estado="analyzed" />
    );
    const tramos = [...container.querySelectorAll(".detalle-analisis__tramo")].map((t) => t.textContent);
    expect(tramos[0]).toBe("Desde el inicio: Sin alertas");
    expect(tramos[1]).toMatch(/Análisis de las .*Riesgo bajo/);
    expect(tramos[2]).toMatch(/Riesgo medio/);
    expect(container.textContent).not.toMatch(/índice|\d+ de 100/);
  });

  it("sin alertas, el estado del último análisis", () => {
    render(<EvolucionRiesgo historial={[]} alertas={[]} estado="insufficient_evidence" />);
    expect(screen.getByText("Desde el inicio: No se pudo analizar")).toBeInTheDocument();
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

  it("cada momento lleva a su fila del registro", () => {
    const onIrAlEvento = vi.fn();
    render(<CronologiaSesion eventos={[evento(3, "clipboard", { action: "paste" })]} onIrAlEvento={onIrAlEvento} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver en el registro" }));
    expect(onIrAlEvento).toHaveBeenCalledWith(3);
  });

  it("sin eventos críticos lo dice", () => {
    render(<CronologiaSesion eventos={[evento(1, "keystroke")]} onIrAlEvento={() => {}} />);
    expect(screen.getByText(/No hubo pegados de texto/)).toBeInTheDocument();
  });
});
