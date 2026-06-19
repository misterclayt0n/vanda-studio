import type { CSSProperties } from "react";
import { RedirectToSignIn, Show } from "@clerk/tanstack-react-start";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "@vanda-studio/ui/components/sidebar";
import { TooltipProvider } from "@vanda-studio/ui/components/tooltip";
import { AppSidebar } from "../components/app-sidebar";

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
        <TooltipProvider>
          <SidebarProvider style={{ "--sidebar-width": "15rem" } as CSSProperties}>
            <AppSidebar />
            <SidebarInset className="flex h-svh flex-col overflow-hidden bg-vanda-surface">
              <Outlet />
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </Show>
    </>
  );
}
