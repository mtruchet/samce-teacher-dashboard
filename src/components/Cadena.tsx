import { Check, Warning } from "../iconos";
import "./Cadena.css";

/**
 * La cadena, dibujada.
 *
 * La versión anterior mostraba dos huellas iguales en una tabla y no decía
 * nada: para quien no es técnico, dos códigos idénticos son dos códigos.
 *
 * Acá la idea se cuenta en dos movimientos. Primero se ve dónde queda la
 * evidencia: un eslabón entre otros, encadenado a los que vinieron antes.
 * Después se ve la comprobación, que es lo único que al docente le importa:
 * el código de aquel día y el de hoy, y si dan igual.
 *
 * La comprobación va en dos casos y no en uno. Mostrar solamente que los dos
 * códigos coinciden no prueba nada para quien no sabe qué es un código: recién
 * al ver el caso roto al lado se entiende que la coincidencia significaba algo.
 *
 * La frase del final nombra a los tres que no pueden reescribirlo, y se incluye
 * a sí misma en la lista. Es lo que convierte una promesa en una propiedad.
 */

const BLOQUES = [
  { huella: "7e02…41ab", rotulo: "", sello: "" },
  { huella: "c95d…8f30", rotulo: "", sello: "" },
  { huella: "a3f1…9c74", rotulo: "Tu examen", sello: "12/08 · 14:32" },
  { huella: "b47c…2e19", rotulo: "", sello: "" },
  { huella: "1d8a…6b55", rotulo: "", sello: "" },
];

/* Los códigos del cotejo van truncados por el medio y no por la cola: es el
   único truncado que deja comparar dos códigos de un vistazo. El del caso roto
   no comparte un solo carácter con el original en ninguna posición, que es
   justamente lo que se está afirmando. */
const INTACTO = { cabeza: "a3f1", cola: "c2d1…7c214e8b" };
const ALTERADO = { cabeza: "6b02", cola: "d417…e0359af8" };

export function Cadena() {
  return (
    <div className="cadena">
      <figure className="cadena__pieza">
        <figcaption className="cadena__titulo">
          La evidencia queda encadenada a las anteriores
        </figcaption>

        <ol className="cadena__bloques">
          {BLOQUES.map((b, i) => (
            <li
              key={b.huella}
              className={`bloque ${b.rotulo ? "bloque--propio" : ""}`}
              style={{ opacity: i === 0 || i === BLOQUES.length - 1 ? 0.4 : 1 }}
            >
              <span className="bloque__caja" aria-hidden="true">
                <span className="bloque__trama" />
                <span className="bloque__trama" />
                <span className="bloque__trama" />
              </span>
              <span className="bloque__huella cifra">{b.huella}</span>
              {b.rotulo ? (
                <>
                  <span className="bloque__rotulo">{b.rotulo}</span>
                  <span className="bloque__sello cifra">{b.sello}</span>
                </>
              ) : null}
            </li>
          ))}
        </ol>

        <p className="cadena__nota">
          Cada eslabón lleva adentro el código del anterior. Cambiar uno solo obligaría a rehacer
          todos los que siguen, en todas las copias a la vez.
        </p>
      </figure>

      <figure className="cotejo">
        <figcaption className="cotejo__titulo">Meses después, al comprobarla</figcaption>

        <div className="cotejo__casos">
          <div className="caso">
            <p className="caso__titulo">La evidencia intacta</p>
            <dl className="caso__pares">
              <div>
                <dt>aquel día</dt>
                <dd >
                  <b>{INTACTO.cabeza}</b>{INTACTO.cola}
                </dd>
              </div>
              <div>
                <dt>hoy</dt>
                <dd >
                  <b>{INTACTO.cabeza}</b>{INTACTO.cola}
                </dd>
              </div>
            </dl>
            <p className="caso__sello">
              <Check size={15} weight="bold" aria-hidden="true" />
              Dan igual
            </p>
          </div>

          <div className="caso caso--roto">
            <p className="caso__titulo">Si alguien la modificara</p>
            <dl className="caso__pares">
              <div>
                <dt>aquel día</dt>
                <dd >
                  <b>{INTACTO.cabeza}</b>{INTACTO.cola}
                </dd>
              </div>
              <div>
                <dt>hoy</dt>
                <dd className="caso__distinto cifra">
                  <b>{ALTERADO.cabeza}</b>{ALTERADO.cola}
                </dd>
              </div>
            </dl>
            <p className="caso__sello">
              <Warning size={15} weight="bold" aria-hidden="true" />
              No coinciden
            </p>
          </div>
        </div>

        <p className="cotejo__nota">
          Basta con que cambie una coma para que el código de hoy sea otro. Y una vez anotado en
          la cadena, ese registro no lo puede reescribir nadie: ni el alumno, ni vos, ni nosotros.
        </p>
      </figure>

      <p className="cadena__pie">
        Las huellas se publican en una red blockchain pública o de prueba. La comprobación se
        puede hacer de forma independiente, sin pedirnos permiso.
      </p>
    </div>
  );
}
