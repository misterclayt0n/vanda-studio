import type { ComponentType } from "react";
import { UserButton, useUser } from "@clerk/tanstack-react-start";
import { Link, useRouterState } from "@tanstack/react-router";
import { Calendar, ChevronDown, LayoutGrid, RefreshCw, Sparkles, User } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@vanda-studio/ui/components/sidebar";
import { VandaMark } from "./vanda-mark";

type DashboardPath = "/" | "/automatico" | "/galeria" | "/calendario" | "/perfil";

interface NavItem {
  label: string;
  to: DashboardPath;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  live?: boolean;
  badge?: string;
}

const NAV: NavItem[] = [
  { label: "Início", to: "/", icon: Home, exact: true },
  { label: "Automático", to: "/automatico", icon: RefreshCw, live: true },
  { label: "Galeria", to: "/galeria", icon: LayoutGrid, badge: "8" },
  { label: "Calendário", to: "/calendario", icon: Calendar },
  { label: "Perfil", to: "/perfil", icon: User },
];

function Home(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </svg>
  );
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useUser();

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="gap-0 px-3 pt-4 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center justify-between gap-2 px-2 pb-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Link to="/" className="flex items-center gap-[9px] group-data-[collapsible=icon]:hidden">
            <VandaMark size={26} />
            <span className="text-[13.5px] font-semibold tracking-[-0.018em]">
              Vanda<span className="text-vanda-muted-2"> Studio</span>
            </span>
          </Link>
          <SidebarTrigger className="size-7 shrink-0 text-vanda-muted-2 hover:text-sidebar-foreground" />
        </div>

        <button
          type="button"
          title="Café Lumiar"
          className="mb-4 flex w-full items-center gap-[9px] rounded-[9px] border border-[#261f28] bg-[#161117] px-[9px] py-[7px] text-left transition-colors duration-200 hover:bg-[#1b1620] group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
        >
          <span className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-[#2a2330] text-[11px] font-semibold text-[#ccc6cc]">
            CL
          </span>
          <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-[13px] font-semibold">Café Lumiar</span>
            <span className="block text-[11px] text-vanda-muted-2">Plano Pro</span>
          </span>
          <ChevronDown className="size-[15px] text-vanda-muted-2 group-data-[collapsible=icon]:hidden" />
        </button>
      </SidebarHeader>

      <SidebarContent className="px-3 group-data-[collapsible=icon]:px-2">
        <SidebarGroup className="p-0">
          <SidebarMenu className="gap-0.5">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    render={<Link to={item.to} />}
                    isActive={active}
                    tooltip={item.label}
                    className="h-[32px] gap-[11px] px-2.5 text-[13px] font-medium text-sidebar-foreground/55 transition-colors duration-150 data-active:text-sidebar-accent-foreground"
                  >
                    <Icon className="size-4" />
                    <span className="flex-1 group-data-[collapsible=icon]:hidden">{item.label}</span>
                    {item.live ? (
                      <span className="flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold text-vanda-positive group-data-[collapsible=icon]:hidden">
                        <span className="size-1.5 rounded-full bg-vanda-positive shadow-[0_0_6px_var(--vanda-positive)]" />
                        ao vivo
                      </span>
                    ) : null}
                  </SidebarMenuButton>
                  {item.badge ? (
                    <SidebarMenuBadge className="rounded-full bg-vanda-accent-soft-bg text-[11px] font-semibold text-vanda-accent-soft">
                      {item.badge}
                    </SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-0 px-3 pb-3 group-data-[collapsible=icon]:px-2">
        <div className="mb-3 rounded-[10px] border border-[#261f28] bg-card p-3 group-data-[collapsible=icon]:hidden">
          <div className="mb-[9px] flex items-center justify-between">
            <span className="flex items-center gap-[7px] text-[12.5px] font-semibold text-[#ccc6cc]">
              <Sparkles className="size-[15px] text-vanda-accent-soft" />
              Vanda IA
            </span>
            <span className="text-[12px] font-semibold text-vanda-muted-2">62%</span>
          </div>
          <div className="h-[5px] overflow-hidden rounded-full bg-[#261f28]">
            <div className="h-full rounded-full bg-primary" style={{ width: "62%" }} />
          </div>
        </div>

        <div className="flex items-center gap-[10px] border-t border-vanda-line-2 px-1.5 pt-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-t-0 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pt-0">
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: "size-[30px]",
                userButtonTrigger: "rounded-full focus:shadow-none",
              },
            }}
          />
          <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-[12.5px] font-semibold">
              {user?.fullName ?? user?.username ?? "Minha conta"}
            </span>
            <span className="block truncate text-[11px] text-vanda-muted-2">
              {user?.primaryEmailAddress?.emailAddress ?? ""}
            </span>
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
