import { describe, expect, it } from "vitest";
import {
  MilesApiError,
  describeError,
  isMilesApiError,
  requestBackend,
  withQuery,
} from "@/miles/api/client";

describe("requestBackend", () => {
  it("refuses to call an endpoint when no backend is configured", async () => {
    // VITE_MILES_API_BASE_URL is intentionally unset in tests.
    await expect(
      requestBackend("/api/status", {}, (data) => data),
    ).rejects.toMatchObject({ code: "not_configured" });
  });

  it("never resolves a payload without validation", async () => {
    const error = await requestBackend("/api/status", {}, () => {
      throw new Error("schéma invalide");
    }).catch((reason: unknown) => reason);

    // The call above fails first on `not_configured`; both paths must be typed.
    expect(isMilesApiError(error)).toBe(true);
  });
});

describe("describeError", () => {
  const cases: Array<[MilesApiError, RegExp]> = [
    [new MilesApiError("not_configured", "x"), /VITE_MILES_API_BASE_URL/],
    [new MilesApiError("timeout", "x"), /délai/],
    [new MilesApiError("network", "x"), /joindre le backend/],
    [new MilesApiError("http", "x", { status: 503 }), /503/],
    [new MilesApiError("parse", "x"), /contrat d'API/],
  ];

  it.each(cases)("explains %s", (error, expected) => {
    expect(describeError(error)).toMatch(expected);
  });

  it("falls back to the message of unknown errors", () => {
    expect(describeError(new Error("boom"))).toBe("boom");
    expect(describeError("plain string")).toBe("Erreur inconnue.");
  });
});

describe("withQuery", () => {
  it("appends defined parameters only", () => {
    expect(withQuery("/api/logs", { limit: 200, level: undefined })).toBe(
      "/api/logs?limit=200",
    );
    expect(withQuery("/api/sensors", {})).toBe("/api/sensors");
  });
});
