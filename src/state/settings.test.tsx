/**
 * Settings: corrupted storage must not break the console, and threshold
 * changes must be persisted immediately.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { SettingsProvider, useSettings } from "@/state/settings";
import { STORAGE_KEYS } from "@/config/app";

function Probe() {
  const { settings, setThreshold, update } = useSettings();
  return (
    <div>
      <span data-testid="system-name">{settings.systemName}</span>
      <span data-testid="thresholds">{JSON.stringify(settings.thresholds)}</span>
      <button type="button" onClick={() => update({ systemName: "MILES-TEST" })}>
        rename
      </button>
      <button
        type="button"
        onClick={() => setThreshold("sound-board", { enabled: true, max: 70 })}
      >
        threshold
      </button>
    </div>
  );
}

describe("settings", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("falls back to defaults when the stored settings are corrupted", () => {
    window.localStorage.setItem(STORAGE_KEYS.settings, "{not-json");

    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );

    expect(screen.getByTestId("system-name").textContent).toBe("MILES");
  });

  it("persists threshold changes immediately", () => {
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );

    fireEvent.click(screen.getByText("threshold"));

    expect(
      screen.getByTestId("thresholds").textContent,
    ).toContain("sound-board");

    const stored = window.localStorage.getItem(STORAGE_KEYS.settings);
    expect(stored).toContain("sound-board");
    expect(stored).toContain('"max":70');
  });

  it("keeps working updates in the working copy", () => {
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );

    fireEvent.click(screen.getByText("rename"));
    expect(screen.getByTestId("system-name").textContent).toBe("MILES-TEST");
  });
});
