import type { CifraLegible } from "../lenguajeAlerta";
import "./Comparacion.css";

/**
 * Una de las cifras que «más pesaron» en una alerta: lo de esta sesión al lado de lo de una sesión
 * habitual, cada uno con su valor escrito y una barra fina.
 *
 * Las dos barras de una cifra comparten escala (el máximo es el mayor de los dos valores), y cada
 * cifra tiene la suya: no hay un eje común entre cifras, para que el conjunto no se lea como un
 * perfil del alumno. Las barras son un apoyo para el ojo y van ocultas para los lectores de
 * pantalla; lo que manda es el valor escrito, que está siempre.
 *
 * Sin barras si algún valor no se pudo leer como número (no habría con qué comparar) o si los dos
 * son cero (no hay nada que dibujar).
 */

function ancho(valor: number, maximo: number): string {
  if (valor <= 0) return "0%";
  // Un valor chico pero distinto de cero se tiene que ver: al menos un trazo.
  return `max(3px, ${((valor / maximo) * 100).toFixed(1)}%)`;
}

export function Comparacion({ cifra }: { cifra: CifraLegible }) {
  const { observado, esperado } = cifra;
  const maximo =
    observado.numero !== null && esperado.numero !== null ? Math.max(observado.numero, esperado.numero) : 0;
  const conBarras = maximo > 0;

  const fila = (rotulo: string, valor: typeof observado, clase: string) => (
    <div className={`comparacion__fila ${clase}`}>
      <dt className="comparacion__rotulo">{rotulo}</dt>
      <dd className="comparacion__valor cifra">{valor.texto}</dd>
      {conBarras ? (
        <dd className="comparacion__pista" aria-hidden="true">
          <span className="comparacion__barra" style={{ width: ancho(valor.numero ?? 0, maximo) }} />
        </dd>
      ) : null}
    </div>
  );

  return (
    <li className="comparacion">
      <p className="comparacion__nombre">{cifra.nombre}</p>
      <dl className={conBarras ? "comparacion__filas" : "comparacion__filas comparacion__filas--sin-barras"}>
        {fila("Esta sesión", observado, "comparacion__fila--sesion")}
        {fila("Una sesión habitual", esperado, "comparacion__fila--habitual")}
      </dl>
    </li>
  );
}
