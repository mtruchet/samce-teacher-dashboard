import { CaretRight, Entregado, Rindiendo, SinNada, type Icon } from "../iconos";
import "./Fichas.css";

/**
 * Una lista para elegir adónde entrar: cursos primero, después exámenes.
 *
 * Es el mismo componente para los dos niveles porque la pregunta es la misma
 * en ambos —de todo esto, ¿qué quiero mirar?— y lo que cambia es sólo qué se
 * está nombrando. Dos componentes gemelos habrían sido dos lugares donde
 * corregir el día que el recuento se muestre distinto.
 *
 * Cada ficha dice cuántas sesiones tiene abiertas antes que cualquier otra
 * cosa, porque es lo único que hace que un curso valga la pena de abrirse
 * mientras hay un examen corriendo.
 */

export interface Ficha {
  /** Lo que se guarda en la dirección al elegirla. */
  clave: string;
  nombre: string;
  enCurso: number;
  finalizadas: number;
}

/**
 * Los dos estados, cada uno con su icono.
 *
 * Iban separados por un punto medio, que es un separador de texto corrido y
 * dejaba los dos números pegados en un mismo renglón gris. Con un icono cada
 * uno se leen como dos cosas distintas sin tener que leerlos.
 */
function Recuento({ ficha }: { ficha: Ficha }) {
  if (ficha.enCurso === 0 && ficha.finalizadas === 0) {
    return (
      <span className="ficha__estado ficha__estado--nada">
        <span className="ficha__cuenta">
          <SinNada size={15} weight="bold" aria-hidden="true" />
          sin sesiones todavía
        </span>
      </span>
    );
  }

  return (
    <span className="ficha__estado">
      {ficha.enCurso > 0 ? (
        <span className="ficha__cuenta ficha__cuenta--vivo">
          <Rindiendo size={15} weight="bold" aria-hidden="true" />
          {ficha.enCurso === 1 ? "1 rindiendo" : `${ficha.enCurso} rindiendo`}
        </span>
      ) : null}

      {/* El espacio va en el texto y no sólo en el hueco entre cajas: sin él,
          quien lee la página con un lector de pantalla escucha «2 rindiendo1
          entregada» de corrido. */}
      {ficha.enCurso > 0 && ficha.finalizadas > 0 ? " " : null}

      {ficha.finalizadas > 0 ? (
        <span className="ficha__cuenta">
          <Entregado size={15} weight="bold" aria-hidden="true" />
          {ficha.finalizadas === 1 ? "1 entregada" : `${ficha.finalizadas} entregadas`}
        </span>
      ) : null}
    </span>
  );
}

interface Props {
  fichas: Ficha[];
  /** Qué se está eligiendo. Ayuda a saber en qué escalón está uno parado. */
  icono: Icon;
  /** Qué es cada ficha, para que los lectores de pantalla lo anuncien. */
  rotulo: string;
  onElegir: (clave: string) => void;
  vacio: React.ReactNode;
}

export function Fichas({ fichas, icono: Icono, rotulo, onElegir, vacio }: Props) {
  if (fichas.length === 0) return <>{vacio}</>;

  return (
    <ul className="fichas" aria-label={rotulo}>
      {fichas.map((f) => (
        <li key={f.clave}>
          <button className="ficha" type="button" onClick={() => onElegir(f.clave)}>
            <Icono size={22} weight="duotone" aria-hidden={true} />
            <span className="ficha__nombre">{f.nombre}</span>
            <Recuento ficha={f} />
            <CaretRight size={14} weight="bold" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
