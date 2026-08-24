import { useEffect, useState } from "react";
import { fetchPing, type PingResponse } from "./services/pingService";
import { verifyMoodleLaunch, getStoredSession, type SessionInfo } from "./services/authService";

function App() {
  const [ping, setPing] = useState<PingResponse | null>(null);
  const [pingError, setPingError] = useState<string | null>(null);

  const [session, setSession] = useState<SessionInfo | null>(() => getStoredSession());
  const [authError, setAuthError] = useState<string | null>(null);
  const [verifyingLaunch, setVerifyingLaunch] = useState(false);

  useEffect(() => {
    fetchPing()
      .then(setPing)
      .catch((err: Error) => setPingError(err.message));
  }, []);

  useEffect(() => {
    if (window.location.pathname !== "/auth/callback") {
      return;
    }

    const launchToken = new URLSearchParams(window.location.search).get("token");
    if (!launchToken) {
      setAuthError("Falta el token de lanzamiento en la URL.");
      return;
    }

    setVerifyingLaunch(true);
    verifyMoodleLaunch(launchToken)
      .then((newSession) => {
        setSession(newSession);
        window.history.replaceState({}, "", "/");
      })
      .catch((err: Error) => setAuthError(err.message))
      .finally(() => setVerifyingLaunch(false));
  }, []);

  return (
    <main>
      <h1>SAMCE — Panel Docente</h1>
      <p>Scaffold inicial (Sprint 1). Conectividad con el backend:</p>
      {pingError && <p>Error al conectar con el backend: {pingError}</p>}
      {!pingError && !ping && <p>Consultando /ping...</p>}
      {ping && (
        <ul>
          <li>API: {ping.status}</li>
          <li>Base de datos: {ping.database}</li>
        </ul>
      )}

      <hr />

      <h2>Sesión</h2>
      {verifyingLaunch && <p>Validando lanzamiento desde Moodle...</p>}
      {authError && <p>Error de autenticación: {authError}</p>}
      {!verifyingLaunch && !session && !authError && (
        <p>Accedé desde el Campus Virtual (link "Panel de supervisión SAMCE" dentro del curso).</p>
      )}
      {session && !authError && (
        <p>
          Sesión activa: {session.username} ({session.role}), curso {session.courseId}
        </p>
      )}
    </main>
  );
}

export default App;
