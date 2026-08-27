import "./PulsoEnlace.css";

/**
 * La prueba de vida del canal.
 *
 * «No hay alertas» y «se cayó el monitoreo» se ven exactamente igual en una
 * pantalla quieta. La única forma de distinguirlos es una prueba de vida
 * positiva y continua, y por eso esta pieza no se calla nunca.
 *
 * Cuenta hacia atrás en vez de decir cuánto hace que llegó la última señal.
 * Las dos cosas prueban lo mismo, pero la cuenta regresiva además anticipa:
 * el docente sabe cuánto falta para el próximo dato en lugar de calcularlo.
 * Y al llegar a cero vuelve a empezar, que es lo que hace evidente que el
 * ciclo sigue corriendo.
 *
 * La tira avanza una marca cada cinco segundos, pase lo que pase. Es el único
 * uso de celeste en toda la pantalla cuando no hay nada que atender, y es
 * legítimo: el celeste marca acción y estado activo, y el enlace vivo es un
 * estado activo.
 */

export type EstadoEnlace = "vivo" | "pausado" | "demorado" | "sin-conexion";

const MARCAS = 12;

/** Lo mismo que tarda el panel en volver a preguntar. */
const CICLO = 5;

const TEXTO: Record<EstadoEnlace, (s: number) => string> = {
  vivo: (s) => `En vivo · actualiza en ${Math.max(1, CICLO - s)}`,
  pausado: () => "Pausado mientras mirás la lista",
  demorado: (s) => `Demorado. Última señal hace ${s} s`,
  "sin-conexion": () => "Sin conexión. Reintentando.",
};

interface Props {
  estado: EstadoEnlace;
  /** Segundos desde la última señal recibida. */
  desde: number;
  /** Cuál de las doce marcas está encendida. */
  marca?: number;
}

export function PulsoEnlace({ estado, desde, marca = 0 }: Props) {
  const alerta = estado === "demorado" || estado === "sin-conexion";

  return (
    <p className={`enlace enlace--${estado}`}>
      <span className="enlace__tira" aria-hidden="true">
        {Array.from({ length: MARCAS }, (_, i) => (
          <span key={i} className={i === marca % MARCAS ? "enlace__marca enlace__marca--viva" : "enlace__marca"} />
        ))}
      </span>
      <span className={alerta ? "enlace__texto enlace__texto--alerta" : "enlace__texto"}>
        {TEXTO[estado](desde)}
      </span>
    </p>
  );
}
