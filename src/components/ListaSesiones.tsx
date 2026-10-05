import { nombreDeAlumno, type SesionNumerada } from "../services/sesionesService";
import { Usuario } from "../iconos";
import { avisoDeCaptura } from "../captura";
import { horaCorta } from "../eventos";
import { Transcurrido } from "./Transcurrido";
import "./ListaSesiones.css";

/**
 * Las sesiones de un examen.
 *
 * Es una tabla y no tarjetas: durante el examen el docente no lee cada sesión,
 * busca un dato en todas ellas, y eso es escaneo vertical de una columna. Va en
 * `<table>` nativa, así la navegación por teclado viene de fábrica.
 *
 * Sin cebra y sin líneas divisorias: separan la alineación de las columnas, el
 * aire dentro de la fila y el realce al pasar por encima.
 *
 * El orden lo decide el backend, y nunca es por ningún indicador de riesgo: una
 * lista ordenada por índice es un ranking, y su primer puesto es una acusación.
 */

/**
 * Cuándo empezó. La hora sola si fue hoy; si fue otro día, con la fecha
 * adelante, porque en «Finalizadas» conviven intentos de días distintos y dos
 * «16:04» no se distinguen.
 */
function comienzo(iso: string) {
  const d = new Date(iso);
  const hora = horaCorta(iso);
  if (d.toDateString() === new Date().toDateString()) return hora;
  return `${d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} ${hora}`;
}

/**
 * El renglón chico debajo del nombre: qué número de intento es, y si quedó sin
 * entregar. Los dos son datos de la sesión y ninguno está siempre.
 *
 * Con un solo intento el número no aclara nada y sería ruido en todas las filas.
 */
function pie(s: SesionNumerada): string {
  const partes: string[] = [];
  if (s.intentos > 1) partes.push(`intento ${s.intento} de ${s.intentos}`);
  if (s.status === "abandoned") partes.push("sin entregar");
  return partes.join(", ");
}

interface Props {
  titulo: string;
  sesiones: SesionNumerada[];
  /** Cuántas tiene el grupo en total, aunque no estén todas cargadas. */
  total?: number;
  /** Las cerradas no llevan un reloj corriendo sino una duración. */
  cerradas?: boolean;
  vacio?: React.ReactNode;
  /** Abre lo que pasó durante el intento. */
  onVerEventos: (sesion: SesionNumerada) => void;
}

export function ListaSesiones({ titulo, sesiones, total, cerradas = false, vacio, onVerEventos }: Props) {
  // «50 de 80» cuando la lista está cortada, para que el número coincida con el
  // de la ficha del examen y se note que faltan filas por traer.
  const cuenta =
    total !== undefined && total > sesiones.length ? `${sesiones.length} de ${total}` : String(sesiones.length);
  return (
    <section className="lista">
      <header className="lista__encabezado">
        <h2 className="lista__titulo">{titulo}</h2>
        <span className="lista__cuenta cifra">{cuenta}</span>
      </header>

      {sesiones.length === 0 ? (
        vacio
      ) : (
        <div className="lista__marco">
          <table className="tabla">
            <caption className="solo-lectores">
              {titulo}. Cada fila es la sesión de un alumno: cuándo empezó, cuánto lleva o
              cuánto duró, y el acceso a sus eventos.
            </caption>
            <thead>
              <tr>
                <th scope="col">Alumno</th>
                <th scope="col" className="tabla__der tabla__hora">Comenzó</th>
                <th scope="col" className="tabla__der">
                  {cerradas ? "Duración" : "Transcurrido"}
                </th>
                <th scope="col" className="tabla__der tabla__eventos">Eventos</th>
              </tr>
            </thead>
            <tbody>
              {sesiones.map((s) => {
                const aviso = avisoDeCaptura(s.capture);
                const renglon = pie(s);
                return (
                  <tr key={s.id}>
                    <td>
                      <span className="alumno">
                        <Usuario size={18} weight="duotone" aria-hidden="true" />
                        <span className="alumno__datos">
                          {/* El nombre es lo que el docente reconoce. Sin nombre,
                              `nombreDeAlumno` pone el número del aula virtual. */}
                          <span className="alumno__nombre">
                            {nombreDeAlumno(s)}
                          </span>
                          {/* La marca está o no está: sin puntajes ni colores de riesgo. El
                              texto completo va en el detalle de la sesión. */}
                          {aviso ? (
                            <span className="alumno__captura" title={aviso.detalle}>
                              {aviso.corto}
                            </span>
                          ) : null}
                          {/* «abandoned» es el intento que venció o se dejó sin
                              entregar. Va acá y no como una tercera lista: el
                              docente ya tiene dos donde mirar, y lo que cambia
                              es esta fila y no el grupo entero. Dice que no se
                              entregó, que es el hecho, y no por qué. */}
                          {renglon ? (
                            <span className="alumno__pie cifra">{renglon}</span>
                          ) : null}
                        </span>
                      </span>
                    </td>
                    <td className="tabla__der tabla__hora">
                      <span className="cifra">{comienzo(s.started_at)}</span>
                    </td>
                    <td className="tabla__der">
                      {/* Un intento sin entregar no tiene una duración que el panel
                          conozca: el cierre es cuando Moodle procesó el abandono,
                          que puede ser mucho después de que el alumno dejó de
                          rendir. La fila ya dice «sin entregar». */}
                      {s.status === "abandoned" ? (
                        <span className="cifra">
                          <span aria-hidden="true">—</span>
                          <span className="solo-lectores">duración desconocida</span>
                        </span>
                      ) : (
                        <Transcurrido inicio={s.started_at} cierre={s.closed_at ?? null} />
                      )}
                    </td>
                    <td className="tabla__der tabla__eventos">
                      <button
                        className="tabla__accion"
                        type="button"
                        onClick={() => onVerEventos(s)}
                        aria-label={`Ver los eventos de ${nombreDeAlumno(s)}${
                          s.intentos > 1 ? `, intento ${s.intento} de ${s.intentos}` : ""
                        }`}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
