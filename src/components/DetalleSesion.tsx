import { avisoDeCaptura } from "../captura";
import { useEffect, useRef, useState } from "react";
import {
  EVENTOS_POR_PAGINA,
  SesionVencida,
  traerEventos,
  type Evento,
  type SesionNumerada,
} from "../services/sesionesService";
import { Usuario } from "../iconos";
import { ListaEventos } from "./ListaEventos";
import "./ListaSesiones.css";

/**
 * Lo que pasó durante el intento de un alumno.
 *
 * Trae los eventos de la sesión y, mientras la sesión sigue abierta, vuelve a
 * preguntar cada pocos segundos por lo nuevo, con el número del último que ya
 * tiene: no repite lo mostrado ni lo vuelve a descargar. Cuando la sesión se
 * cierra hace una última consulta, porque los últimos eventos llegan junto con
 * la entrega, y ahí deja de preguntar.
 *
 * Solo muestra lo que se guardó. No calcula nada: la página no tiene índice de
 * integridad, nivel de riesgo ni alertas, y no las tiene porque todavía no
 * existen, no porque falten en la pantalla.
 */

const CADENCIA = 5000;
/** Tope de páginas por consulta, para que una sesión enorme no trabe el panel. */
const PAGINAS_MAXIMAS = 20;

interface Props {
  examenId: number;
  sesion: SesionNumerada;
  /** El token dejó de valer: no se arregla reintentando, lo resuelve el panel. */
  onVencida: () => void;
}

export function DetalleSesion({ examenId, sesion, onVencida }: Props) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinConexion, setSinConexion] = useState(false);
  // El último `id` (orden de llegada) que ya se tiene. Va en una referencia y no en el estado
  // porque la consulta lo lee y lo escribe, y si estuviera en el estado, cada
  // respuesta rearmaría el efecto y volvería a consultar de inmediato.
  const ultimo = useRef(0);
  // `onVencida` también va en una referencia, y por lo mismo: quien renderiza
  // esta pantalla la redibuja cada segundo (el reloj de «actualiza en N») y le
  // pasa una función nueva cada vez. Si el efecto dependiera de ella, se
  // reiniciaría en cada redibujo: vaciaba la lista, mostraba «Cargando» y
  // volvía a pedir todo una vez por segundo, en vez de una vez cada cinco.
  const alVencer = useRef(onVencida);
  useEffect(() => {
    alVencer.current = onVencida;
  });
  const sesionId = sesion.id;
  const abierta = sesion.status === "open";

  useEffect(() => {
    let vigente = true;
    ultimo.current = 0;
    setEventos([]);
    setCargando(true);

    async function consultar() {
      try {
        const nuevos: Evento[] = [];
        for (let pagina = 0; pagina < PAGINAS_MAXIMAS; pagina++) {
          const lote = await traerEventos(examenId, sesionId, ultimo.current);
          if (!vigente) return;
          nuevos.push(...lote);
          if (lote.length > 0) ultimo.current = Math.max(ultimo.current, ...lote.map((e) => e.id));
          if (lote.length < EVENTOS_POR_PAGINA) break;
        }
        // Se muestran por `seq` (el orden en que ocurrieron) aunque lleguen por
        // orden de llegada: un evento tardío se acomoda donde corresponde.
        if (nuevos.length > 0) {
          setEventos((actuales) => [...actuales, ...nuevos].sort((a, b) => a.seq - b.seq));
        }
        setSinConexion(false);
      } catch (error) {
        if (!vigente) return;
        if (error instanceof SesionVencida) {
          alVencer.current();
          return;
        }
        // Se conserva lo último que llegó y se reintenta: seguir mostrándolo
        // como si fuera de ahora sería mentir, así que se avisa.
        setSinConexion(true);
      } finally {
        if (vigente) setCargando(false);
      }
    }

    void consultar();
    if (!abierta) return () => { vigente = false; };

    const consulta = window.setInterval(() => void consultar(), CADENCIA);
    return () => {
      vigente = false;
      window.clearInterval(consulta);
    };
  }, [examenId, sesionId, abierta]);

  return (
    <section className="lista">
      <header className="lista__encabezado">
        <h2 className="lista__titulo">Eventos de la sesión</h2>
        <span className="lista__cuenta cifra">{eventos.length}</span>
      </header>

      <p className="detalle__alumno">
        <Usuario size={16} weight="duotone" aria-hidden="true" />
        <span>
          {sesion.student_name || `Alumno ${sesion.moodle_user_id}`}
          {sesion.intentos > 1 ? ` · intento ${sesion.intento} de ${sesion.intentos}` : ""}
          {" · "}
          {abierta ? "rindiendo ahora" : "entregó"}
        </span>
      </p>

      {avisoDeCaptura(sesion.capture) ? (
        <p className="detalle__captura" role="note">
          <strong>{avisoDeCaptura(sesion.capture)!.corto}.</strong> {avisoDeCaptura(sesion.capture)!.detalle}
        </p>
      ) : null}

      <p className="detalle__nota">
        Registro autoinformado por el navegador del alumno: la firma garantiza de dónde salió, no
        que lo que dice sea verdad.
      </p>

      {sinConexion ? (
        <p className="panel__vacio" role="status">
          Sin conexión con el servidor. Se sigue intentando; lo que se ve es lo último que llegó.
        </p>
      ) : null}

      {cargando ? (
        <p className="panel__vacio" role="status">Cargando los eventos…</p>
      ) : (
        <ListaEventos
          eventos={eventos}
          vacio={
            <p className="panel__vacio">
              Todavía no hay eventos registrados para esta sesión.
              {abierta ? " Aparecen solos en cuanto el alumno empieza a responder." : ""}
            </p>
          }
        />
      )}
    </section>
  );
}
