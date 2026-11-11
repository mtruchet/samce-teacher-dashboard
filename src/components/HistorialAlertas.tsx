import { horaCorta } from "../eventos";
import { ordenarExplicacion } from "../explicacion";
import { NIVELES, ORIGENES } from "../lenguajeAlerta";
import type { AlertaDeSesion, EntradaDelHistorial } from "../services/sesionesService";
import { MedidorNivel } from "./MedidorNivel";

interface Props {
  historial: EntradaDelHistorial[];
  /** Las alertas vigentes: para avisar cuando la explicación de una se actualizó después de su última entrada. */
  alertas: AlertaDeSesion[];
}

/** El texto de una entrada, por renglones, como el de las tarjetas: el panel no traduce nada. */
function Explicacion({ texto }: { texto: string }) {
  const e = ordenarExplicacion(texto);
  return (
    <div className="detalle-analisis__explicacion">
      <p>{e.hecho}</p>
      {e.notasAntes.map((n) => <p key={n}>{n}</p>)}
      {e.viñetas.length > 0 ? (
        <>
          {e.encabezadoDeLista ? <p>{e.encabezadoDeLista}:</p> : null}
          <ul>
            {e.viñetas.map((v) => <li key={v}>{v}</li>)}
          </ul>
        </>
      ) : null}
      {e.notas.map((n) => <p key={n}>{n}</p>)}
    </div>
  );
}

/**
 * El historial de alertas de la sesión (HU05, criterio 2): cada aparición o subida de nivel, en orden, con
 * su origen, su nivel y su explicación. La hora es la del análisis que la registró, rotulada como tal
 * («Análisis de las 09:36»): la del hecho la dice la explicación del motor, con la hora de la fila del
 * registro. El reemplazo de la explicación dentro del mismo nivel no deja entrada, así que la última de un
 * origen puede tener otro texto que la alerta de arriba: en ese caso se avisa.
 */
export function HistorialAlertas({ historial, alertas }: Props) {
  const copiadas = historial.some((e) => e.carried_over);
  const ultimaDe = new Map(historial.map((e, i) => [e.origin, i]));
  return (
    <div className="detalle-analisis__parte">
      <h3 className="detalle-analisis__subtitulo">Historial de alertas</h3>
      {copiadas ? (
        <p className="detalle-analisis__nota">
          En esta sesión, rendida antes de que se guardara el historial, el recorrido anterior de cada alerta no quedó
          registrado.
        </p>
      ) : null}
      <ol className="detalle-analisis__lista">
        {historial.map((entrada, i) => {
          const vigente = alertas.find((a) => a.origin === entrada.origin);
          const actualizada = ultimaDe.get(entrada.origin) === i && vigente && vigente.explanation !== entrada.explanation;
          return (
            <li key={`${entrada.origin}-${entrada.level}`} className={`detalle-analisis__entrada detalle-analisis__entrada--${entrada.level}`}>
              <p className="detalle-analisis__cabeza">
                <span className="detalle-analisis__hora">
                  Análisis de las{" "}
                  <time className="cifra" dateTime={entrada.recorded_at}>{horaCorta(entrada.recorded_at)}</time>
                </span>{" "}
                <MedidorNivel nivel={entrada.level} />
                <span className="detalle-analisis__nivel">{NIVELES[entrada.level]}</span>{" "}
                <span className="detalle-analisis__origen">{ORIGENES[entrada.origin]}</span>
              </p>
              <Explicacion texto={entrada.explanation} />
              {actualizada ? (
                <p className="detalle-analisis__nota">La explicación se actualizó después; la vigente es la de la alerta de arriba.</p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
