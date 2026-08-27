import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Broadcast, Examen, Materia } from "../iconos";
import { clearSession, esPanelGeneral, getStoredSession } from "../services/authService";
import {
  SesionVencida,
  traerExamenes,
  traerSesiones,
  type ExamenMonitoreado,
  type SesionDeExamen,
  type SesionNumerada,
} from "../services/sesionesService";
import { Arranque } from "../components/Arranque";
import { BarraPanel } from "../components/BarraPanel";
import { Fichas, type Ficha } from "../components/Fichas";
import { ListaSesiones } from "../components/ListaSesiones";
import { Migas, type Escalon } from "../components/Migas";
import { PulsoEnlace, type EstadoEnlace } from "../components/PulsoEnlace";
import { Pie } from "../components/Pie";
import { SinSesion } from "./SinSesion";
import { API_CONFIG } from "../config/api.config";
import "./Panel.css";

/**
 * El panel del docente.
 *
 * Muestra las sesiones que el backend registró de verdad: cuando un alumno
 * inicia el intento en el aula virtual, el complemento avisa y la sesión
 * aparece acá sola. Nada de lo que se ve está inventado.
 *
 * Se recorre por niveles —curso, examen, sesiones— en vez de volcar todo en una
 * sola tabla. Un docente con cuatro materias y dos parciales en cada una
 * tendría decenas de filas donde lo que busca se pierde; así cada pantalla
 * responde una sola pregunta, y el recuento de cada ficha dice si vale la pena
 * entrar. Cuando se entra desde un curso puntual ese escalón ya está resuelto
 * por el propio enlace, y el recorrido arranca en los exámenes.
 *
 * Falta una columna a propósito. El índice de integridad y el nivel de riesgo
 * viven en tablas que todavía no existen, y escribir «sin dato» tantas veces
 * como sesiones haya sería peor que no tener la columna: convierte el vacío en
 * ruido y enseña a ignorar justo la región donde después va a estar lo
 * importante.
 */

/** Cada cuánto se vuelve a preguntar. */
const CADENCIA = 5000;

/**
 * Numera los intentos de cada alumno dentro de un examen, por orden de
 * comienzo. El cuestionario admite reintentos, así que sin esto dos filas del
 * mismo alumno quedan idénticas y no hay manera de saber cuál es cuál.
 */
function numerarIntentos(sesiones: SesionDeExamen[]): SesionNumerada[] {
  const porAlumno = new Map<number, SesionDeExamen[]>();
  for (const s of sesiones) {
    porAlumno.set(s.moodle_user_id, [...(porAlumno.get(s.moodle_user_id) ?? []), s]);
  }

  const lugar = new Map<number, { intento: number; intentos: number }>();
  for (const suyas of porAlumno.values()) {
    [...suyas]
      .sort((a, b) => a.started_at.localeCompare(b.started_at))
      .forEach((s, i) => lugar.set(s.id, { intento: i + 1, intentos: suyas.length }));
  }

  return sesiones.map((s) => ({ ...s, ...lugar.get(s.id)! }));
}

