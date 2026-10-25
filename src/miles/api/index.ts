/**
 * Data source factory.
 *
 * `live` talks to the real MILES backend, `demo` runs the local simulation
 * engine. The same instance is reused across renders so the demo engine keeps
 * its log buffer and robot mode between polls.
 */

import type { ApiMode } from "@/miles/types";
import { DemoEngine } from "./demo";
import { liveApi } from "./live";
import type { MilesApi } from "./contract";

export type { MilesApi } from "./contract";
export {
  MilesApiError,
  describeError,
  isMilesApiError,
  requestBackend,
} from "./client";

let demoEngine: DemoEngine | null = null;

export function createMilesApi(mode: ApiMode): MilesApi {
  if (mode === "demo") {
    demoEngine ??= new DemoEngine();
    return demoEngine;
  }
  return liveApi;
}
