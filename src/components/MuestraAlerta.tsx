import "./MuestraAlerta.css";

/**
 * Recorte de una alerta tal como se ve en el panel.
 *
 * El rubro esconde su interfaz porque mostrarla sería mostrar a alguien
 * filmado. Acá no hay ese problema, así que la interfaz se muestra: es la
 * prueba más directa de que el sistema trabaja sobre señales y no sobre
 * personas.
 *
 * Los datos son verosímiles y del contexto real, con cifras que no son
 * redondas: los números redondos delatan el relleno.
 *
 * Nada acá nombra un evento del navegador. El docente lee lo que pasó, no
 * cómo se llama el evento que lo registró.
 */
export function MuestraAlerta() {
  return (
    <figure className="alerta">
      <div className="alerta__barra">
        <span className="alerta__contexto">
          Primer Parcial · Sistemas de Información II
        </span>
        <span className="alerta__vivo cifra">
          <span className="alerta__pulso" aria-hidden="true" />
          en curso
        </span>
      </div>

      <div className="alerta__cuerpo">
        <div className="alerta__encabezado">
          <span className="alerta__alumno">Ferreyra, Tomás</span>
          <span className="alerta__momento cifra">min 34 a 37</span>
        </div>

        <p className="alerta__explicacion">
          Apareció un bloque de 612 caracteres desde el portapapeles, sin escritura previa
          proporcional en esa respuesta. La ventana había estado fuera de foco durante los
          38 segundos anteriores.
        </p>

        <ul className="alerta__evidencia">
          <li>
            <span>Estuvo fuera del examen</span>
            <span className="alerta__dato cifra">38 segundos</span>
          </li>
          <li>
            <span>Pegó texto desde otro lado</span>
            <span className="alerta__dato cifra">612 caracteres</span>
          </li>
          <li>
            <span>No había escrito antes en esa respuesta</span>
            <span className="alerta__dato cifra">minuto 34</span>
          </li>
        </ul>

        <p className="alerta__contexto-nota">
          Otras dos respuestas del mismo intento muestran escritura sostenida sin señales.
        </p>
      </div>
    </figure>
  );
}
