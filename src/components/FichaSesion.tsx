import type { SesionNumerada } from "../services/sesionesService";
import { fechaCorta, horaCorta } from "../eventos";

import { Transcurrido } from "./Transcurrido";
import "./FichaSesion.css";

/**
 * Cómo se llama en pantalla el estado de la sesión.
 *
 * Los tres que manda el backend, cada uno con su palabra. Son las mismas que
 * usa la lista de sesiones («sin entregar», «Rindiendo ahora», «Entregó»): dos
 * pantallas del mismo dato no pueden decir cosas distintas. Van con mayúscula
 * inicial porque encabezan la ficha. Un valor que este panel todavía no conozca
 * no dice nada, porque afirmar cualquiera de los polos es peor que no mostrar
 * el rótulo.
 */
function estado(status: SesionNumerada["status"]): string {
  const nombres: Record<string, string> = {
    open: "Rindiendo ahora",
    closed: "Entregó",
    abandoned: "Sin entregar",
  };
  return nombres[status] ?? "";
}

/**
 * La ficha de la sesión: un renglón de la cabecera del detalle, debajo del nombre del alumno.
 *
 * Antes era una caja suelta arriba del análisis, y una caja más en una pantalla que ya tiene tres (el aviso, el
 * análisis y el registro) hacía que lo primero que se leyera fuera un recuadro con dos datos. Son datos del
 * intento, no un bloque de contenido: van pegados al nombre, como el subtítulo de una ficha, y el análisis
 * queda como la primera lámina de la pantalla.
 *
 * Quién es el alumno ya lo dicen el título y las migas; acá va lo que allá no entra: si entregó, qué intento es,
 * cuándo empezó y cuánto duró. El número del aula virtual no está: en la tabla de sesiones se lee porque cuelga
 * del nombre, y acá quedaba suelto. La duración no es un dato nuevo: es la misma que muestra la lista, con el
 * mismo componente. Un intento sin entregar no la lleva, por lo mismo que en la lista: su cierre es cuando Moodle
 * procesó el abandono, no cuando el alumno dejó de rendir.
 */
export function FichaSesion({ sesion }: { sesion: SesionNumerada }) {
  const rotulo = estado(sesion.status);
  const abierta = sesion.status === "open";
  return (
    <div className="detalle__sesion">
      {rotulo ? (
        <span className={abierta ? "detalle__estado detalle__estado--vivo" : "detalle__estado"}>{rotulo}</span>
      ) : null}
      {sesion.intentos > 1 ? (
        <span className="detalle__dato cifra">Intento {sesion.intento} de {sesion.intentos}</span>
      ) : null}
      {/* Con la fecha (ronda 3): con varios parciales, «Empezó a las 09:11» no decía qué día. */}
      <span className="detalle__dato">
        Empezó el{" "}
        <time className="cifra" dateTime={sesion.started_at}>
          {fechaCorta(sesion.started_at)} a las {horaCorta(sesion.started_at)}
        </time>
      </span>
      {sesion.status === "closed" && sesion.closed_at ? (
        <span className="detalle__dato">
          Duró <Transcurrido inicio={sesion.started_at} cierre={sesion.closed_at} />
        </span>
      ) : null}
    </div>
  );
}
