import { horaCorta } from "../eventos";
import { tramosDeRiesgo, type Tramo } from "../evolucion";
import { CaretRight } from "../iconos";
import { ESTADOS_SIN_ALERTAS, ORIGENES, PALABRA_DEL_NIVEL } from "../lenguajeAlerta";
import type { AlertaDeSesion, EntradaDelHistorial, EstadoDelAnalisis } from "../services/sesionesService";
import { RotuloNivel } from "./RotuloNivel";

interface Props {
  historial: EntradaDelHistorial[];
  alertas: AlertaDeSesion[];
  estado: EstadoDelAnalisis;
}

/** «Sin alertas» → «sin alertas»: después de los dos puntos sigue la frase, en minúscula. */
const enMinuscula = (texto: string) => texto.charAt(0).toLowerCase() + texto.slice(1);

function Paso({ tramo }: { tramo: Tramo }) {
  switch (tramo.tipo) {
    case "inicio":
      return <span className="paso">Desde el inicio: {enMinuscula(ESTADOS_SIN_ALERTAS[tramo.estado])}</span>;
    case "sin-registro":
      return <span className="paso">Desde el inicio: sin registro de esta parte del examen</span>;
    case "nivel":
      return (
        <span className="paso paso--nivel" data-nivel={tramo.nivel}>
          <span className="paso__hora">
            Análisis de las <time className="cifra" dateTime={tramo.desde}>{horaCorta(tramo.desde)}</time>
          </span>
          <RotuloNivel nivel={tramo.nivel} />
        </span>
      );
  }
}

/**
 * Cómo cambió el riesgo de la sesión (HU05, criterio 4): una escalera con los niveles que tomó durante el examen,
 * cada uno con la hora del análisis que registró el cambio («Análisis de las 09:36»), en niveles y nunca en
 * índice. No baja, porque el nivel de una alerta no baja. Es el único lugar que dice cómo cambió el nivel de la
 * sesión; la explicación de cada cambio está en el historial.
 *
 * Debajo van los orígenes cuyo nivel vigente no quedó registrado, sin hora.
 */
export function EvolucionRiesgo({ historial, alertas, estado }: Props) {
  const { tramos, sinRegistro } = tramosDeRiesgo(historial, alertas, estado);
  return (
    <div className="apartado">
      <h3 className="apartado__titulo">Cómo cambió el riesgo</h3>
      <ol className="pasos">
        {tramos.map((tramo, i) => (
          <li key={i} className="pasos__item">
            {i > 0 ? <CaretRight className="pasos__flecha" size={14} aria-hidden="true" /> : null}
            <Paso tramo={tramo} />
          </li>
        ))}
      </ol>
      {sinRegistro.map(({ origen, nivel }) => (
        <p key={origen} className="apartado__nota">
          {ORIGENES[origen]}: riesgo {PALABRA_DEL_NIVEL[nivel]}, sin registro de cuándo llegó a ese nivel.
        </p>
      ))}
    </div>
  );
}
