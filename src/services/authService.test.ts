import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyMoodleLaunch, getStoredSession, clearSession } from "./authService";

describe("verifyMoodleLaunch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("returns the session and persists it when the backend accepts the launch token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          token: "session-jwt",
          username: "docente.demo",
          display_name: "Docente de Prueba",
          role: "docente",
          course_id: 2,
          course_name: "Sistemas de Información II",
        }),
      }),
    );

    const session = await verifyMoodleLaunch("launch-token");

    expect(session).toEqual({
      token: "session-jwt",
      username: "docente.demo",
      displayName: "Docente de Prueba",
      role: "docente",
      courseId: 2,
      courseName: "Sistemas de Información II",
    });
    expect(getStoredSession()).toEqual(session);
  });

  it("throws and does not persist anything when the backend rejects the launch token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }),
    );

    await expect(verifyMoodleLaunch("token-invalido")).rejects.toThrow(
      "moodle launch verification failed with status 401",
    );
    expect(getStoredSession()).toBeNull();
  });
});

describe("getStoredSession", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("returns null when there is nothing stored", () => {
    expect(getStoredSession()).toBeNull();
  });

  it("returns null when the stored value is not valid JSON", () => {
    sessionStorage.setItem("samce_session", "esto no es json");
    expect(getStoredSession()).toBeNull();
  });
});

describe("clearSession", () => {
  it("removes a previously stored session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          token: "session-jwt",
          username: "docente.demo",
          display_name: "Docente de Prueba",
          role: "docente",
          course_id: 2,
          course_name: "Sistemas de Información II",
        }),
      }),
    );

    await verifyMoodleLaunch("launch-token");
    expect(getStoredSession()).not.toBeNull();

    clearSession();
    expect(getStoredSession()).toBeNull();
  });
});
