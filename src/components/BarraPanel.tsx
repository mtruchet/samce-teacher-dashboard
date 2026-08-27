import { SignOut, Tablero, UserCircle } from "../iconos";
import "./BarraPanel.css";

/**
 * La barra fija del panel.
 *
 * Lleva el logotipo de la facultad igual que la cabecera de la página pública:
 * el docente entra acá desde el campus, y la marca institucional es lo que dice
 * que sigue adentro del mismo lugar.
 *
 * Al lado de la marca va el atajo a todos sus cursos, y a la derecha el nombre
 * del docente, que llega en el token junto con la identidad.
 *
 * El atajo dice lo mismo se haya entrado por donde se haya entrado. Antes
 * mostraba el nombre de la materia cuando el docente venía desde un curso, y
 * ahí el encabezado repetía el título de la pantalla y encima no llevaba a
 * ninguna parte, porque ese ya era el primer escalón. Lo que cambia es cómo se
 * llega, no lo que dice: en el panel general es un salto interno, y desde un
 * curso hay que pasar de nuevo por el campus, porque ese token autoriza una
 * materia sola y quién da qué lo sabe Moodle.
 *
 * El rol no se muestra: al panel solo entra quien tiene la capacidad de
 * docente, así que decirlo no informa nada que no se sepa.
 *
 * No lleva línea inferior: se separa del contenido por el escalón de
 * superficie. Es la misma regla que sostiene la página pública.
 */

/** Adónde lleva el atajo: dentro del panel, o de vuelta al campus por un token nuevo. */
export type DestinoDeCursos = { onInicio: () => void } | { href: string };

interface Props {
  /** Nombre y apellido, como lo muestra el campus. */
  docente: string;
  /** El atajo del encabezado. Lo resuelve el panel, que sabe con qué alcance se entró. */
  cursos: DestinoDeCursos;
  onSalir: () => void;
}

export function BarraPanel({ docente, cursos, onSalir }: Props) {
  // En angosto queda sólo el ícono: el rótulo entero no entra junto al logotipo
  // y la salida, y esconder el atajo no es una opción cuando es el único camino
  // a los demás cursos. El nombre viaja igual en la etiqueta, así que quien usa
  // lector de pantalla o teclado escucha lo mismo en cualquier ancho.
  const atajo = (
    <>
      <Tablero size={15} weight="duotone" aria-hidden="true" />
      <span className="barra__pantalla-rotulo">Todos mis cursos</span>
    </>
  );

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

          {/* Sólo esto se pulsa. El nombre del proyecto queda afuera, porque no
              lleva a ningún lado. */}
          {"href" in cursos ? (
            <a className="barra__pantalla" href={cursos.href} aria-label="Todos mis cursos">
              {atajo}
            </a>
          ) : (
            <button
              className="barra__pantalla"
              type="button"
              onClick={cursos.onInicio}
              aria-label="Todos mis cursos"
            >
              {atajo}
            </button>
          )}
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
