import { CaretDown } from "../iconos";
import "./EntradaMoodle.css";

/**
 * Por dónde entra el docente, dibujado.
 *
 * El acceso es lo primero que un docente necesita saber y lo último que
 * cualquiera lee si viene en un párrafo.
 *
 * El complemento agrega su enlace con `local_samce_extend_navigation_course()`,
 * y Moodle suma esos nodos al final de la navegación del curso. Como la barra
 * ya trae catorce ítems, el enlace no queda nunca como una pestaña más: cae
 * adentro del desplegable «Más». Por eso la escena que se dibuja es esa y no
 * una sexta pestaña, que a un docente que usa Moodle todos los días le sonaría
 * falsa de inmediato.
 *
 * Los nombres son los que devuelve Moodle 4.5 en español para un docente
 * dentro de un curso, en su orden. El color de la banda es el del Campus
 * Virtual de la Facultad.
 */

const PESTANAS = ["Curso", "Configuración", "Participantes", "Calificaciones", "Informes"];

const DESPLEGADOS = [
  "Banco de preguntas",
  "Banco de contenido",
  "Insignias",
  "Competencias",
  "Filtros",
  "Reutilización de curso",
];

export function EntradaMoodle() {
  return (
    <figure className="entrada">
      <div className="entrada__ventana">
        <div className="entrada__barra" aria-hidden="true">
          <span className="entrada__puntos">
            <i /><i /><i />
          </span>
          <span className="entrada__url cifra">
            samce-entorno-moodle.up.railway.app/course/view.php?id=2
          </span>
        </div>

        <div className="entrada__campus" aria-hidden="true">
          <span className="entrada__marca">CAMPUS VIRTUAL</span>
        </div>

        <div className="entrada__curso">
          <p className="entrada__nombre">Sistemas de Información II</p>

          <ul className="entrada__pestanas">
            {PESTANAS.map((p, i) => (
              <li key={p} className={i === 0 ? "entrada__activa" : ""}>
                {p}
              </li>
            ))}

            <li className="entrada__mas">
              <span className="entrada__abierta">
                Más
                <CaretDown size={11} weight="bold" aria-hidden="true" />
              </span>

              <ul className="entrada__lista">
                {DESPLEGADOS.map((d) => (
                  <li key={d}>{d}</li>
                ))}
                <li className="entrada__destino">
                  Panel de supervisión SAMCE
                  <span className="entrada__pulso" aria-hidden="true" />
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>

      <figcaption className="entrada__pie">
        Menú del curso en Moodle 4.5. El complemento agrega el último ítem del desplegable.
      </figcaption>
    </figure>
  );
}
