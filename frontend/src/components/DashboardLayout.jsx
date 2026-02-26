import { useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Target,
  Bell,
  Settings,
  FileCode,
  Activity,
  ChevronLeft,
  ChevronRight,
  Zap,
  Server,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import { Toaster } from "../components/ui/sonner";
import { triggerRunAll } from "../lib/api";
import { toast } from "sonner";

const NAV_ITEMS = [
  { path: "/", label: "Overview", icon: LayoutDashboard, testId: "nav-overview" },
  { path: "/targets", label: "Targets", icon: Target, testId: "nav-targets" },
  { path: "/alerts", label: "Alerts", icon: Bell, testId: "nav-alerts" },
  { path: "/config", label: "Config", icon: FileCode, testId: "nav-config" },
  { path: "/setup", label: "Setup Guide", icon: Server, testId: "nav-setup" },
];

export default function DashboardLayout({ children }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [running, setRunning] = useState(false);

  const handleRunAll = useCallback(async () => {
    setRunning(true);
    try {
      const result = await triggerRunAll();
      toast.success(
        `Checks complete: ${result.successes} passed, ${result.failures} failed`
      );
    } catch (err) {
      toast.error("Failed to run checks: " + (err.response?.data?.detail || err.message));
    } finally {
      setRunning(false);
    }
  }, []);

  return (
    <div className="flex min-h-screen bg-[#0A0A0A]" data-testid="dashboard-layout">
      <Toaster theme="dark" position="top-right" richColors />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-40 flex flex-col border-r border-border/40 bg-[#0f0f0f] transition-all duration-200 ${
          collapsed ? "w-16" : "w-56"
        }`}
        data-testid="sidebar"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border/40">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-white/5">
            <Activity className="w-4 h-4 text-green-500" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-foreground">
                Route Sentinel
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                v1.0
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={item.testId}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-white/[0.08] text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Run All Button */}
        <div className="px-2 pb-2">
          <Button
            data-testid="run-all-btn"
            variant="outline"
            size={collapsed ? "icon" : "sm"}
            className="w-full border-green-500/20 text-green-500 hover:bg-green-500/10 hover:text-green-400"
            onClick={handleRunAll}
            disabled={running}
          >
            <Zap className={`w-4 h-4 ${running ? "animate-spin" : ""}`} />
            {!collapsed && (
              <span className="ml-2">{running ? "Running..." : "Run All"}</span>
            )}
          </Button>
        </div>

        <Separator className="opacity-40" />

        {/* Collapse toggle */}
        <button
          data-testid="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-10 text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </aside>

      {/* Main content */}
      <main
        className={`flex-1 transition-all duration-200 ${
          collapsed ? "ml-16" : "ml-56"
        }`}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-6 border-b border-border/40 backdrop-blur-md bg-[#0A0A0A]/80">
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] font-mono"
              data-testid="system-status-badge"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse-dot" />
              LIVE
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">
              Synthetic Monitor
            </span>
          </div>
        </header>

        {/* Page content */}
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
