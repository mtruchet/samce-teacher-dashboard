import type { ReactNode } from "react";
import "./Pie.css";

/**
 * Pie-directorio de cuatro columnas, compartido por la página pública y el
 * panel.
 *
 * Ninguno de los portales institucionales relevados cierra repitiendo el botón
 * del encabezado: cierran con un directorio. Y todos llevan procedencia
 * verificable, fecha y razón social.
 *
 * Lo único que cambia entre las dos pantallas es la segunda columna, que llega
 * por `children`, y el ancho del marco. Todo lo demás —la identidad, el equipo,
 * la facultad— es lo mismo, y tiene que seguir siéndolo: cuando estaba escrito
 * dos veces, ya se había despegado.
 */
interface Props {
  /** La segunda columna, con su propio h2 y su lista. */
  children: ReactNode;
  /** El panel es más ancho que la página pública. */
  ancho?: "publico" | "panel";
}

export function Pie({ children, ancho = "publico" }: Props) {
  const marco = ancho === "panel" ? "marco marco--panel" : "marco";

  return (
    <footer className="pie">
      <div className={`${marco} pie__directorio`}>
        <div className="pie__col">
          <img
            className="pie__logo"
            src="/img/utn-frsf-blanco.png"
            alt="Universidad Tecnológica Nacional, Facultad Regional San Francisco"
          />
          <p className="pie__nombre">
            Sistema de Monitoreo de Comportamiento de Exámenes
          </p>
          <p className="pie__descripcion">Proyecto final de carrera.</p>
        </div>

        <div className="pie__col">{children}</div>

        <div className="pie__col">
          <h2 className="pie__titulo">El proyecto</h2>
          <ul>
            <li className="pie__rol">
              <span className="pie__cargo">Autor 1</span>
              Facundo Joel Pepino
            </li>
            <li className="pie__rol">
              <span className="pie__cargo">Autor 2</span>
              Mauricio Gaspar Truchet
            </li>
            <li className="pie__rol">
              <span className="pie__cargo">Tutor</span>
              Ing. Juan Carlos Calloni
            </li>
            <li className="pie__rol">
              <span className="pie__cargo">Aprendizaje automático</span>
              Mg. Ing. Rebeca Yuan
            </li>
          </ul>
        </div>

        <div className="pie__col">
          <h2 className="pie__titulo">La facultad</h2>
          <ul>
            <li>
              <a href="https://sanfrancisco.utn.edu.ar" target="_blank" rel="noreferrer">
                UTN Facultad Regional San Francisco
              </a>
            </li>
            <li>
              <a href="https://samce-entorno-moodle-production.up.railway.app" target="_blank" rel="noreferrer">
                Campus Virtual
              </a>
            </li>
            <li className="pie__rol">Av. de la Universidad 501</li>
            <li className="pie__rol">(2400) San Francisco, Córdoba</li>
          </ul>
        </div>
      </div>

    </footer>
  );
}
