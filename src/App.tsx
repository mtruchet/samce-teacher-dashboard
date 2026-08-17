import { useEffect, useState } from "react";
import { fetchPing, type PingResponse } from "./services/pingService";

function App() {
  const [ping, setPing] = useState<PingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPing()
      .then(setPing)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main>
      <h1>SAMCE — Panel Docente</h1>
      <p>Scaffold inicial (Sprint 1). Conectividad con el backend:</p>
      {error && <p>Error al conectar con el backend: {error}</p>}
      {!error && !ping && <p>Consultando /ping...</p>}
      {ping && (
        <ul>
          <li>API: {ping.status}</li>
          <li>Base de datos: {ping.database}</li>
        </ul>
      )}
    </main>
  );
}

export default App;
