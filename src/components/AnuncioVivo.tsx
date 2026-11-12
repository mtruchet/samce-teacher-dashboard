import { useCallback, useState } from "react";

/** Lo último que se anunció y cuántas veces se anunció algo: `n` sube en cada llamada. */
export interface Anuncio {
  texto: string;
  n: number;
}

/**
 * El estado de una región viva. `anunciar(texto)` sube `n` aunque el texto sea el mismo de antes: así
 * `AnuncioVivo` pone la frase en un nodo nuevo y el lector de pantalla la vuelve a leer. Mientras no se
 * llama, el nodo no cambia y no se anuncia nada.
 *
 * Va en el mismo archivo que el componente porque uno no sirve sin el otro.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAnuncio(): [Anuncio, (texto: string) => void] {
  const [aviso, setAviso] = useState<Anuncio>({ texto: "", n: 0 });
  const anunciar = useCallback((texto: string) => setAviso((a) => ({ texto, n: a.n + 1 })), []);
  return [aviso, anunciar];
}

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
