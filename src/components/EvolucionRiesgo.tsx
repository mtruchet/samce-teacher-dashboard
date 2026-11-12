import { horaCorta } from "../eventos";
import { tramosDeRiesgo, type Tramo } from "../evolucion";
import { ESTADOS_SIN_ALERTAS, NIVELES, ORIGENES } from "../lenguajeAlerta";
import type { AlertaDeSesion, EntradaDelHistorial, EstadoDelAnalisis } from "../services/sesionesService";
import { MedidorNivel } from "./MedidorNivel";

interface Props {
  historial: EntradaDelHistorial[];
  alertas: AlertaDeSesion[];
  estado: EstadoDelAnalisis;
}

function TextoDelTramo({ tramo }: { tramo: Tramo }) {
  switch (tramo.tipo) {
    case "inicio":
      return <span>Desde el inicio: {ESTADOS_SIN_ALERTAS[tramo.estado]}</span>;
    case "sin-registro":
      return <span>Desde el inicio: sin registro de esta parte del examen</span>;
    case "nivel":
      return (
        <span>
          <span className="detalle-analisis__hora">
            Análisis de las{" "}
            <time className="cifra" dateTime={tramo.desde}>{horaCorta(tramo.desde)}</time>
          </span>
          {": "}
          <MedidorNivel nivel={tramo.nivel} />
          <span className="detalle-analisis__nivel">{NIVELES[tramo.nivel]}</span>
        </span>
      );
  }
}

/**
 * Cómo cambió el riesgo de la sesión (HU05, criterio 4): la secuencia de niveles que tomó durante el
 * examen, con la hora del análisis que registró cada cambio, en niveles y nunca en índice. No baja, porque
 * el nivel de una alerta no baja. La hora es la del análisis («Análisis de las 09:36»), no la del hecho.
 */
export function EvolucionRiesgo({ historial, alertas, estado }: Props) {
  const { tramos, sinRegistro } = tramosDeRiesgo(historial, alertas, estado);
  return (
    <div className="detalle-analisis__parte">
      <h3 className="detalle-analisis__subtitulo">Cómo cambió el riesgo</h3>
      <ol className="detalle-analisis__lista">
        {tramos.map((tramo, i) => (
          <li
            key={i}
            className={tramo.tipo === "nivel" ? `detalle-analisis__tramo detalle-analisis__tramo--${tramo.nivel}` : "detalle-analisis__tramo"}
            data-nivel={tramo.tipo === "nivel" ? tramo.nivel : undefined}
          >
            <TextoDelTramo tramo={tramo} />
          </li>
        ))}
      </ol>
      {sinRegistro.map(({ origen, nivel }) => (
        <p key={origen} className="detalle-analisis__nota">
          {ORIGENES[origen]}: {NIVELES[nivel].toLowerCase()}, sin registro de cuándo llegó a ese nivel.
        </p>
      ))}
    </div>
  );
}
