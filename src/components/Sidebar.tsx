import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Database,
  Tags,
  Users,
  Download,
  Settings,
  Plus,
  Layers,
  ClipboardList,
  Workflow,
  Activity,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import vlLogo from "@/assets/VL-logo.svg";
import { Button } from "./ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFiles } from "@/hooks/useFiles";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

const STORAGE_LIMIT = 5 * 1024 * 1024 * 1024; // 5 GB

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Layers, label: "Projects", href: "/projects" },
  { icon: Database, label: "Data", href: "/data" },
  { icon: ClipboardList, label: "Tasks", href: "/tasks" },
  
  { icon: Workflow, label: "Pipelines", href: "/pipelines" },
  { icon: Activity, label: "Pipeline Runs", href: "/pipeline-runs" },
  { icon: Download, label: "Exports", href: "/exports" },
  { icon: Users, label: "Team", href: "/team" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { files } = useFiles(user?.id);
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem("sidebar-collapsed", String(!c));
      return !c;
    });
  };

  const totalStorage = files.reduce((sum, f) => sum + (f.size || 0), 0);
  const storagePercent = Math.min((totalStorage / STORAGE_LIMIT) * 100, 100);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Guest';
  const displayEmail = user?.email || 'Not signed in';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 sticky top-0 shrink-0",
          collapsed ? "w-[68px]" : "w-64",
          className
        )}
      >
        {/* Logo */}
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border w-full cursor-pointer hover:bg-sidebar-accent/30 transition-colors overflow-hidden"
        >
          <img src={vlLogo} alt="Veri Label" className="h-9 w-9 rounded-lg shrink-0" />
          {!collapsed && (
            <div className="text-left min-w-0">
              <h1 className="font-bold text-lg">Veri Label</h1>
              <p className="text-xs text-muted-foreground">AI Annotation Platform</p>
            </div>
          )}
        </button>

        {/* New Project Button */}
        <div className="px-3 py-4">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="gradient" size="icon" className="w-full" onClick={() => navigate("/projects?create=true")}>
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">New Project</TooltipContent>
            </Tooltip>
          ) : (
            <Button variant="gradient" className="w-full" onClick={() => navigate("/projects?create=true")}>
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const btn = (
              <button
                key={item.href}
                onClick={() => !item.disabled && navigate(item.href)}
                disabled={item.disabled}
                className={cn(
                  "flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200 w-full text-left",
                  collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                  item.disabled
                    ? "text-muted-foreground/50 cursor-not-allowed"
                    : isActive
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isActive && "text-primary"
                  )}
                />
                {!collapsed && (
                  <>
                    {item.label}
                    {isActive && (
                      <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </>
                )}
              </button>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{btn}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }
            return btn;
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="px-3 py-2">
          <button
            onClick={toggleCollapsed}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors w-full"
          >
            {collapsed ? (
              <PanelLeft className="h-5 w-5 shrink-0 mx-auto" />
            ) : (
              <>
                <PanelLeftClose className="h-5 w-5 shrink-0" />
                Collapse
              </>
            )}
          </button>
        </div>

        {/* Usage Stats */}
        {!collapsed && (
          <div className="px-4 py-4 border-t border-sidebar-border">
            <div className="rounded-lg bg-secondary/50 p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Storage Used</span>
                <span className="font-medium">{formatBytes(totalStorage)}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full gradient-primary rounded-full transition-all duration-500"
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{formatBytes(totalStorage)} of {formatBytes(STORAGE_LIMIT)} used</p>
            </div>
          </div>
        )}

        {/* User */}
        <div className={cn("py-4 border-t border-sidebar-border", collapsed ? "px-2" : "px-4")}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate("/settings")}
                  className="flex items-center justify-center w-full rounded-lg py-1 transition-colors hover:bg-sidebar-accent/50 cursor-pointer"
                >
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-semibold text-primary-foreground shrink-0">
                    {initials}
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{displayName}</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={() => navigate("/settings")}
              className="flex items-center gap-3 w-full rounded-lg px-1 py-1 transition-colors hover:bg-sidebar-accent/50 cursor-pointer"
            >
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-semibold text-primary-foreground shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
              </div>
            </button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
