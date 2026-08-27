import { SignOut, Tablero, UserCircle } from "../iconos";
import "./BarraPanel.css";

/**
 * La barra fija del panel.
 *
 * Lleva el logotipo de la facultad igual que la cabecera de la página pública:
 * el docente entra acá desde el campus, y la marca institucional es lo que dice
 * que sigue adentro del mismo lugar.
 *
 * Al lado de la marca va la materia, y a la derecha el nombre del docente. Los
 * dos llegan en el token: el campus los manda junto con la identidad, así que
 * no hace falta mostrar identificadores internos.
 *
 * La materia es un botón que devuelve al principio del panel: es lo que uno
 * intenta pulsar después de meterse tres niveles adentro, y no hacer nada al
 * pulsarlo era el error.
 *
 * El rol no se muestra: al panel solo entra quien tiene la capacidad de
 * docente, así que decirlo no informa nada que no se sepa.
 *
 * No lleva línea inferior: se separa del contenido por el escalón de
 * superficie. Es la misma regla que sostiene la página pública.
 */

interface Props {
  /** Nombre y apellido, como lo muestra el campus. */
  docente: string;
  /** Nombre de la materia, o el alcance del panel si abarca varias. */
  curso: string;
  /** Vuelve al primer escalón. Es el atajo que todos buscan en el encabezado. */
  onInicio: () => void;
  onSalir: () => void;
}

export function BarraPanel({ docente, curso, onInicio, onSalir }: Props) {
  return (
    <header className="barra">
      <div className="marco marco--panel barra__interna">
        <img
          className="barra__institucion"
          src="/img/utn-frsf-blanco.png"
          alt="Universidad Tecnológica Nacional, Facultad Regional San Francisco"
        />

        <p className="barra__contexto">
          <span className="barra__marca">SAMCE</span>

          {/* Sólo esto se pulsa, y vuelve al principio: es lo primero que se
              intenta cuando uno se metió tres niveles adentro. El nombre del
              proyecto queda afuera del botón, porque no lleva a ningún lado. */}
          <button className="barra__pantalla" type="button" onClick={onInicio}>
            <Tablero size={15} weight="duotone" aria-hidden="true" />
            {curso}
          </button>
        </p>

        <div className="barra__derecha">
          <p className="barra__saludo">
            <UserCircle size={18} weight="duotone" aria-hidden="true" />
            Hola, <b>{docente}</b>
          </p>

          <button className="barra__salir" onClick={onSalir} type="button">
            <SignOut size={15} weight="bold" aria-hidden="true" />
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
