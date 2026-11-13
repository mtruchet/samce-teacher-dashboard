import { render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { vi } from "vitest";
import * as sesionesService from "../services/sesionesService";
import { Panel } from "../pages/Panel";
import { sesion } from "./fabricas";

/**
 * Lo que comparten las pruebas del panel montado solo (Panel.test, Panel.filtros, Panel.resumen y
 * Panel.alertas): el ingreso del docente, el examen, dos sesiones y el montaje con el botón Atrás.
 *
 * Se monta el panel solo, con relojes falsos, y no la app entera: la app carga las pantallas con `lazy`, que
 * los relojes falsos no esperan.
 */

export const INGRESO = {
  token: "session-jwt",
  username: "docente.demo",
  displayName: "Docente de Prueba",
  role: "docente",
  courseId: 2,
  courseName: "Sistemas de Información II",
};

export const EXAMEN: sesionesService.ExamenMonitoreado = {
  id: 1,
  moodle_course_id: 2,
  moodle_quiz_id: 1,
  name: "Primer Parcial",
  created_at: "2026-08-26T14:00:00Z",
  open_sessions: 1,
  closed_sessions: 1,
  abandoned_sessions: 0,
};

/** Guarda el ingreso del docente, como lo deja el arranque del panel. */
export function ingresar() {
  sessionStorage.clear();
  sessionStorage.setItem("samce_session", JSON.stringify(INGRESO));
}

/** Una sesión que se entregó hace una hora: el registro se pide una vez y listo. */
export function entregadaHaceRato(): sesionesService.Sesion {
  return sesion({
    id: 5,
    status: "closed",
    started_at: "2026-08-26T14:02:00Z",
    closed_at: new Date(Date.now() - 60 * 60_000).toISOString(),
  });
}

/** Bruno, rindiendo. */
export const rindiendo = sesion({
  id: 6,
  moodle_attempt_id: 7002,
  moodle_user_id: 42,
  student_name: "Bruno Pérez",
  started_at: "2026-08-26T14:03:00Z",
});

/** El botón «Atrás» del navegador y la dirección actual, para las pruebas que recorren el historial. */
// Es un archivo de pruebas: no se recarga en caliente, así que no importa que exporte algo más que componentes.
// eslint-disable-next-line react-refresh/only-export-components
function Navegador() {
  const navegar = useNavigate();
  const lugar = useLocation();
  return (
    <>
      <button onClick={() => navegar(-1)}>Atrás del navegador</button>
      <output data-testid="direccion">{lugar.search}</output>
    </>
  );
}

/** Monta el panel en `direccion`, con `antes` como las entradas anteriores del historial. */
export function montar(direccion: string, antes: string[] = []) {
  return render(
    <MemoryRouter initialEntries={[...antes, direccion]} initialIndex={antes.length}>
      <Navegador />
      <Panel />
    </MemoryRouter>
  );
}

/** Los parámetros de la dirección que el panel tiene ahora. */
export function direccion(): URLSearchParams {
  return new URLSearchParams(screen.getByTestId("direccion").textContent ?? "");
}

/** Los filtros con que se pidió la lista la última vez. */
export function ultimoPedido() {
  const llamadas = vi.mocked(sesionesService.traerSesiones).mock.calls;
  return llamadas[llamadas.length - 1]?.[2];
}
