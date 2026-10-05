/**
 * Lo que se ve mientras se descarga la pantalla que pidió el visitante.
 *
 * Es el mismo dibujo que index.html deja pintado antes de que React monte, y
 * usa sus mismas clases: así el paso de uno al otro no se nota. El estilo vive
 * allá porque tiene que estar disponible en el primer cuadro; acá solo está el
 * marcado, que no se puede compartir porque uno es HTML servido y el otro React.
 *
 * No dice «cargando» en pantalla. Un cartel que casi siempre aparece y
 * desaparece en menos de medio segundo se lee como un parpadeo, no como una
 * frase, y la espera ya la comunica el pulso. Sí lo dice a los lectores de
 * pantalla: dentro del panel, que se están buscando las sesiones; en
 * cualquier otra pantalla, que se está cargando.
 */
/** Las mismas doce que la tira del panel; el recorrido lo hace el retardo de cada una. */
const MARCAS = 12;

interface Props {
  /** Dentro de una pantalla ya dibujada, en lugar de ocupar el alto completo. */
  encajado?: boolean;
}

export function Arranque({ encajado = false }: Props) {
  return (
    <div
      className={encajado ? "arranque arranque--encajado" : "arranque"}
      role="status"
      aria-live="polite"
    >
      <div className="arranque__pulso" aria-hidden="true">
        {Array.from({ length: MARCAS }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      <p className="arranque__marca">SAMCE</p>
      <span className="solo-lectores">{encajado ? "Buscando sesiones" : "Cargando"}</span>
    </div>
  );
}
