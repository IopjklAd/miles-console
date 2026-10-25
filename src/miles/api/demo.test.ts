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
