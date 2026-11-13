import type { Anuncio } from "./useAnuncio";

/**
 * Una región viva que no se ve y contiene solo la frase del anuncio. `role="status"` lleva `aria-atomic`
 * verdadero de forma implícita; acá se declara en falso, y como la región no tiene nada más que la frase,
 * el lector dice solo eso y no relee lo que la rodea. La etiqueta la distingue de otras regiones de la
 * misma pantalla.
 */
export function AnuncioVivo({ aviso, etiqueta }: { aviso: Anuncio; etiqueta?: string }) {
  return (
    <p className="solo-lectores" role="status" aria-live="polite" aria-atomic="false" aria-label={etiqueta}>
      <span key={aviso.n}>{aviso.texto}</span>
    </p>
  );
}
