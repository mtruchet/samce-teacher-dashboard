import { ordenarExplicacion } from "../explicacion";
import { Info } from "../iconos";

/** Una nota dentro de una explicación o de un apartado: el ícono de información y el texto tal cual. */
export function Nota({ texto }: { texto: string }) {
  return (
    <p className="analisis__nota">
      <Info size={16} aria-hidden="true" />
      <span>{texto}</span>
    </p>
  );
}

interface Props {
  texto: string;
  /**
   * «tarjeta»: la alerta vigente, en su tarjeta. «historial»: una entrada del historial, un paso de letra más
   * chica y con la misma estructura, para que se reconozca como la misma clase de texto.
   */
  variante: "tarjeta" | "historial";
}

/**
 * La explicación que escribe el motor, ordenada por renglones y sin cambiarle una palabra (`explicacion.ts`): el
 * hecho en negrita, las notas con el ícono de información, el rótulo de la lista («Lo que más se notó») y las
 * viñetas con su punto. Es la única forma de mostrar una explicación del motor en el panel: la tarjeta y el
 * historial la comparten.
 *
 * Un rótulo de lista sin viñetas debajo no abre nada: se muestra como nota, sin perderse.
 */
export function ExplicacionDelMotor({ texto, variante }: Props) {
  const e = ordenarExplicacion(texto);
  const sinLista = e.encabezadoDeLista !== null && e.viñetas.length === 0;
  const notasAntes = sinLista ? [...e.notasAntes, `${e.encabezadoDeLista}:`] : e.notasAntes;
  return (
    <div className={`explicacion explicacion--${variante}`}>
      <p className="analisis__hecho">{e.hecho}</p>
      {notasAntes.map((renglon) => <Nota key={renglon} texto={renglon} />)}

      {e.viñetas.length > 0 ? (
        <div className="analisis__atencion">
          {/* El rótulo de la lista es un subtítulo interno, no un apartado: va como texto y no como título. Un h3
              lo ponía al mismo nivel que «Cómo cambió el riesgo», y un h4 quedaba debajo del h2 del análisis,
              salteando un nivel. Diez entradas del historial tampoco tienen que llenar de títulos la navegación. */}
          {e.encabezadoDeLista ? <p className="analisis__subtitulo">{e.encabezadoDeLista}</p> : null}
          <ul className="analisis__lista">
            {e.viñetas.map((v) => <li key={v}>{v}</li>)}
          </ul>
        </div>
      ) : null}

      {e.notas.map((renglon) => <Nota key={renglon} texto={renglon} />)}
    </div>
  );
}
