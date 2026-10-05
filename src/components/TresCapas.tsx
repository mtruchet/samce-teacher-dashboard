import { WaveSine, Brain, Link as Cadena } from "../iconos";
import "./TresCapas.css";

/**
 * Las tres capas del sistema: lo que se observa, cómo se analiza y cómo se
 * conserva. Un inventario de eventos del navegador haría parecer chico al
 * proyecto, cuando lo que hay detrás es un motor de aprendizaje automático y
 * trazabilidad criptográfica.
 */

const CAPAS = [
  {
    Icono: WaveSine,
    n: "01",
    titulo: "Observa",
    texto:
      "Registra el ritmo de trabajo durante el examen: cuándo se escribe, cuándo se para y cuándo la ventana deja de estar adelante.",
  },
  {
    Icono: Brain,
    n: "02",
    titulo: "Analiza",
    texto:
      "Un modelo entrenado busca patrones en el comportamiento completo, no en acciones sueltas. De ahí salen las alertas.",
  },
  {
    Icono: Cadena,
    n: "03",
    titulo: "Deja constancia",
    texto:
      "Cada evidencia queda con su huella criptográfica registrada en blockchain. Si alguien discute un resultado, se puede probar que nadie tocó nada.",
  },
];

export function TresCapas() {
  return (
    <ol className="capas">
      {CAPAS.map(({ Icono, n, titulo, texto }) => (
        <li key={n} className="capa">
          <span className="capa__n cifra" aria-hidden="true">{n}</span>
          <Icono size={30} weight="duotone" className="capa__icono" aria-hidden="true" />
          <h3 className="capa__titulo">{titulo}</h3>
          <p className="capa__texto">{texto}</p>
        </li>
      ))}
    </ol>
  );
}
