import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatLatency,
  formatPercent,
  formatRelative,
  formatClock,
} from "@/lib/format";

describe("formatDuration", () => {
  it("formats minutes, hours and days", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(90)).toBe("1 min");
    expect(formatDuration(3_600)).toBe("1 h 00 min");
    expect(formatDuration(90_000)).toBe("1 j 01 h");
  });

  it("returns Indisponible for missing values", () => {
    expect(formatDuration(-5)).toBe("Indisponible");
    expect(formatDuration(Number.NaN)).toBe("Indisponible");
  });
});

describe("formatPercent / formatLatency", () => {
  it("marks absent metrics as Indisponible instead of inventing one", () => {
    expect(formatPercent(undefined)).toBe("Indisponible");
    expect(formatPercent(null)).toBe("Indisponible");
    expect(formatLatency(undefined)).toBe("Indisponible");
  });

  it("renders present values", () => {
    expect(formatPercent(42.4)).toBe("42 %");
    expect(formatLatency(18)).toBe("18 ms");
    expect(formatLatency(1_500)).toBe("1.5 s");
  });
});

describe("formatRelative", () => {
  it("is instantaneous for the current time", () => {
    const now = Date.now();
    expect(formatRelative(now, now)).toBe("à l'instant");
  });

  it("moves away from the reference over time", () => {
    const now = Date.now();
    const twoMinutesAgo = now - 120_000;
    expect(formatRelative(twoMinutesAgo, now)).not.toBe("à l'instant");
  });
});

describe("formatClock", () => {
  it("respects the requested timezone", () => {
    expect(formatClock(Date.UTC(2026, 0, 1, 12, 30, 45), { timeZone: "UTC" })).toBe(
      "12:30:45",
    );
  });
});
