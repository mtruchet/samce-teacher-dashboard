import { useEffect, useState } from "react";
import { ArrowSquareOut, SignIn } from "../iconos";
import { API_CONFIG } from "../config/api.config";
import "./SinSesion.css";

/**
 * Cuando alguien llega al panel sin sesión.
 *
 * Antes esto era un redirect instantáneo a la página pública, y el docente
 * terminaba en otra pantalla sin entender qué había pasado. Pasa seguido: el
 * enlace del panel guardado en favoritos, una pestaña vieja recuperada al
 * abrir el navegador, o volver atrás después de haber salido.
 *
 * Ahora se explica qué pasó y adónde va, y recién después se lo lleva. La
 * espera es corta pero suficiente para leer una línea, y el enlace está ahí
 * para quien no quiera esperar o tenga la redirección bloqueada.
 */

/** Lo que tarda en leerse una oración, sin llegar a impacientar. */
const SEGUNDOS = 4;

/**
 * Dos maneras de llegar acá, y no se explican igual.
 *
 * Que venza mientras el docente miraba es más grave que llegar de un favorito:
 * estaba supervisando y el panel dejó de ver, así que puede haber alumnos
 * rindiendo de los que ya no se está enterando. Eso hay que decirlo.
 */
const MOTIVOS = {
  "sin-sesion": {
    titulo: "Al panel se entra desde el aula virtual",
    texto:
      "Se entra por el enlace del curso. El panel no tiene usuario ni contraseña propios.",
  },
  vencida: {
    titulo: "Tu sesión venció",
    texto:
      "El panel dejó de recibir novedades. Volvé a entrar desde el enlace del curso para seguir viendo quién rinde.",
  },
} as const;

interface Props {
  motivo?: keyof typeof MOTIVOS;
}

export function SinSesion({ motivo = "sin-sesion" }: Props) {
  const [restan, setRestan] = useState(SEGUNDOS);
  const campus = API_CONFIG.MOODLE_URL;
  const { titulo, texto } = MOTIVOS[motivo];

  useEffect(() => {
    const reloj = window.setInterval(() => setRestan((s) => s - 1), 1000);
    const salida = window.setTimeout(() => {
      window.location.href = campus;
    }, SEGUNDOS * 1000);

    return () => {
      window.clearInterval(reloj);
      window.clearTimeout(salida);
    };
  }, [campus]);

  return (
    <main className="sin-sesion">
      <div className="sin-sesion__caja">
        <span className="sin-sesion__icono" aria-hidden="true">
          <SignIn size={28} weight="duotone" />
        </span>

        <h1 className="sin-sesion__titulo">{titulo}</h1>

        <p className="sin-sesion__texto">{texto}</p>

        {/* La cuenta se anuncia una vez, no en cada segundo: un lector de
            pantalla que repita "3, 2, 1" es peor que no decir nada. */}
        <p className="sin-sesion__aviso" role="status">
          <span aria-hidden="true">
            Te llevamos al campus en {Math.max(restan, 0)}…
          </span>
          <span className="solo-lectores">
            Vas a ser redirigido al aula virtual en unos segundos.
          </span>
        </p>

        <a className="boton boton--chico" href={campus}>
          Ir ahora al aula virtual
          <ArrowSquareOut size={15} weight="bold" aria-hidden="true" />
        </a>
      </div>
    </main>
  );
}
