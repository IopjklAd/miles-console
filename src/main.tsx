import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { prefetchAllRoutes, routeLoaders, shellLoaders } from "./lib/route-loaders";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting.
// Loaders live in src/lib/route-loaders.ts so the prefetcher can warm the same
// chunks the router will use (keep this list in sync with AppSidebar).
const Landing = lazy(routeLoaders.landing);
const AuthPage = lazy(routeLoaders.auth);
const Dashboard = lazy(routeLoaders.dashboard);
const Assistant = lazy(routeLoaders.assistant);
const Conversations = lazy(routeLoaders.conversations);
const Control = lazy(routeLoaders.control);
const Sensors = lazy(routeLoaders.sensors);
const Logs = lazy(routeLoaders.logs);
const Settings = lazy(routeLoaders.settings);
const NotFound = lazy(routeLoaders.notFound);

const ConsoleProviders = lazy(shellLoaders.consoleProviders);
const AppShell = lazy(shellLoaders.appShell);

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in the browser runtime). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(error: Error) {
    console.error("[Preview] Root crash:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-1 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Warm up the connection to the Convex deployment before React mounts, so the
// first auth/data queries don't pay DNS + TLS setup themselves.
const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
if (convexUrl) {
  try {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = new URL(convexUrl).origin;
    link.crossOrigin = "";
    document.head.appendChild(link);
  } catch {
    // Invalid URL: ConvexReactClient below reports it properly.
  }
}
const convex = new ConvexReactClient(convexUrl);

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="miles.theme">
        <ConvexAuthProvider client={convex}>
          <BrowserRouter>
            <RouteSyncer />
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route
                  path="/auth"
                  element={<AuthPage redirectAfterAuth="/dashboard" />}
                />
                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth
                      title="Connexion requise"
                      description="La console MILES est réservée aux opérateurs authentifiés."
                    >
                      <ConsoleProviders>
                        <AppShell />
                      </ConsoleProviders>
                    </RequireAuth>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="assistant" element={<Assistant />} />
                  <Route path="conversations" element={<Conversations />} />
                  <Route path="controle" element={<Control />} />
                  <Route path="capteurs" element={<Sensors />} />
                  <Route path="journaux" element={<Logs />} />
                  <Route path="parametres" element={<Settings />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster />
        </ConvexAuthProvider>
      </ThemeProvider>
    </RootErrorBoundary>
  </StrictMode>,
);

// Warm every route chunk once the app is idle: navigation then needs no
// network round-trip (and warms the dev server's transform cache too).
const warmRoutes = () => prefetchAllRoutes();
if (typeof window.requestIdleCallback === "function") {
  window.requestIdleCallback(warmRoutes, { timeout: 4000 });
} else {
  window.setTimeout(warmRoutes, 2000);
}
