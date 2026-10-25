/**
 * Shell of the authenticated console: sidebar + header + mode banner + page.
 *
 * The scrollable area is isolated so the header and banner stay fixed, and the
 * content is width-limited to keep technical tables readable on wide screens.
 */

import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ModeBanner } from "@/components/layout/ModeBanner";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { motion, useReducedMotion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { Suspense, type ReactNode } from "react"
import { Outlet, useLocation } from "react-router"

/**
 * Cross-fades the content area when the route changes: lazy chunks swap in
 * without a white flash.
 */
function RouteTransition({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return <>{children}</>;
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0.55 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Keeps the shell (sidebar + header) mounted while a route loads: navigation
 * only swaps the content area instead of flashing a full-screen fallback.
 */
function PageLoading() {
  return (
    <div
      role="status"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground"
    >
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <p className="text-sm">Chargement de la page…</p>
    </div>
  )
}

export function AppShell() {
  const location = useLocation();
  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden">
        <AppHeader />
        <ModeBanner />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Suspense fallback={<PageLoading />}>
              <RouteTransition pathname={location.pathname}>
                <Outlet />
              </RouteTransition>
            </Suspense>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
