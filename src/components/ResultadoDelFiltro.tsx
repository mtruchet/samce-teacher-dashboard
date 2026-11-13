import { textoDelResultado } from "./textoDelResultado";
import "./ResultadoDelFiltro.css";

interface Props {
  /** Si la dirección tiene un filtro. Sin filtro el renglón queda vacío, pero sigue ocupando su lugar. */
  conFiltro: boolean;
  /** Cuántas sesiones cumplen el filtro en toda la evaluación (X-Total-Count). Null mientras no se sabe. */
  cuantas: number | null;
  /** Cuántas sesiones tiene la evaluación, sin filtro: el total del resumen de la misma respuesta. */
  deCuantas: number;
  /** Borra los filtros y conserva el orden. */
  onQuitar: () => void;
}

/**
 * El renglón del resultado de un filtro, debajo de la barra: «N de M sesiones» y «Quitar filtros».
 *
 * Está siempre, con o sin filtro, y mide lo mismo: si apareciera solo con un filtro, la lámina de control
 * crecía al tocar una tarjeta y todo lo de abajo bajaba un renglón, justo cuando el docente iba a mirar la
 * lista. Sin filtro va vacío y oculto para los lectores de pantalla: «N sesiones» sin filtro no dice nada que
 * el resumen no diga.
 *
 * Es el único lugar con el total de la evaluación filtrada y el único «Quitar filtros» de la pantalla: está
 * a la vista siempre que hay un filtro, no solo cuando no coincide ninguna sesión. Mientras la respuesta
 * del filtro no llegó, la cifra no se muestra (mostrar la del pedido anterior daba «M de M»), pero su lugar
 * sí, así «Quitar filtros» no se corre cuando llega. No es una región viva: el anuncio va aparte, una vez por
 * vista (`AnuncioVivo`).
 */
export function ResultadoDelFiltro({ conFiltro, cuantas, deCuantas, onQuitar }: Props) {
  if (!conFiltro) return <div className="control__resultado" aria-hidden="true" />;
  return (
    <div className="control__resultado">
      <p className="control__cifra cifra" aria-hidden={cuantas === null || undefined}>
        {cuantas !== null ? textoDelResultado(cuantas, deCuantas) : null}
      </p>
      <button type="button" className="boton-texto" onClick={onQuitar}>
        Quitar filtros
      </button>
    </div>
  );
}
