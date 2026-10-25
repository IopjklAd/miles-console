import type { HistoryRange } from "@/config/app";
import type {
  ApiMode,
  AppSettings,
  CommandResult,
  LogEntry,
  RobotCapability,
  RobotState,
  Sensor,
  SensorHistory,
  SystemStatus,
} from "@/miles/types";

/**
 * The single interface the UI talks to.
 *
 * Two implementations exist:
 * - `live`   → REST calls to the MILES backend (`live.ts`)
 * - `demo`   → deterministic simulation clearly flagged (`demo.ts`)
 *
 * Swapping or adding a data source never touches the pages.
 */
export interface MilesApi {
  readonly mode: ApiMode;
  getStatus(): Promise<SystemStatus>;
  getSensors(): Promise<Sensor[]>;
  getSensorHistory(sensorId: string, range: HistoryRange): Promise<SensorHistory>;
  getLogs(limit?: number): Promise<LogEntry[]>;
  getRobotState(): Promise<RobotState>;
  getRobotCapabilities(): Promise<RobotCapability[]>;
  sendCommand(capability: { id: string; label: string }): Promise<CommandResult>;
  /** Connectivity check + remote settings (live only). */
  getSettings(): Promise<Partial<AppSettings>>;
  saveSettings(settings: AppSettings): Promise<void>;
}
