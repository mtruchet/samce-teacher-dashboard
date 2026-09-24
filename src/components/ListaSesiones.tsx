import type { SesionNumerada } from "../services/sesionesService";
import { Usuario } from "../iconos";
import { avisoDeCaptura } from "../captura";
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

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

interface Props {
  titulo: string;
  sesiones: SesionNumerada[];
  /** Las cerradas no llevan un reloj corriendo sino una duración. */
  cerradas?: boolean;
  vacio?: React.ReactNode;
  /** Abre lo que pasó durante el intento. Sin esto la columna no aparece. */
  onVerEventos?: (sesion: SesionNumerada) => void;
}

export function ListaSesiones({ titulo, sesiones, cerradas = false, vacio, onVerEventos }: Props) {
  return (
    <section className="lista">
      <header className="lista__encabezado">
        <h2 className="lista__titulo">{titulo}</h2>
        <span className="lista__cuenta cifra">{sesiones.length}</span>
      </header>

      {sesiones.length === 0 ? (
        vacio
      ) : (
        <div className="lista__marco">
          <table className="tabla">
            <caption className="solo-lectores">
              {titulo}. Cada fila es la sesión de un alumno, con su nombre y su número del
              aula virtual.
            </caption>
            <thead>
              <tr>
                <th scope="col">Alumno</th>
                <th scope="col" className="tabla__der tabla__hora">Comenzó</th>
                <th scope="col" className="tabla__der">
                  {cerradas ? "Duración" : "Transcurrido"}
                </th>
                {onVerEventos ? (
                  <th scope="col" className="tabla__der tabla__eventos">Eventos</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {sesiones.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="alumno">
                      <Usuario size={18} weight="duotone" aria-hidden="true" />
                      <span className="alumno__datos">
                        {/* El nombre es lo que el docente reconoce. El número
                            del aula virtual queda igual, más chico: es el
                            puente para buscarlo en el campus, y lo único que
                            hay si el nombre no llegó. */}
                        <span className="alumno__nombre">
                          {s.student_name || `Alumno ${s.moodle_user_id}`}
                        </span>
                        {/* Sólo si rindió más de una vez: con un intento no hay
                            nada que aclarar, y el número sería ruido en todas
                            las filas. */}
                        {/* La marca está o no está: sin puntajes ni colores de riesgo. El
                            texto completo va en el detalle de la sesión. */}
                        {avisoDeCaptura(s.capture) ? (
                          <span className="alumno__captura" title={avisoDeCaptura(s.capture)!.detalle}>
                            {avisoDeCaptura(s.capture)!.corto}
                          </span>
                        ) : null}
                        <span className="alumno__pie cifra">
                          {s.student_name ? `Alumno ${s.moodle_user_id}` : null}
                          {s.student_name && s.intentos > 1 ? " · " : null}
                          {s.intentos > 1 ? `intento ${s.intento} de ${s.intentos}` : null}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="tabla__der tabla__hora">
                    <span className="cifra">{hora(s.started_at)}</span>
                  </td>
                  <td className="tabla__der">
                    <Transcurrido inicio={s.started_at} cierre={s.closed_at ?? null} />
                  </td>
                  {onVerEventos ? (
                    <td className="tabla__der tabla__eventos">
                      <button
                        className="tabla__accion"
                        type="button"
                        onClick={() => onVerEventos(s)}
                        aria-label={`Ver los eventos de ${s.student_name || `Alumno ${s.moodle_user_id}`}${
                          s.intentos > 1 ? `, intento ${s.intento} de ${s.intentos}` : ""
                        }`}
                      >
                        Ver
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
