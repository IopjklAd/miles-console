import { describe, expect, it } from "vitest";
import {
  parseCapabilities,
  parseCommandResponse,
  parseLogs,
  parseSensors,
  parseStatus,
} from "@/miles/api/schema";

describe("parseStatus", () => {
  const payload = {
    overall: "degraded",
    backend: { status: "operational", label: "Connecté", latencyMs: 42 },
    esp32: { status: "down", detail: "port fermé" },
  };

  it("maps the payload and flags components the backend does not expose", () => {
    const status = parseStatus(payload, "live");

    expect(status.overall).toBe("degraded");
    expect(status.backend.status).toBe("operational");
    expect(status.backend.latencyMs).toBe(42);
    expect(status.vision.status).toBe("unknown");
    expect(status.vision.detail).toMatch(/pas renvoyé/);
    expect(status.origin).toBe("live");
    expect(status.host).toBeUndefined();
    expect(status.recentErrorCount).toBe(0);
  });

  it("rejects a payload that violates the contract", () => {
    expect(() => parseStatus({ overall: "pink" }, "live")).toThrow();
  });
});

describe("parseSensors", () => {
  const now = Date.now();

  it("labels demo values as simulated", () => {
    const [sensor] = parseSensors(
      [
        {
          id: "vl53l3cx",
          name: "Distance",
          kind: "distance",
          link: "connected",
          value: 420,
          unit: "mm",
          at: now,
        },
      ],
      "demo",
    );

    expect(sensor.reading?.state).toBe("simulated");
    expect(sensor.origin).toBe("demo");
    expect(sensor.threshold).toBeNull();
  });

  it("marks old real measurements as stale", () => {
    const [sensor] = parseSensors(
      [
        {
          id: "sound",
          name: "Sonore",
          link: "connected",
          value: 51,
          unit: "dB",
          at: now - 60_000,
        },
      ],
      "live",
    );

    expect(sensor.reading?.state).toBe("stale");
  });

  it("keeps a sensor without value as unavailable", () => {
    const [sensor] = parseSensors(
      [{ id: "pir", name: "PIR", link: "disconnected" }],
      "live",
    );

    expect(sensor.reading).toBeNull();
    expect(sensor.link).toBe("disconnected");
  });

  it("rejects an unknown payload", () => {
    expect(() => parseSensors({ sensors: "nope" }, "live")).toThrow();
  });
});

describe("parseLogs", () => {
  it("sorts newest first and always provides an id", () => {
    const logs = parseLogs(
      [
        { at: 1_000, level: "INFO", source: "backend", message: "old" },
        { at: 2_000, level: "ERROR", source: "esp32", message: "new" },
      ],
      "live",
    );

    expect(logs.map((entry) => entry.message)).toEqual(["new", "old"]);
    expect(logs.every((entry) => entry.id.length > 0)).toBe(true);
    expect(logs[0].origin).toBe("live");
  });

  it("rejects an unknown log level", () => {
    expect(() =>
      parseLogs([{ at: 1, level: "FATAL", source: "x", message: "y" }], "live"),
    ).toThrow();
  });
});

describe("parseCommandResponse", () => {
  const context = {
    commandId: "cmd-1",
    capabilityId: "get_state",
    label: "Demander l'état",
    sentAt: 10,
    origin: "live" as const,
  };

  it("never reports a command as accepted when the backend omits the status", () => {
    const result = parseCommandResponse({}, context);
    expect(result.status).toBe("sent");
    expect(result.acknowledgedAt).toBeUndefined();
  });

  it("keeps an explicit rejection", () => {
    const result = parseCommandResponse(
      { status: "rejected", error: "non autorisé" },
      context,
    );
    expect(result.status).toBe("rejected");
    expect(result.error).toBe("non autorisé");
  });
});

describe("parseCapabilities", () => {
  it("applies safe defaults", () => {
    const [capability] = parseCapabilities([
      { id: "watch_enable", label: "Activer la surveillance" },
    ]);

    expect(capability.requiresConfirmation).toBe(false);
    expect(capability.enabled).toBe(true);
    expect(capability.kind).toBe("action");
  });

  it("reads the whole manifest, rejecting malformed entries", () => {
    expect(() => parseCapabilities([{ label: "sans id" }])).toThrow();
  });
});
