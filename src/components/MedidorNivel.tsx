import type { AlertaDeSesion } from "../services/sesionesService";

/**
 * El nivel de una alerta dibujado: tres segmentos, uno, dos o tres llenos.
 *
 * Es intensidad y no semáforo: los tres niveles usan el mismo tono, de claro a hondo, y lo que
 * cambia es cuántos segmentos van llenos. Va oculto para los lectores de pantalla porque la
 * palabra de al lado («Riesgo bajo», «Riesgo medio», «Riesgo alto») ya lo dice; el color y la forma
 * solos no alcanzan para quien no los distingue.
 */

const LLENOS: Record<AlertaDeSesion["level"], number> = { low: 1, medium: 2, high: 3 };

export function MedidorNivel({ nivel }: { nivel: AlertaDeSesion["level"] }) {
  return (
    <span className="medidor" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= LLENOS[nivel] ? "medidor__segmento medidor__segmento--lleno" : "medidor__segmento"} />
      ))}
    </span>
  );
}
