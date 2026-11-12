import { ORIGENES } from "../lenguajeAlerta";
import type { AlertaDeSesion } from "../services/sesionesService";
import { ExplicacionDelMotor } from "./ExplicacionDelMotor";
import { RotuloNivel } from "./RotuloNivel";

/**
 * Una alerta vigente: el nivel con su origen y la explicación del motor. Es el único lugar donde se lee completa
 * la explicación vigente; el historial la pliega cuando es la misma.
 *
 * Sin hora en la cabecera: la que da la API es la del análisis y no la del hecho, y no coincidía con el registro
 * (ver `lenguajeAlerta.ts`). Cuándo y dónde fue lo dice el texto del motor, con la hora de la fila del registro:
 * «A las 09:35, en la pregunta 3, …».
 */
export function TarjetaAlerta({ alerta }: { alerta: AlertaDeSesion }) {
  return (
    <li
      className={`analisis__alerta analisis__alerta--${alerta.level}`}
      data-nivel={alerta.level}
      data-origen={alerta.origin}
    >
      <div className="analisis__cuerpo">
        <div className="analisis__cabeza">
          <RotuloNivel nivel={alerta.level} complemento={ORIGENES[alerta.origin]} />
        </div>
        <ExplicacionDelMotor texto={alerta.explanation} variante="tarjeta" />
      </div>
    </li>
  );
}
