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
  const yaIntentado = useRef(false);

  useEffect(() => {
    // El token es de un solo uso: en desarrollo React monta dos veces y el
    // segundo intento fallaría contra un token ya consumido.
    if (yaIntentado.current) {
      return;
    }
    yaIntentado.current = true;

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

    verifyMoodleLaunch(token)
      .then(() => navigate("/panel", { replace: true }))
      .catch(() => setEstado("error"));
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
