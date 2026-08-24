import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import App from "./App";
import * as pingService from "./services/pingService";

describe("App", () => {
  it("shows the connectivity status once the backend responds", async () => {
    vi.spyOn(pingService, "fetchPing").mockResolvedValue({ status: "ok", database: "ok" });

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
});
