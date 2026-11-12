import { NIVELES_DE_RIESGO, type NivelDeRiesgo } from "../niveles";
import { PESO_DEL_NIVEL } from "../lenguajeAlerta";
import "./MedidorNivel.css";

/**
 * El nivel de una alerta dibujado: tres segmentos, uno, dos o tres llenos.
 *
 * Es intensidad y no semáforo: lo que más cambia es cuántos segmentos van llenos, y el tono (el de
 * las alertas, de frío a cálido, que pone `[data-nivel]` en `styles/nivel.css`) acompaña. Va oculto para los lectores de pantalla porque la
 * palabra de al lado («Riesgo bajo», «Riesgo medio», «Riesgo alto») ya lo dice; el color y la forma
 * solos no alcanzan para quien no los distingue.
 */

/** Tantos segmentos como niveles; van llenos tantos como pesa el nivel (`PESO_DEL_NIVEL`). */
const SEGMENTOS = NIVELES_DE_RIESGO.map((_, i) => i + 1);

export function MedidorNivel({ nivel }: { nivel: NivelDeRiesgo }) {
  return (
    <span className="medidor" aria-hidden="true">
      {SEGMENTOS.map((i) => (
        <span key={i} className={i <= PESO_DEL_NIVEL[nivel] ? "medidor__segmento medidor__segmento--lleno" : "medidor__segmento"} />
      ))}
    </span>
  );
}
