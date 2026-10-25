import type { HistoryRange } from "@/config/app";
import type {
  ApiMode,
  AppSettings,
  AudioState,
  CommandResult,
  LogEntry,
  RobotCapability,
  RobotState,
  Sensor,
  SensorHistory,
  ServiceAction,
  ServiceInfo,
  SystemStatus,
  VisionState,
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
  /** Software services (§12): read + optional backend-controlled actions. */
  getServices(): Promise<ServiceInfo[]>;
  serviceCommand(input: {
    serviceId: string;
    action: ServiceAction;
    label: string;
  }): Promise<CommandResult>;
  /** Backend-served webcam stream (§9). */
  getVision(): Promise<VisionState>;
  visionCommand(action: "start" | "stop"): Promise<CommandResult>;
  /** Audio devices (§10). */
  getAudio(): Promise<AudioState>;
  setVolume(percent: number): Promise<void>;
  /** Connectivity check + remote settings (live only). */
  getSettings(): Promise<Partial<AppSettings>>;
  saveSettings(settings: AppSettings): Promise<void>;
}
