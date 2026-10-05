import { useEffect, useState } from "react";
import { CADENCIA_MS } from "../services/sesionesService";
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
 *
 * La tira avanza una marca con cada respuesta que llega. Es el único uso de
 * celeste en toda la pantalla cuando no hay nada que atender, y es legítimo:
 * el celeste marca acción y estado activo, y el enlace vivo es un estado
 * activo.
 *
 * La cuenta vive acá y no en el panel: si la llevara el panel, toda la
 * pantalla se volvería a dibujar una vez por segundo. Cada respuesta monta de
 * nuevo solo el texto (`key={marca}`), así la cuenta arranca de cero y la tira
 * conserva sus nodos y su transición.
 */

/**
 * `quieto` es el registro de un intento que terminó hace rato: la pantalla ya
 * no lo pide, y decir «se actualiza en N s» encima sería prometer algo que no
 * pasa.
 */
export type EstadoEnlace = "vivo" | "sin-conexion" | "quieto";

const MARCAS = 12;

const CICLO = CADENCIA_MS / 1000;

const TEXTO: Record<EstadoEnlace, (s: number) => string> = {
  vivo: (s) => `En vivo, se actualiza en ${Math.max(1, CICLO - s)} s`,
  "sin-conexion": () => "No se pudo actualizar esta pantalla. Reintentando.",
  quieto: () => "Intento terminado, el registro ya no se actualiza",
};

interface Props {
  estado: EstadoEnlace;
  /** Cuántas respuestas llegaron: decide cuál de las doce marcas está encendida. */
  marca: number;
}

export function PulsoEnlace({ estado, marca }: Props) {
  return (
    <p className={`enlace enlace--${estado}`}>
      <span className="enlace__tira" aria-hidden="true">
        {Array.from({ length: MARCAS }, (_, i) => (
          <span key={i} className={i === marca % MARCAS ? "enlace__marca enlace__marca--viva" : "enlace__marca"} />
        ))}
      </span>
      <Cuenta key={marca} estado={estado} />
    </p>
  );
}

/** El texto, con los segundos desde que se montó: desde la última respuesta. */
function Cuenta({ estado }: { estado: EstadoEnlace }) {
  const [desde, setDesde] = useState(0);
  useEffect(() => {
    const reloj = window.setInterval(() => setDesde((s) => s + 1), 1000);
    return () => window.clearInterval(reloj);
  }, []);

  return (
    <span className={estado === "sin-conexion" ? "enlace__texto enlace__texto--alerta" : "enlace__texto"}>
      {TEXTO[estado](desde)}
    </span>
  );
}
