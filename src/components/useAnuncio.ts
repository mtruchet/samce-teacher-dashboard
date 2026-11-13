import { useCallback, useState } from "react";

/** Lo último que se anunció y cuántas veces se anunció algo: `n` sube en cada llamada a `anunciar`. */
export interface Anuncio {
  texto: string;
  n: number;
}

/**
 * El estado de una región viva (`AnuncioVivo`). `anunciar(texto)` sube `n` aunque el texto sea el mismo de
 * antes: así `AnuncioVivo` pone la frase en un nodo nuevo y el lector de pantalla la vuelve a leer. Mientras no
 * se llama, el nodo no cambia y no se anuncia nada.
 *
 * `silenciar()` vacía la frase sin subir `n`: no se anuncia nada, pero quien recorre la página con el lector ya
 * no encuentra una cifra vieja que dejó de ser cierta.
 */
export function useAnuncio(): [Anuncio, (texto: string) => void, () => void] {
  const [aviso, setAviso] = useState<Anuncio>({ texto: "", n: 0 });
  const anunciar = useCallback((texto: string) => setAviso((a) => ({ texto, n: a.n + 1 })), []);
  const silenciar = useCallback(() => setAviso((a) => (a.texto === "" ? a : { texto: "", n: a.n })), []);
  return [aviso, anunciar, silenciar];
}
