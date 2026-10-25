/**
 * Live data source: real REST calls to the MILES backend.
 *
 * Every method goes through `requestBackend`, which validates the payload
 * against the documented contract. When no backend is configured the call
 * rejects with `not_configured` — the UI then shows "Indisponible" instead of
 * inventing a value.
 */

import {
  API_ENDPOINTS,
  type HistoryRange,
  LOG_FETCH_LIMIT,
} from "@/config/app";
import type { MilesApi } from "./contract";
import { requestBackend, withQuery } from "./client";
import {
  parseAudio,
  parseCapabilities,
  parseCommandResponse,
  parseLogs,
  parseRobotState,
  parseSensorHistory,
  parseSensors,
  parseServices,
  parseSettings,
  parseStatus,
  parseVision,
} from "./schema";

export const liveApi: MilesApi = {
  mode: "live",

  getStatus: () =>
    requestBackend(API_ENDPOINTS.status, {}, (data) =>
      parseStatus(data, "live"),
    ),

  getSensors: () =>
    requestBackend(API_ENDPOINTS.sensors, {}, (data) =>
      parseSensors(data, "live"),
    ),

  getSensorHistory: (sensorId: string, range: HistoryRange) =>
    requestBackend(
      withQuery(API_ENDPOINTS.sensorHistory, { sensorId, range }),
      {},
      (data) => parseSensorHistory(data, sensorId, range, "live"),
    ),

  getLogs: (limit = LOG_FETCH_LIMIT) =>
    requestBackend(withQuery(API_ENDPOINTS.logs, { limit }), {}, (data) =>
      parseLogs(data, "live"),
    ),

  getRobotState: () =>
    requestBackend(API_ENDPOINTS.robotState, {}, (data) =>
      parseRobotState(data, "live"),
    ),

  getRobotCapabilities: () =>
    requestBackend(API_ENDPOINTS.robotCapabilities, {}, (data) =>
      parseCapabilities(data),
    ),

  sendCommand: async (capability) => {
    const sentAt = Date.now();
    const commandId = `cmd-${sentAt.toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    return requestBackend(
      API_ENDPOINTS.robotCommands,
      {
        method: "POST",
        body: { commandId, capabilityId: capability.id },
      },
      (data) =>
        parseCommandResponse(data, {
          commandId,
          capabilityId: capability.id,
          label: capability.label,
          sentAt,
          origin: "live",
        }),
    );
  },

  getSettings: () =>
    requestBackend(API_ENDPOINTS.settings, {}, (data) => parseSettings(data)),

  getServices: () =>
    requestBackend(API_ENDPOINTS.services, {}, (data) =>
      parseServices(data, "live"),
    ),

  serviceCommand: async (input) => {
    const sentAt = Date.now();
    const commandId = `svc-${sentAt.toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    return requestBackend(
      API_ENDPOINTS.serviceCommand,
      {
        method: "POST",
        body: { commandId, serviceId: input.serviceId, action: input.action },
      },
      (data) =>
        parseCommandResponse(data, {
          commandId,
          capabilityId: `${input.serviceId}:${input.action}`,
          label: input.label,
          sentAt,
          origin: "live",
        }),
    );
  },

  getVision: () =>
    requestBackend(API_ENDPOINTS.vision, {}, (data) => parseVision(data, "live")),

  visionCommand: async (action) => {
    const sentAt = Date.now();
    const commandId = `vis-${sentAt.toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    return requestBackend(
      API_ENDPOINTS.visionCommand,
      { method: "POST", body: { commandId, action } },
      (data) =>
        parseCommandResponse(data, {
          commandId,
          capabilityId: `stream:${action}`,
          label: action === "start" ? "Démarrer le flux" : "Arrêter le flux",
          sentAt,
          origin: "live",
        }),
    );
  },

  getAudio: () =>
    requestBackend(API_ENDPOINTS.audio, {}, (data) => parseAudio(data, "live")),

  setVolume: (percent) =>
    requestBackend(
      API_ENDPOINTS.audioVolume,
      { method: "POST", body: { volume: Math.round(percent) } },
      () => undefined,
    ),


  saveSettings: async (settings) => {
    await requestBackend(
      API_ENDPOINTS.settings,
      { method: "PUT", body: settings },
      () => undefined,
    );
  },
};
