import { ESTADOS_SIN_ALERTAS, ULTIMO_ANALISIS, cantidadYOrigen } from "../lenguajeAlerta";
import type { Sesion } from "../services/sesionesService";
import { RotuloNivel } from "./RotuloNivel";
import "./IndicadorSesion.css";

/**
 * Lo que el docente ve del análisis de una sesión en la lista (HU03): su nivel de riesgo, el más
 * alto entre los de sus alertas, con cuántas alertas tiene y de dónde salieron; o, si no tiene
 * alertas, el estado de su último análisis. Nunca el índice de integridad.
 *
 * La marca no depende solo del color: el rótulo escrito, el medidor con segmentos llenos (forma, no
 * tono) y un borde a la izquierda (`RotuloNivel` y `.marca-nivel`, los mismos del detalle). El medidor es decorativo y va oculto para los lectores de
 * pantalla, porque el rótulo ya lo dice. Una sesión sin alertas no tiene nivel y nunca se muestra
 * como «Riesgo bajo».
 */
export function IndicadorSesion({ sesion }: { sesion: Sesion }) {
  // Un backend viejo no manda los campos: la celda queda vacía, como la marca de captura.
  if (sesion.analysis_state === undefined) return null;

  if (sesion.risk_level) {
    const alertas = cantidadYOrigen(sesion);
    return (
      <span className={`indicador indicador--${sesion.risk_level} marca-nivel`} data-nivel={sesion.risk_level}>
        <RotuloNivel nivel={sesion.risk_level} />
        {alertas ? <span className="indicador__alertas">{alertas}</span> : null}
        {sesion.analysis_state !== "analyzed" ? (
          <span className="indicador__estado">{ULTIMO_ANALISIS[sesion.analysis_state]}</span>
        ) : null}
      </span>
    );
  }
  return <span className="indicador indicador--sin-nivel">{ESTADOS_SIN_ALERTAS[sesion.analysis_state]}</span>;
}
