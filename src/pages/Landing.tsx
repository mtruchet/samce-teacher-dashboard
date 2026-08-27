import { ArrowRight, Materia } from "../iconos";
import { Cabecera } from "../components/Cabecera";
import { Pie } from "../components/Pie";
import { SECCIONES } from "../secciones";
import { MuestraAlerta } from "../components/MuestraAlerta";
import { RitmoExamen } from "../components/RitmoExamen";
import { TresCapas } from "../components/TresCapas";
import { Cadena } from "../components/Cadena";
import { Rubro } from "../components/Rubro";
import { EntradaMoodle } from "../components/EntradaMoodle";
import "./Landing.css";

export function Landing() {
  return (
    <>
      <a className="salto" href="#inicio">Ir al contenido</a>
      <Cabecera />

      <main id="inicio">
        {/* Portada */}
        <section className="portada">
          <div className="portada__texto">
            <div className="portada__interna">
              <p className="rotulo">Machine Learning y Blockchain</p>
              <h1 className="portada__titular">
                Cuida los exámenes
                <span className="portada__contra"> sin vigilar a nadie</span>
              </h1>
              <p className="portada__bajada">
                Un modelo aprende cómo se rinde un examen y te avisa cuando algo se sale de eso.
                Sin cámara, sin micrófono y sin leer una sola respuesta.
              </p>
              <a className="boton" href="#acceso">
                Entrar al panel
                <ArrowRight size={18} weight="bold" aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="portada__foto">
            <img
              src="/img/escribiendo.jpg"
              alt="Manos escribiendo en el teclado de una computadora portátil"
            />
          </div>
        </section>

        {/* Contra lo único del rubro que el docente ya vio */}
        <section className="frase" id="diferencia">
          <div className="marco">
            <h2 className="frase__titulo">Supervisar no es vigilar.</h2>
            <Rubro />
            <p className="frase__pie">
              La comparación es con la supervisión por cámara en general, que es lo que suele
              entenderse por monitoreo de exámenes. No con ningún producto en particular.
            </p>
          </div>
        </section>

        {/* Las tres capas */}
        <section className="seccion" id="sistema">
          <div className="marco">
            <h2 className="titulo titulo--centro">Tres capas, un solo trabajo</h2>
            <TresCapas />
          </div>
        </section>

        {/* El motor de análisis */}
        <section className="seccion sup-2" id="motor">
          <div className="marco dupla">
            <div>
              <p className="rotulo">El motor de análisis</p>
              <h2 className="titulo">No cuenta clics. Entiende cómo trabajás.</h2>
              <p className="bajada">
                Las herramientas de siempre se fijan en cosas sueltas: cambiaste de pestaña, y
                listo. Acá el modelo mira el examen completo y aprende cómo es el ritmo normal de
                una persona resolviendo.
              </p>
              <p className="bajada">
                Recién cuando varias señales se juntan de una forma que se aparta de ese ritmo,
                aparece una alerta. Y viene explicada, para que sepas qué se vio y cuándo.
              </p>
            </div>
            <div>
              <RitmoExamen />
            </div>
          </div>
        </section>

        {/* La trazabilidad */}
        <section className="seccion" id="trazabilidad">
          <div className="marco dupla dupla--invertida">
            <div>
              <Cadena />
            </div>
            <div>
              <p className="rotulo">Trazabilidad</p>
              <h2 className="titulo">Si mañana alguien lo discute, se puede probar</h2>
              <p className="bajada">
                De cada evidencia se saca un código corto que cambia por completo si cambia
                cualquier cosa del original. Ese código queda anotado en una cadena de registros
                repartida en muchas copias, que nadie puede reescribir sin que se note.
              </p>
              <p className="bajada">
                Para un reclamo, para una mesa de examen o para una auditoría alcanza con volver
                a sacarle el código a la evidencia y ver si da igual. En la cadena no viaja ningún
                dato del alumno: solamente ese código.
              </p>
            </div>
          </div>
        </section>

        {/* El panel */}
        <section className="seccion sup-2" id="panel">
          <div className="marco dupla">
            <div>
              <p className="rotulo">El panel</p>
              <h2 className="titulo">Todo junto, en una sola pantalla</h2>
              <p className="bajada">
                Las sesiones que están rindiendo ahora, y las alertas con el minuto exacto en que
                pasaron.
              </p>
            </div>
            <figure className="panel-vista__pieza">
              <MuestraAlerta />
              <figcaption className="procedencia">Datos de ejemplo</figcaption>
            </figure>
          </div>
        </section>

        {/* Quién decide */}
        <section className="decision" id="decision">
          <div className="marco">
            <h2 className="decision__titulo">
              El sistema describe.<br />
              <span>Vos decidís.</span>
            </h2>
          </div>
        </section>

        {/* El alumno */}
        <section className="seccion" id="alumno">
          <div className="marco dupla dupla--invertida">
            <figure className="alumno__foto">
              <img
                src="/img/rindiendo.jpg"
                alt="Una mano escribiendo con birome sobre un cuaderno con apuntes"
              />
            </figure>
            <div>
              <p className="rotulo">Del otro lado</p>
              <h2 className="titulo">El alumno sabe, y acepta</h2>
              <p className="bajada">
                Antes de la primera pregunta ve qué se registra y qué no. Después, nada lo
                interrumpe: ni avisos, ni contadores, ni advertencias.
              </p>
              <div className="aviso">
                <p className="aviso__titulo">Este examen tiene supervisión</p>
                <p>
                  Se registra si la ventana pierde el foco, si cambiás de pestaña, si pegás texto
                  y el ritmo de escritura. No se usa cámara ni micrófono, y no se lee lo que
                  escribís.
                </p>
                <span className="aviso__boton">Entiendo y comienzo</span>
              </div>
            </div>
          </div>
        </section>

        {/* Acceso */}
        <section className="acceso" id="acceso">
          <div className="marco dupla">
            <div>
              <p className="rotulo rotulo--claro">Cómo se entra</p>
              <h2 className="acceso__titulo">Con la sesión que ya tenés abierta</h2>
              <p className="acceso__texto">
                No hay otro usuario ni otra contraseña que recordar. El panel vive adentro del
                aula virtual.
              </p>
              <ol className="pasos">
                <li>
                  <span className="pasos__numero cifra">1</span>
                  <span>Entrá al curso donde vas a tomar el examen.</span>
                </li>
                <li>
                  <span className="pasos__numero cifra">2</span>
                  <span>
                    En la barra del curso, abrí <strong>Más</strong>.
                  </span>
                </li>
                <li>
                  <span className="pasos__numero cifra">3</span>
                  <span>
                    Elegí <strong>Panel de supervisión SAMCE</strong>.
                  </span>
                </li>
              </ol>

              <p className="acceso__cierre">
                El campus confirma quién sos y el panel se abre con tus exámenes. No hay una
                segunda contraseña.
              </p>

              {/* La segunda puerta. Va después de los pasos y no como un cuarto
                  paso, porque no es el paso siguiente sino otro camino: lleva
                  al mismo panel pero con todas las materias juntas. */}
              <p className="acceso__otra">
                <Materia size={17} weight="duotone" aria-hidden="true" />
                <span>
                  Y si das más de una materia, en el menú del campus está{" "}
                  <strong>Panel SAMCE (todos mis cursos)</strong>: entra directo, sin pasar por
                  ningún curso, y muestra todas juntas.
                </span>
              </p>
            </div>
            <EntradaMoodle />
          </div>
        </section>
      </main>

      <Pie>
        <h2 className="pie__titulo">En esta página</h2>
        <ul>
          {SECCIONES.map(({ id, texto }) => (
            <li key={id}>
              <a href={`#${id}`}>{texto}</a>
            </li>
          ))}
        </ul>
      </Pie>
    </>
  );
}