export function Panel() {
  const navigate = useNavigate();
  // Se lee una sola vez, al entrar. `getStoredSession` parsea el JSON guardado
  // y devuelve un objeto nuevo cada vez que se la llama, así que leerla en cada
  // render encadenaba una cascada: identidad nueva, `nombreDeCurso` nueva,
  // `consultar` nueva, el efecto que la usa se rearma y vuelve a consultar. El
  // panel terminaba pidiéndole al backend sin parar en vez de cada cinco
  // segundos. Mientras el panel está abierto la sesión no cambia: si cambiara,
  // sería porque se salió, y entonces esta pantalla ya no está.
  const [sesion] = useState(getStoredSession);

  // En qué nivel está parado vive en la dirección y no en un estado interno:
  // así el botón de volver del navegador funciona, y recargar en medio de un
  // examen devuelve a la misma pantalla en vez de al principio.
  const [parametros, setParametros] = useSearchParams();
  const cursoElegido = parametros.get("curso");
  const examenElegido = parametros.get("examen");

  const [examenes, setExamenes] = useState<ExamenMonitoreado[]>([]);
  const [sesiones, setSesiones] = useState<SesionDeExamen[]>([]);
  const [enlace, setEnlace] = useState<EstadoEnlace>("vivo");
  const [desde, setDesde] = useState(0);
  const [marca, setMarca] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [vencida, setVencida] = useState(false);

  const general = sesion ? esPanelGeneral(sesion) : false;

  // El nombre del curso lo trae el token; el backend manda su identificador con
  // cada examen. Se resuelve acá y no en el servidor porque el campus ya lo dijo
  // al entrar, y volver a pedirlo sería guardar en SAMCE algo que es de Moodle.
  const nombreDeCurso = useCallback(
    (moodleCourseID: number) => {
      const propio = sesion?.courses?.find((c) => c.id === moodleCourseID);
      return propio?.name ?? sesion?.courseName ?? "";
    },
    [sesion?.courses, sesion?.courseName]
  );

  const consultar = useCallback(async () => {
    try {
      const lista = await traerExamenes();
      const porExamen = await Promise.all(
        lista.map(async (e) =>
          (await traerSesiones(e.id)).map((s) => ({
            ...s,
            examenId: e.id,
            cursoId: e.moodle_course_id,
            examen: e.name,
            curso: nombreDeCurso(e.moodle_course_id),
          }))
        )
      );
      setExamenes(lista);
      setSesiones(porExamen.flat());
      setEnlace("vivo");
      setMarca((m) => m + 1);
      setDesde(0);
    } catch (error) {
      // Que el token haya vencido no es un problema de red, y tratarlo como
      // tal es lo peor que puede hacer el panel: se queda mostrando «sin
      // conexión, reintentando» encima de una lista que ya no se actualiza,
      // mientras puede haber alumnos rindiendo de los que no se entera.
      if (error instanceof SesionVencida) {
        clearSession();
        setVencida(true);
        return;
      }

      // Cualquier otro fallo sí se reintenta, y se conserva lo último que
      // llegó. Seguir mostrándolo como si fuera de ahora sería mentir, así que
      // el estado del canal lo dice.
      setEnlace("sin-conexion");
    } finally {
      setCargando(false);
    }
  }, [nombreDeCurso]);

  useEffect(() => {
    if (vencida) return;

    void consultar();
    const consulta = window.setInterval(() => void consultar(), CADENCIA);
    const reloj = window.setInterval(() => setDesde((s) => s + 1), 1000);
    return () => {
      window.clearInterval(consulta);
      window.clearInterval(reloj);
    };
  }, [consultar, vencida]);

  const irA = useCallback(
    (destino: { curso?: string; examen?: string }) => {
      const siguiente = new URLSearchParams();
      if (destino.curso) siguiente.set("curso", destino.curso);
      if (destino.examen) siguiente.set("examen", destino.examen);
      setParametros(siguiente);
    },
    [setParametros]
  );

  function salir() {
    clearSession();
    navigate("/", { replace: true });
  }

  /** Cuántas sesiones hay, abiertas y cerradas, en un subconjunto. */
  function contar(deLas: SesionDeExamen[]) {
    return {
      enCurso: deLas.filter((s) => s.status === "open").length,
      finalizadas: deLas.filter((s) => s.status === "closed").length,
    };
  }

  // Salen del token y no de los exámenes: así aparecen también los cursos donde
  // todavía nadie rindió, que son la mayoría fuera de la época de parciales.
  const fichasDeCursos: Ficha[] = useMemo(
    () =>
      (sesion?.courses ?? []).map((c) => ({
        clave: String(c.id),
        nombre: c.name,
        ...contar(sesiones.filter((s) => s.cursoId === c.id)),
      })),
    [sesion?.courses, sesiones]
  );

  // La dirección se puede escribir a mano, quedar en un favorito o venir de
  // antes de cambiar de modo. Se valida contra lo que el docente tiene de
  // verdad, y si no cierra, se lo devuelve al nivel de arriba en vez de dejarlo
  // en una pantalla vacía sin manera de volver.
  //
  // Sólo se valida con el canal vivo: si el backend no contestó, la lista de
  // exámenes está vacía por el corte y no porque el examen no exista, y sacar
  // al docente de lo que está mirando en medio de un examen sería peor que
  // esperar a que vuelva la conexión.
  const datosAlDia = enlace === "vivo";
  const cursoDelToken = general
    ? sesion?.courses?.find((c) => String(c.id) === cursoElegido)
    : undefined;
  const cursoValido = general ? (datosAlDia ? Boolean(cursoDelToken) : Boolean(cursoElegido)) : true;

  const cursoActual = general ? Number(cursoElegido) : (sesion?.courseId ?? 0);
  const nombreCursoActual = general ? (cursoDelToken?.name ?? "") : (sesion?.courseName ?? "");

  const fichasDeExamenes: Ficha[] = useMemo(
    () =>
      examenes
        .filter((e) => e.moodle_course_id === cursoActual)
        .map((e) => ({
          clave: String(e.id),
          nombre: e.name,
          ...contar(sesiones.filter((s) => s.examenId === e.id)),
        })),
    [examenes, sesiones, cursoActual]
  );

  const delExamen = numerarIntentos(sesiones.filter((s) => String(s.examenId) === examenElegido));
  const examenDelCurso = examenes.find(
    (e) => String(e.id) === examenElegido && e.moodle_course_id === cursoActual
  );
  const nombreExamenActual = examenDelCurso?.name ?? "";
  const examenValido = datosAlDia ? Boolean(examenDelCurso) : Boolean(examenElegido);

  // Qué pantalla toca. El escalón de cursos sólo existe en el panel general: si
  // se entró desde un curso, el propio enlace ya lo eligió.
  const nivel =
    general && !cursoValido ? "cursos" : examenValido ? "sesiones" : "examenes";

  const escalones: Escalon[] = [];
  if (general) {
    escalones.push({
      nombre: "Todos mis cursos",
      volver: nivel === "cursos" ? undefined : () => irA({}),
    });
  }
  if (nivel !== "cursos" && nombreCursoActual) {
    escalones.push({
      nombre: nombreCursoActual,
      volver: nivel === "sesiones" ? () => irA({ curso: cursoElegido ?? undefined }) : undefined,
    });
  }
  if (nivel === "sesiones" && nombreExamenActual) {
    escalones.push({ nombre: nombreExamenActual });
  }

  const titulo =
    nivel === "cursos"
      ? "Todos mis cursos"
      : nivel === "examenes"
        ? nombreCursoActual
        : nombreExamenActual;

  // Sin sesión no hay nada que supervisar: se explica y se lo devuelve al
  // campus, igual que a quien llega de un favorito viejo.
  if (vencida) return <SinSesion motivo="vencida" />;

  const enCurso = delExamen.filter((s) => s.status === "open");
  const finalizadas = delExamen.filter((s) => s.status === "closed");

  // La pantalla de escucha es para cuando no hay absolutamente nada que
  // recorrer. Con fichas para elegir, aunque estén en cero, el docente tiene
  // algo que hacer y hay que dejarlo hacerlo.
  const nadaQueMostrar =
    nivel === "cursos" ? fichasDeCursos.length === 0 : nivel === "examenes" && fichasDeExamenes.length === 0;

  return (
    <>
      <a className="salto" href="#sesiones">Ir al contenido</a>

      <BarraPanel
        docente={sesion?.displayName || (sesion?.username ?? "")}
        curso={general ? "Todos mis cursos" : (sesion?.courseName ?? "")}
        onInicio={() => irA({})}
        onSalir={salir}
      />

      <main className="marco marco--panel panel" id="sesiones">
        {cargando ? (
          // El mismo pulso que ya estaba girando antes de que React montara. Un
          // dibujo nuevo acá se leería como que algo terminó y algo distinto
          // empezó, cuando en realidad es la misma espera.
          <Arranque encajado />
        ) : (
          <>
            <div className="panel__cabecera">
              <Migas escalones={escalones} />

              <div className="panel__encabezado">
                <div>
                  <h1 className="panel__curso">{titulo}</h1>
                  {general || nivel !== "examenes" ? null : (
                    // Es un enlace al campus y no un botón que llame a la API:
                    // el docente ya tiene su sesión de Moodle abierta, así que
                    // el salto es instantáneo y vuelve con un token que
                    // autoriza todos sus cursos.
                    <a
                      className="panel__cambio"
                      href={`${API_CONFIG.MOODLE_URL}${API_CONFIG.MOODLE_LAUNCH_GENERAL}`}
                    >
                      Ver todos mis cursos
                      <ArrowRight size={13} weight="bold" aria-hidden="true" />
                    </a>
                  )}
                </div>
                <PulsoEnlace estado={enlace} desde={desde} marca={marca} />
              </div>
            </div>

            {nadaQueMostrar ? (
              <section className="espera">
                <div className="espera__senal" aria-hidden="true">
                  <span className="espera__onda" />
                  <span className="espera__onda" />
                  <Broadcast size={30} weight="duotone" />
                </div>

                <div className="espera__texto">
                  {/* El título de la pantalla ya lo pone la cabecera, así que
                      acá va un segundo nivel: dos h1 en la misma página dejan
                      sin saber cuál es el asunto. */}
                  <h2 className="espera__titulo">Escuchando el aula virtual</h2>
                  <p className="espera__bajada">
                    Todavía no hay ningún examen en curso. En cuanto un alumno inicie el intento,
                    la sesión queda registrada sola: no hay que activar nada por examen ni por
                    alumno, y el alumno rinde exactamente igual que siempre.
                  </p>
                </div>
              </section>
            ) : nivel === "cursos" ? (
              <Fichas
                fichas={fichasDeCursos}
                icono={Materia}
                rotulo="Tus cursos"
                onElegir={(curso) => irA({ curso })}
                vacio={null}
              />
            ) : nivel === "examenes" ? (
              <Fichas
                fichas={fichasDeExamenes}
                icono={Examen}
                rotulo="Exámenes del curso"
                onElegir={(examen) => irA({ curso: cursoElegido ?? undefined, examen })}
                vacio={null}
              />
            ) : (
              <>
                <ListaSesiones
                  titulo="En curso"
                  sesiones={enCurso}
                  vacio={<p className="panel__vacio">No hay sesiones de examen vigentes.</p>}
                />

                {finalizadas.length > 0 ? (
                  <ListaSesiones
                    titulo="Finalizadas"
                    sesiones={finalizadas}
                    cerradas
                  />
                ) : null}
              </>
            )}
          </>
        )}
      </main>

      <Pie ancho="panel">
        <h2 className="pie__titulo">Cómo funciona</h2>
        <ul>
          <li className="pie__rol">
            <span className="pie__cargo">Se registra solo</span>
            El aula virtual avisa en cuanto un alumno abre el examen
          </li>
          <li className="pie__rol">
            <span className="pie__cargo">Sin preparar nada</span>
            No hay que activarlo por examen ni por alumno
          </li>
          <li className="pie__rol">
            <span className="pie__cargo">Sin molestar a nadie</span>
            El alumno rinde como siempre, sin instalar ni permitir nada
          </li>
        </ul>
      </Pie>
    </>
  );
}
