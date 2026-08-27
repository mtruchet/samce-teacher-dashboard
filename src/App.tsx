import { lazy, Suspense, type ReactElement } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Arranque } from "./components/Arranque";
import { getStoredSession } from "./services/authService";

/**
 * Cada pantalla se descarga cuando alguien la pide, y no antes.
 *
 * Sin esto, entrar al panel traía además la portada entera con sus gráficos: el
 * docente que lo abre en el medio de un examen esperaba por dibujos que no va a
 * mirar. Son cuatro pantallas que casi nunca se visitan en la misma sesión, así
 * que separarlas no le cuesta nada a nadie.
 */
const Landing = lazy(() => import("./pages/Landing").then((m) => ({ default: m.Landing })));
const AuthCallback = lazy(() => import("./pages/AuthCallback").then((m) => ({ default: m.AuthCallback })));
const Panel = lazy(() => import("./pages/Panel").then((m) => ({ default: m.Panel })));
const SinSesion = lazy(() => import("./pages/SinSesion").then((m) => ({ default: m.SinSesion })));

/**
 * Impide llegar al área privada sin sesión. Es el mecanismo que van a
 * reutilizar todas las pantallas de supervisión que se sumen más adelante.
 *
 * Sin sesión no redirige de una: muestra una pantalla que explica qué pasó y
 * adónde va. Llegar acá sin sesión es más común de lo que parece —un favorito,
 * una pestaña vieja, volver atrás después de salir— y un salto instantáneo a
 * otra página deja al docente sin entender nada.
 */
function RutaProtegida({ children }: { children: ReactElement }) {
  return getStoredSession() ? children : <SinSesion />;
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Arranque />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/panel"
            element={
              <RutaProtegida>
                <Panel />
              </RutaProtegida>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
