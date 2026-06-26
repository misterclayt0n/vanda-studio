import type { CSSProperties } from "react";
import { RedirectToSignIn, Show } from "@clerk/tanstack-react-start";
import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@vanda-studio/ui/components/sidebar";
import { TooltipProvider } from "@vanda-studio/ui/components/tooltip";
import { AppSidebar } from "../components/app-sidebar";
import { api } from "../convex/_generated/api";

export const Route = createFileRoute("/_dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <>
      <Show when="signed-out">
        <RedirectToSignIn />
      </Show>
      <Show when="signed-in">
        <DashboardGate />
      </Show>
    </>
  );
}

/**
 * Holds the dashboard behind onboarding: until at least one account is onboarded,
 * every dashboard route redirects to the flow. `listMine` is already loaded by the
 * sidebar, so this adds no extra round-trip.
 */
function DashboardGate() {
  const accounts = useQuery(api.accounts.listMine);
  if (accounts === undefined) return <div className="min-h-svh bg-app" />;
  if (!accounts.some((account) => account.onboardedAt !== null)) {
    return <Navigate to="/onboarding" />;
  }
  return (
    <TooltipProvider>
      <SidebarProvider style={{ "--sidebar-width": "15rem" } as CSSProperties}>
        <AppSidebar />
        <SidebarInset className="flex h-svh flex-col overflow-hidden bg-app">
          <DashboardSidebarTrigger />
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function DashboardSidebarTrigger() {
  const { state } = useSidebar();

  return (
    <header
      className={
        state === "collapsed"
          ? "flex h-14 shrink-0 items-start px-3 pt-3.5"
          : "flex h-[72px] shrink-0 items-start px-3 pt-[22px]"
      }
    >
      <SidebarTrigger className="size-7 text-text-4 hover:bg-sidebar-accent hover:text-sidebar-foreground" />
    </header>
  );
}
