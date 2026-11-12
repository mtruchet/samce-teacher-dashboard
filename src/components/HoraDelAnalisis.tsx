import { horaCorta } from "../eventos";

interface Props {
  /** Cuándo se calculó el análisis (ISO). */
  iso: string;
  className: string;
  /** Un renglón propio dentro de un bloque (`p`) o dentro de una pastilla (`span`). */
  como?: "p" | "span";
}

/**
 * «Análisis de las HH:MM», el renglón de la hora de un análisis en la escalera de «Cómo cambió el riesgo» y en
 * el historial. Un solo componente para que la forma no se separe: va siempre en su propio renglón, arriba
 * del rótulo del nivel, y nunca pegada al medidor con dos puntos.
 */
export function HoraDelAnalisis({ iso, className, como: Etiqueta = "p" }: Props) {
  return (
    <Etiqueta className={className}>
      Análisis de las <time className="cifra" dateTime={iso}>{horaCorta(iso)}</time>
    </Etiqueta>
  );
}
