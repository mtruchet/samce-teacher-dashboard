import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CircleNotch, WarningCircle, ArrowLeft } from "../iconos";
import { verifyMoodleLaunch } from "../services/authService";
import "./AuthCallback.css";

type Estado = "validando" | "error";

/**
 * Pantalla de traspaso desde Moodle.
 *
 * El complemento local_samce firma un token de vida muy corta (60 segundos) y
 * redirige acá con él en la URL. Este componente lo canjea por la sesión del
 * panel y borra la dirección apenas lo lee, para que no quede en la barra del
 * navegador ni en una captura de pantalla.
 *
 * El estado de error importa más de lo que parece: es lo que ve un docente al
 * recargar la página, porque el token ya fue usado. La diferencia entre que
 * entienda qué hacer o que crea que el sistema se rompió está en ese texto.
 */
export function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>("validando");
  // El canje, no un «ya intenté». El token es de un solo uso, así que el pedido
  // tiene que salir una sola vez aunque el efecto corra dos veces; pero el
  // resultado hay que volver a escucharlo en cada pasada. Con un booleano, en
  // desarrollo —donde React hace setup, cleanup y setup— la segunda pasada
  // cortaba antes de enganchar nada y el cleanup de la primera ya había anulado
  // su propio aviso: la promesa resolvía sin que nadie la escuchara y la
  // pantalla quedaba clavada en «Verificando el acceso», tanto si el canje salía
  // bien como si el servidor lo rechazaba.
  const canje = useRef<Promise<unknown> | null>(null);

  useEffect(() => {
    // Si el docente navega lejos de esta pantalla mientras la verificación sigue
    // en vuelo (por ejemplo, con el botón Atrás), esta promesa no tiene que
    // empujarlo de vuelta al panel ni tocar el estado de un componente que ya no
    // está montado.
    let vigente = true;

    if (!canje.current) {
      const token = params.get("token");

      // Se saca de la barra apenas se lee, antes de cualquier espera. Si se
      // esperara al resultado, el token quedaría a la vista durante toda la
      // validación, y para siempre si falla: que es justo cuando el docente
      // saca una captura para pedir ayuda.
      window.history.replaceState({}, "", window.location.pathname);

      if (!token) {
        setEstado("error");
        return;
      }

      canje.current = verifyMoodleLaunch(token);
    }

    canje.current
      .then(() => {
        if (vigente) navigate("/panel", { replace: true });
      })
      .catch(() => {
        if (vigente) setEstado("error");
      });

    return () => {
      vigente = false;
    };
  }, [params, navigate]);

  if (estado === "validando") {
    return (
      <main className="traspaso">
        <div className="traspaso__caja" role="status">
          <CircleNotch size={30} className="traspaso__girando" aria-hidden="true" />
          <p className="traspaso__titulo">Verificando el acceso</p>
          <p className="traspaso__texto">Un momento, estamos confirmando tu ingreso.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="traspaso">
      <div className="traspaso__caja">
        <WarningCircle size={30} weight="duotone" className="traspaso__icono-error" aria-hidden="true" />
        <h1 className="traspaso__titulo">No pudimos validar el acceso</h1>
        <p className="traspaso__texto">
          El enlace de ingreso vence a los pocos segundos y solo puede usarse una vez, así que
          esto es lo esperable si recargaste la página o volviste atrás.
        </p>
        <p className="traspaso__texto">
          Volvé al Campus Virtual y entrá de nuevo desde{" "}
          <strong>Panel de supervisión SAMCE</strong>, dentro del curso.
        </p>
        <a className="traspaso__volver" href="/">
          <ArrowLeft size={16} weight="bold" aria-hidden="true" />
          Ir al inicio
        </a>
      </div>
    </main>
  );
}
