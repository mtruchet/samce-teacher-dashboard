import { textoDelResultado } from "../filtrosDeLaDireccion";
import "./ResultadoDelFiltro.css";

interface Props {
  /** Cuántas sesiones cumplen el filtro en toda la evaluación (X-Total-Count). Null mientras no se sabe. */
  cuantas: number | null;
  /** Cuántas sesiones tiene la evaluación, sin filtro: el total del resumen de la misma respuesta. */
  deCuantas: number;
  /** Borra los filtros y conserva el orden. */
  onQuitar: () => void;
}

/**
 * El renglón del resultado de un filtro, debajo de la barra: «N de M sesiones» y «Quitar filtros». Quien lo
 * monta lo dibuja solo con un filtro activo; sin filtro no ocupa lugar.
 *
 * Es el único lugar con el total de la evaluación filtrada y el único «Quitar filtros» de la pantalla: está
 * a la vista siempre que hay un filtro, no solo cuando no coincide ninguna sesión. Mientras la respuesta
 * del filtro no llegó, la cifra no se muestra (mostrar la del pedido anterior daba «M de M»), pero el botón
 * sí. No es una región viva: el anuncio va aparte, una vez por vista (`AnuncioVivo`).
 */
export function ResultadoDelFiltro({ cuantas, deCuantas, onQuitar }: Props) {
  return (
    <div className="control__resultado">
      {cuantas !== null ? (
        <p className="control__cifra cifra">
          {textoDelResultado(cuantas, deCuantas)}
        </p>
      ) : null}
      <button type="button" className="boton-texto" onClick={onQuitar}>
        Quitar filtros
      </button>
    </div>
  );
}
