import { Fragment } from "react";
import { CaretRight } from "../iconos";
import "./Migas.css";

/**
 * El rastro de por dónde se entró.
 *
 * Hace las dos cosas que hacen falta cuando el panel tiene niveles: decir dónde
 * está parado el docente y dejarlo volver. Va arriba del título y no al lado,
 * porque se lee antes que él.
 *
 * El último escalón es el actual y no se puede pulsar: es texto, no un enlace
 * que no lleva a ningún lado.
 */

export interface Escalon {
  nombre: string;
  /** Sin esto, es el escalón donde está parado. */
  volver?: () => void;
}

export function Migas({ escalones }: { escalones: Escalon[] }) {
  if (escalones.length < 2) return null;

  return (
    <nav className="migas" aria-label="Dónde estás">
      <ol>
        {escalones.map((e, i) => (
          <Fragment key={e.nombre}>
            {i > 0 ? <CaretRight size={11} weight="bold" aria-hidden="true" /> : null}
            <li>
              {e.volver ? (
                <button className="migas__volver" type="button" onClick={e.volver}>
                  {e.nombre}
                </button>
              ) : (
                <span aria-current="page">{e.nombre}</span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
