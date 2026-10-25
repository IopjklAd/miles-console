/**
 * Single source of truth for route chunks.
 *
 * `main.tsx` wires these loaders to `React.lazy`, and the prefetcher warms
 * them (after first paint, on link hover/focus) so navigating never waits on a
 * chunk fetch or a dev-server transform — the swap becomes synchronous.
 */

// No explicit return-type annotation: TypeScript must keep the exact module
// shape (props of default exports) so `lazy()` accepts them.
export const routeLoaders = {
  landing: () => import("../pages/Landing.tsx"),
  auth: () => import("../pages/Auth.tsx"),
  dashboard: () => import("../pages/Dashboard.tsx"),
  assistant: () => import("../pages/Assistant.tsx"),
  conversations: () => import("../pages/Conversations.tsx"),
  control: () => import("../pages/Control.tsx"),
  sensors: () => import("../pages/Sensors.tsx"),
  logs: () => import("../pages/Logs.tsx"),
  settings: () => import("../pages/Settings.tsx"),
  notFound: () => import("../pages/NotFound.tsx"),
};

export type RouteKey = keyof typeof routeLoaders;

/** Layout chunks loaded when entering the authenticated console. */
export const shellLoaders = {
  consoleProviders: () =>
    import("../state/console-providers.tsx").then(
      (m) => ({ default: m.ConsoleProviders }),
    ),
  appShell: () =>
    import("../components/layout/AppShell.tsx").then(
      (m) => ({ default: m.AppShell }),
    ),
};

const prefetched = new Set<string>();

/** Warm one chunk once; failures are ignored (the real load will report them). */
export function prefetchRoute(key: RouteKey | "shell") {
  if (prefetched.has(key)) return;
  prefetched.add(key);
  const task =
    key === "shell"
      ? Promise.all([
          shellLoaders.consoleProviders(),
          shellLoaders.appShell(),
        ])
      : routeLoaders[key]();
  void task.catch(() => prefetched.delete(key));
}

/** Map a console pathname to its chunk key (unknown paths warm nothing). */
export function routeKeyForPath(pathname: string): RouteKey | null {
  if (pathname === "/dashboard") return "dashboard";
  const child = pathname.slice("/dashboard/".length);
  switch (child) {
    case "assistant":
      return "assistant";
    case "conversations":
      return "conversations";
    case "controle":
      return "control";
    case "capteurs":
      return "sensors";
    case "journaux":
      return "logs";
    case "parametres":
      return "settings";
    default:
      return null;
  }
}

/** Warm every route chunk during idle time after first paint. */
export function prefetchAllRoutes() {
  (Object.keys(routeLoaders) as RouteKey[]).forEach(prefetchRoute);
  prefetchRoute("shell");
}
