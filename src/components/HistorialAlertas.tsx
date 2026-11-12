import { horaCorta } from "../eventos";
import { ORIGENES } from "../lenguajeAlerta";
import type { AlertaDeSesion, EntradaDelHistorial } from "../services/sesionesService";
import { ExplicacionDelMotor } from "./ExplicacionDelMotor";
import { RotuloNivel } from "./RotuloNivel";

interface Props {
  historial: EntradaDelHistorial[];
  /** Las alertas vigentes: para plegar la explicación que repite la vigente y para el aviso del reemplazo. */
  alertas: AlertaDeSesion[];
}

/** Lo que se dice cuando un análisis posterior cambió el texto de una alerta sin cambiarle el nivel (D6). */
const EXPLICACION_REEMPLAZADA =
  "Un análisis posterior reemplazó esta explicación por otra, sin cambiar el nivel de riesgo.";

/**
 * El historial de alertas de la sesión (HU05, criterio 2): cada aparición o subida de nivel, en orden, con su
 * origen, su nivel y su explicación. La hora es la del análisis que la registró, rotulada como tal («Análisis de
 * las 09:36»): la del hecho la dice la explicación del motor, con la hora de la fila del registro.
 *
 * La explicación vigente se lee completa en su tarjeta: si una entrada dice exactamente lo mismo, va plegada
 * («Ver la explicación»), para no leer dos veces el mismo texto.
 *
 * El reemplazo de la explicación dentro del mismo nivel no deja entrada. Por eso la última entrada de un origen,
 * en el mismo nivel que la alerta vigente, puede tener un texto distinto del vigente: ahí se avisa que un análisis
 * posterior lo reemplazó, y la entrada queda abierta. Si el nivel es otro, el cambio de texto se explica solo por
 * la subida y no hace falta avisar.
 */
export function HistorialAlertas({ historial, alertas }: Props) {
  const copiadas = historial.some((e) => e.carried_over);
  const ultimaDe = new Map(historial.map((e, i) => [e.origin, i]));
  return (
    <div className="apartado">
      <h3 className="apartado__titulo">Historial de alertas</h3>
      {copiadas ? (
        <p className="apartado__nota">
          En esta sesión, rendida antes de que se guardara el historial, el recorrido anterior de cada alerta no quedó
          registrado.
        </p>
      ) : null}
      <ol className="historial">
        {historial.map((entrada, i) => {
          const vigente = alertas.find((a) => a.origin === entrada.origin);
          const actualizada =
            ultimaDe.get(entrada.origin) === i &&
            vigente !== undefined &&
            vigente.level === entrada.level &&
            vigente.explanation !== entrada.explanation;
          const repetida = vigente !== undefined && vigente.explanation === entrada.explanation;
          return (
            <li
              key={`${entrada.origin}-${entrada.level}-${entrada.recorded_at}`}
              className="historial__entrada marca-nivel"
              data-nivel={entrada.level}
            >
              <p className="historial__hora">
                Análisis de las <time className="cifra" dateTime={entrada.recorded_at}>{horaCorta(entrada.recorded_at)}</time>
              </p>
              <RotuloNivel nivel={entrada.level} complemento={ORIGENES[entrada.origin]} />
              {actualizada ? <p className="historial__aviso">{EXPLICACION_REEMPLAZADA}</p> : null}
              {repetida ? (
                <details className="historial__plegado">
                  <summary>Ver la explicación</summary>
                  <ExplicacionDelMotor texto={entrada.explanation} variante="historial" />
                </details>
              ) : (
                <ExplicacionDelMotor texto={entrada.explanation} variante="historial" />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
