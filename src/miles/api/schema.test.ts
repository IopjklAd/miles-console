import { describe, expect, it } from "vitest";
import {
  parseAudio,
  parseCapabilities,
  parseCommandResponse,
  parseLogs,
  parseSensors,
  parseServices,
  parseStatus,
  parseVision,
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

describe("parseServices", () => {
  it("maps services and defaults controllable to false", () => {
    const services = parseServices(
      {
        services: [
          { id: "miles-core", name: "miles-core", status: "operational", version: "1.0.0" },
        ],
      },
      "live",
    );

    expect(services).toHaveLength(1);
    expect(services[0].controllable).toBe(false);
    expect(services[0].statusLabel).toBe("Opérationnel");
    expect(services[0].version).toBe("1.0.0");
    expect(services[0].origin).toBe("live");
  });

  it("keeps an explicit control flag and status label", () => {
    const [service] = parseServices(
      [{ id: "svc", name: "svc", status: "down", controllable: true }],
      "live",
    );
    expect(service.controllable).toBe(true);
    expect(service.statusLabel).toBe("Arrêté");
  });

  it("rejects malformed payloads", () => {
    expect(() => parseServices([{ name: "sans id" }], "live")).toThrow();
    expect(() => parseServices("nope", "live")).toThrow();
  });
});

describe("parseVision", () => {
  it("maps a complete payload", () => {
    const vision = parseVision(
      {
        webcam: { status: "operational", label: "Cam" },
        stream: "live",
        width: 640,
        height: 480,
        fps: 10,
        lastFrameAt: 1,
        controllable: true,
      },
      "live",
    );

    expect(vision.stream).toBe("live");
    expect(vision.webcam.status).toBe("operational");
    expect(vision.width).toBe(640);
    expect(vision.controllable).toBe(true);
    expect(vision.origin).toBe("live");
  });

  it("turns absent fields into null/unknown — never guesses", () => {
    const vision = parseVision({}, "live");
    expect(vision.stream).toBe("idle");
    expect(vision.width).toBeNull();
    expect(vision.snapshotUrl).toBeNull();
    expect(vision.controllable).toBe(false);
    expect(vision.webcam.status).toBe("unknown");
  });

  it("rejects an unknown stream state", () => {
    expect(() => parseVision({ stream: "broadcasting" }, "live")).toThrow();
  });
});

describe("parseAudio", () => {
  it("maps endpoints and controls", () => {
    const audio = parseAudio(
      {
        input: { status: "operational", label: "Mic" },
        output: { status: "down" },
        capturing: true,
        playing: false,
        levelDbfs: -12.5,
        volume: 55,
        volumeControllable: true,
      },
      "live",
    );

    expect(audio.input.status).toBe("operational");
    expect(audio.output.status).toBe("down");
    expect(audio.capturing).toBe(true);
    expect(audio.levelDbfs).toBe(-12.5);
    expect(audio.volumeControllable).toBe(true);
  });

  it("defaults missing pieces to unavailable", () => {
    const audio = parseAudio({}, "live");
    expect(audio.input.status).toBe("unknown");
    expect(audio.input.detail).toMatch(/backend/);
    expect(audio.volumeControllable).toBe(false);
    expect(audio.levelDbfs).toBeNull();
    expect(audio.volume).toBeNull();
  });

  it("rejects an invalid device status", () => {
    expect(() => parseAudio({ input: { status: "loud" } }, "live")).toThrow();
  });
});
