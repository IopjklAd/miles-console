import { describe, expect, it } from "vitest";
import { createMilesApi } from "@/miles/api";

/**
 * The demo engine must be recognisable as simulated everywhere and must never
 * expose a command the hardware cannot perform.
 */
describe("demo data source", () => {
  const api = createMilesApi("demo");

  it("flags every payload as demo", async () => {
    const status = await api.getStatus();
    const sensors = await api.getSensors();
    const logs = await api.getLogs();
    const robot = await api.getRobotState();

    expect(status.origin).toBe("demo");
    expect(sensors.every((sensor) => sensor.origin === "demo")).toBe(true);
    expect(logs.every((entry) => entry.origin === "demo")).toBe(true);
    expect(robot.origin).toBe("demo");
  });

  it("marks sensor readings as simulated", async () => {
    const sensors = await api.getSensors();
    expect(sensors.length).toBeGreaterThan(0);
    expect(
      sensors.every(
        (sensor) => sensor.reading?.state === "simulated" && sensor.reading.value !== null,
      ),
    ).toBe(true);
  });

  it("returns a coherent status with host metrics", async () => {
    const status = await api.getStatus();
    expect(status.overall).toBe("degraded");
    expect(status.host?.cpuPercent).toBeGreaterThanOrEqual(0);
    expect(status.host?.activeServices).toBeGreaterThan(0);
  });

  it("produces chronological logs", async () => {
    const logs = await api.getLogs();
    expect(logs.length).toBeGreaterThan(0);
    for (let index = 1; index < logs.length; index += 1) {
      expect(logs[index - 1].at).toBeGreaterThanOrEqual(logs[index].at);
    }
  });

  it("returns history points inside the requested window", async () => {
    const history = await api.getSensorHistory("vl53l3cx", "5m");
    const now = Date.now();
    expect(history.origin).toBe("demo");
    expect(history.points.length).toBeGreaterThan(0);
    expect(history.points.every((point) => point.t <= now)).toBe(true);
    expect(history.points.every((point) => point.t >= now - 5 * 60_000 - 5_000)).toBe(
      true,
    );
  });

  it("exposes no locomotion command (no hardware support is known)", async () => {
    const capabilities = await api.getRobotCapabilities();
    const labels = capabilities.map((capability) => capability.id).join(" ");
    expect(labels).not.toMatch(/avance|recul|tourne|forward|move|turn/i);
    expect(
      capabilities.some((capability) => capability.requiresConfirmation),
    ).toBe(true);
  });

  it("answers a command with an accepted result, and rejects unknown ones", async () => {
    const [capability] = await api.getRobotCapabilities();
    const result = await api.sendCommand(capability);

    expect(result.status).toBe("accepted");
    expect(result.message).toMatch(/démonstration/);
    expect(result.origin).toBe("demo");

    const unknown = await api.sendCommand({ id: "nope", label: "Inconnue" });
    expect(unknown.status).toBe("rejected");
  });

  it("keeps robot mode between calls", async () => {
    const before = await api.getRobotState();
    await api.sendCommand({ id: "watch_enable", label: "Surveillance" });
    const after = await api.getRobotState();

    expect(before.mode).toBe("veille");
    expect(after.mode).toBe("surveillance");
  });

  it("never pretends to persist settings remotely", async () => {
    await expect(api.saveSettings({} as never)).resolves.toBeUndefined();
    await expect(api.getSettings()).resolves.toEqual({});
  });
});

/**
 * Services / vision / audio: a coherent simulated stack where commands are
 * accepted in order and no frame is ever fabricated.
 */

describe("demo services, vision and audio", () => {
  const api = createMilesApi("demo");

  it("exposes a coherent, clearly simulated stack", async () => {
    const services = await api.getServices();
    expect(services.length).toBeGreaterThan(0);
    expect(services.every((service) => service.origin === "demo")).toBe(true);

    const visionService = services.find((service) => service.id === "miles-vision");
    expect(visionService?.status).toBe("down");
    expect(visionService?.controllable).toBe(true);

    const vision = await api.getVision();
    expect(vision.origin).toBe("demo");
    expect(vision.webcam.origin).toBe("demo");
    expect(vision.stream).toBe("idle");
    // The demo engine never invents an image.
    expect(vision.snapshotUrl).toBeNull();
    expect(vision.width).toBeNull();
  });

  it("refuses to start the stream while the vision service is down", async () => {
    const rejected = await api.visionCommand("start");
    expect(rejected.status).toBe("rejected");
    expect(rejected.error).toMatch(/miles-vision/);
    expect(rejected.origin).toBe("demo");
  });

  it("starts the service, then the stream, in order", async () => {
    const started = await api.serviceCommand({
      serviceId: "miles-vision",
      action: "start",
      label: "Démarrer miles-vision",
    });
    expect(started.status).toBe("accepted");
    expect(started.message).toMatch(/démonstration/);

    const accepted = await api.visionCommand("start");
    expect(accepted.status).toBe("accepted");

    const vision = await api.getVision();
    expect(vision.stream).toBe("live");
    expect(vision.width).toBe(640);
    expect(vision.webcam.status).toBe("operational");
    expect(vision.snapshotUrl).toBeNull();
  });

  it("stopping the service takes the stream down with it", async () => {
    await api.serviceCommand({
      serviceId: "miles-vision",
      action: "stop",
      label: "Arrêter miles-vision",
    });
    const vision = await api.getVision();
    expect(vision.stream).toBe("idle");
    expect(vision.webcam.status).toBe("unavailable");
    expect(vision.lastError).toMatch(/miles-vision/);
  });

  it("rejects commands against unknown or uncontrollable services", async () => {
    const unknown = await api.serviceCommand({
      serviceId: "inexistant",
      action: "restart",
      label: "?",
    });
    expect(unknown.status).toBe("rejected");
    expect(unknown.origin).toBe("demo");
  });

  it("reports audio devices and clamps the volume control", async () => {
    const audio = await api.getAudio();
    expect(audio.origin).toBe("demo");
    expect(audio.volumeControllable).toBe(true);
    expect(audio.input.label).toBeTruthy();
    expect(audio.levelDbfs).not.toBeNull();

    await api.setVolume(150);
    expect((await api.getAudio()).volume).toBe(100);
    await api.setVolume(-10);
    expect((await api.getAudio()).volume).toBe(0);
  });
});
