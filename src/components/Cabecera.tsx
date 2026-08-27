import { useEffect, useState } from "react";
import { SECCIONES } from "../secciones";
import "./Cabecera.css";

/**
 * Cabecera de dos filas: la institucional y la de servicio.
 *
 * Se contrae al desplazarse, y marca cuál de los destinos se está mirando.
 * Ese estado activo es lo que diferencia una barra de navegación real de un
 * puñado de enlaces: el lector sabe siempre dónde está parado.
 *
 * El acceso vive acá arriba y está disponible siempre, en vez de ser la
 * recompensa del final de la página.
 */
export function Cabecera() {
  const [contraida, setContraida] = useState(false);
  const [activo, setActivo] = useState<string | null>(null);

  useEffect(() => {
    const alDesplazar = () => setContraida(window.scrollY > 120);
    alDesplazar();
    window.addEventListener("scroll", alDesplazar, { passive: true });
    return () => window.removeEventListener("scroll", alDesplazar);
  }, []);

  useEffect(() => {
    // Si el navegador no lo soporta, la navegación sigue funcionando: lo único
    // que se pierde es el resaltado de la sección en curso.
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) {
          setActivo(visible.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );

    SECCIONES.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observador.observe(el);
    });

    return () => observador.disconnect();
  }, []);

  return (
    <header className={`cabecera ${contraida ? "cabecera--contraida" : ""}`}>
      <div className="cabecera__institucional">
        <div className="marco cabecera__fila">
          <a
            className="cabecera__casa"
            href="https://sanfrancisco.utn.edu.ar"
            target="_blank"
            rel="noreferrer"
          >
            <img
              src="/img/utn-frsf.png"
              alt="Universidad Tecnológica Nacional, Facultad Regional San Francisco"
            />
          </a>
          <span className="cabecera__carrera">Ingeniería en Sistemas de Información</span>
        </div>
      </div>

      <div className="cabecera__servicio">
        <div className="marco cabecera__fila">
          <a className="cabecera__producto" href="#inicio">
            SAMCE
          </a>
          <nav className="cabecera__nav" aria-label="Secciones de la página">
            <ul>
              {SECCIONES.map((d) => (
                <li key={d.id}>
                  <a
                    href={`#${d.id}`}
                    className={activo === d.id ? "esta-aqui" : undefined}
                    aria-current={activo === d.id ? "true" : undefined}
                  >
                    {d.texto}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <a className="boton boton--chico" href="#acceso">
            Entrar al panel
          </a>
        </div>
      </div>
    </header>
  );
}
