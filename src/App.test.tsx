import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "./App";
import * as pingService from "./services/pingService";
import * as authService from "./services/authService";

describe("App", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.pushState({}, "", "/");
    vi.spyOn(pingService, "fetchPing").mockResolvedValue({ status: "ok", database: "ok" });
  });

  it("shows the connectivity status once the backend responds", async () => {
    render(<App />);

    expect(screen.getByText(/Consultando \/ping/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/API: ok/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Base de datos: ok/i)).toBeInTheDocument();
  });

  it("shows an error message when the backend request fails", async () => {
    vi.spyOn(pingService, "fetchPing").mockRejectedValue(new Error("network down"));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Error al conectar con el backend: network down/i)).toBeInTheDocument();
    });
  });

  it("prompts to access from the Moodle campus when there is no session and no callback in progress", () => {
    render(<App />);

    expect(screen.getByText(/Accedé desde el Campus Virtual/i)).toBeInTheDocument();
  });

  it("verifies the launch token and shows the session when landing on /auth/callback", async () => {
    window.history.pushState({}, "", "/auth/callback?token=un-token-de-lanzamiento");
    vi.spyOn(authService, "verifyMoodleLaunch").mockResolvedValue({
      token: "session-jwt",
      username: "docente.demo",
      role: "docente",
      courseId: 2,
    });

    render(<App />);

    expect(screen.getByText(/Validando lanzamiento desde Moodle/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Sesión activa: docente\.demo \(docente\), curso 2/i)).toBeInTheDocument();
    });
    expect(authService.verifyMoodleLaunch).toHaveBeenCalledWith("un-token-de-lanzamiento");
  });

  it("shows an auth error when the launch token verification fails", async () => {
    window.history.pushState({}, "", "/auth/callback?token=un-token-invalido");
    vi.spyOn(authService, "verifyMoodleLaunch").mockRejectedValue(
      new Error("moodle launch verification failed with status 401"),
    );

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByText(/Error de autenticación: moodle launch verification failed with status 401/i),
      ).toBeInTheDocument();
    });
  });

  it("does not show a stale session alongside a failed re-launch attempt", async () => {
    sessionStorage.setItem(
      "samce_session",
      JSON.stringify({ token: "session-jwt", username: "docente.demo", role: "docente", courseId: 2 }),
    );
    window.history.pushState({}, "", "/auth/callback?token=un-token-invalido");
    vi.spyOn(authService, "verifyMoodleLaunch").mockRejectedValue(
      new Error("moodle launch verification failed with status 401"),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Error de autenticación/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Sesión activa/i)).not.toBeInTheDocument();
  });

  it("restores an existing session from storage without re-verifying", () => {
    sessionStorage.setItem(
      "samce_session",
      JSON.stringify({ token: "session-jwt", username: "docente.demo", role: "docente", courseId: 2 }),
    );

    render(<App />);

    expect(screen.getByText(/Sesión activa: docente\.demo \(docente\), curso 2/i)).toBeInTheDocument();
  });
});
