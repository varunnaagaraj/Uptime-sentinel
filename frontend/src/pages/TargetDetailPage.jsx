import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Globe,
  Play,
  Terminal,
  Image,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
} from "recharts";
import { getTarget, triggerRunTarget, getScreenshotUrl } from "../lib/api";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#18181b] border border-[#3f3f46] rounded-md px-3 py-2 text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" ? Math.round(entry.value) : entry.value}
          {entry.name === "Duration" ? "ms" : ""}
        </p>
      ))}
    </div>
  );
};

function RunItem({ run }) {
  const [expanded, setExpanded] = useState(false);
  const [screenshotOpen, setScreenshotOpen] = useState(false);

  return (
    <>
      <div
        className="relative border-l-2 pl-6 pb-6 ml-3 group"
        style={{
          borderColor: run.status === "success" ? "#22C55E" : "#EF4444",
        }}
        data-testid={`run-item-${run.id}`}
      >
        {/* Dot */}
        <div
          className="absolute -left-[5px] top-1 w-2 h-2 rounded-full"
          style={{
            backgroundColor: run.status === "success" ? "#22C55E" : "#EF4444",
          }}
        />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              {run.status === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm font-medium">{run.route_name}</span>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  run.status === "success"
                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                    : "bg-red-500/10 text-red-500 border-red-500/20"
                }`}
              >
                {run.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              {run.full_url}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono text-muted-foreground">
              {run.duration_ms}ms
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {run.timestamp ? format(parseISO(run.timestamp), "MMM d, HH:mm:ss") : ""}
            </span>
          </div>
        </div>

        {/* Error message */}
        {run.error_message && (
          <div className="mt-2 px-3 py-2 rounded-md bg-red-500/5 border border-red-500/10 text-xs text-red-400 font-mono">
            {run.error_message}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2">
          {run.screenshot_path && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => setScreenshotOpen(true)}
              data-testid={`view-screenshot-${run.id}`}
            >
              <Image className="w-3 h-3 mr-1" />
              Screenshot
            </Button>
          )}
          {(run.console_logs?.length > 0 || run.js_errors?.length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(!expanded)}
              data-testid={`toggle-logs-${run.id}`}
            >
              <Terminal className="w-3 h-3 mr-1" />
              Logs ({(run.console_logs?.length || 0) + (run.js_errors?.length || 0)})
              {expanded ? (
                <ChevronUp className="w-3 h-3 ml-1" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-1" />
              )}
            </Button>
          )}
          {run.http_status && (
            <Badge variant="outline" className="text-[10px] h-5">
              HTTP {run.http_status}
            </Badge>
          )}
          {run.auth_used && (
            <Badge variant="outline" className="text-[10px] h-5 bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
              Authenticated
            </Badge>
          )}
        </div>

        {/* Expanded logs */}
        {expanded && (
          <div className="mt-3 rounded-md bg-[#0c0c0c] border border-border/30 p-3 max-h-[300px] overflow-auto">
            {run.js_errors?.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-red-500 uppercase tracking-wider mb-1">
                  JS Errors
                </p>
                {run.js_errors.map((err, i) => (
                  <p key={i} className="text-xs font-mono text-red-400 log-line px-1 py-0.5">
                    {err.message}
                  </p>
                ))}
              </div>
            )}
            {run.console_logs?.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Console
                </p>
                {run.console_logs.map((log, i) => (
                  <p
                    key={i}
                    className={`text-xs font-mono log-line px-1 py-0.5 ${
                      log.type === "error"
                        ? "text-red-400"
                        : log.type === "warning"
                        ? "text-yellow-400"
                        : "text-gray-400"
                    }`}
                  >
                    [{log.type}] {log.text}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Screenshot Dialog */}
      <Dialog open={screenshotOpen} onOpenChange={setScreenshotOpen}>
        <DialogContent className="max-w-4xl bg-[#111111] border-border/40">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Screenshot: {run.route_name}
            </DialogTitle>
          </DialogHeader>
          <div className="aspect-video bg-[#0c0c0c] rounded-md overflow-hidden">
            <img
              src={getScreenshotUrl(run.screenshot_path)}
              alt={`Screenshot of ${run.route_name}`}
              className="w-full h-full object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function TargetDetailPage() {
  const { targetId } = useParams();
  const [target, setTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchTarget = useCallback(async () => {
    try {
      const result = await getTarget(targetId);
      setTarget(result);
    } catch (err) {
      console.error("Failed to load target:", err);
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  useEffect(() => {
    fetchTarget();
    const interval = setInterval(fetchTarget, 10000);
    return () => clearInterval(interval);
  }, [fetchTarget]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const result = await triggerRunTarget(targetId);
      toast.success(
        `${result.successes} passed, ${result.failures} failed`
      );
      fetchTarget();
    } catch (err) {
      toast.error("Check failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="target-detail-loading">
        <Skeleton className="h-8 w-64 bg-[#111111]" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 bg-[#111111] lg:col-span-2" />
          <Skeleton className="h-96 bg-[#111111]" />
        </div>
      </div>
    );
  }

  if (!target) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p>Target not found</p>
        <Link to="/targets" className="text-sm text-blue-400 mt-2">
          Back to targets
        </Link>
      </div>
    );
  }

  const durationData = (target.duration_trend || [])
    .slice()
    .reverse()
    .map((d) => ({
      time: d.timestamp ? format(parseISO(d.timestamp), "HH:mm") : "",
      duration: d.duration_ms,
      status: d.status,
      route: d.route_name,
    }));

  const successData = (() => {
    const runs = target.recent_runs || [];
    const grouped = {};
    runs.forEach((r) => {
      const key = r.timestamp ? r.timestamp.substring(0, 13) : "unknown";
      if (!grouped[key]) grouped[key] = { total: 0, success: 0 };
      grouped[key].total++;
      if (r.status === "success") grouped[key].success++;
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        time: key.split("T")[1] || key,
        rate: Math.round((val.success / val.total) * 100),
      }));
  })();

  return (
    <div className="space-y-6" data-testid="target-detail-page">
      {/* Breadcrumb + Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          to="/targets"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          data-testid="back-to-targets"
        >
          <ArrowLeft className="w-4 h-4" />
          Targets
        </Link>
        <span>/</span>
        <span className="text-foreground">{target.name}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {target.name}
            </h1>
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold ${
                target.status === "healthy"
                  ? "bg-green-500/10 text-green-500 border-green-500/20"
                  : target.status === "critical"
                  ? "bg-red-500/10 text-red-500 border-red-500/20"
                  : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
              }`}
              data-testid="target-detail-status"
            >
              {target.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
            <a
              href={target.base_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground font-mono flex items-center gap-1"
            >
              {target.base_url}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-green-500/20 text-green-500 hover:bg-green-500/10"
          onClick={handleRun}
          disabled={running}
          data-testid="run-target-btn"
        >
          <Play className={`w-4 h-4 mr-1 ${running ? "animate-spin" : ""}`} />
          {running ? "Running..." : "Run Now"}
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-[#111111] border-border/40">
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Routes
            </p>
            <p className="text-xl font-mono font-semibold mt-1">
              {target.routes?.length || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#111111] border-border/40">
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Total Checks
            </p>
            <p className="text-xl font-mono font-semibold mt-1">
              {target.total_checks || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#111111] border-border/40">
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Success Rate
            </p>
            <p
              className={`text-xl font-mono font-semibold mt-1 ${
                target.success_rate >= 95
                  ? "text-green-500"
                  : target.success_rate >= 80
                  ? "text-yellow-500"
                  : "text-red-500"
              }`}
            >
              {target.success_rate}%
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#111111] border-border/40">
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Auth
            </p>
            <p className="text-xl font-mono font-semibold mt-1 capitalize">
              {target.auth_strategy || "none"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="bg-[#111111] border border-border/40">
          <TabsTrigger value="timeline" data-testid="tab-timeline">
            Timeline
          </TabsTrigger>
          <TabsTrigger value="charts" data-testid="tab-charts">
            Charts
          </TabsTrigger>
          <TabsTrigger value="routes" data-testid="tab-routes">
            Routes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4">
          <Card className="bg-[#111111] border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                Route Run Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {target.recent_runs?.length > 0 ? (
                <div className="space-y-0">
                  {target.recent_runs.map((run) => (
                    <RunItem key={run.id} run={run} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Clock className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">No runs yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Response Time Chart */}
            <Card className="bg-[#111111] border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">
                  Response Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                {durationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={durationData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#27272a"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: "#71717a", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#71717a", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="duration"
                        name="Duration"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                    No data
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Success Rate Chart */}
            <Card className="bg-[#111111] border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">
                  Success Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                {successData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={successData}>
                      <defs>
                        <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22C55E" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#27272a"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: "#71717a", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: "#71717a", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="rate"
                        name="Success %"
                        stroke="#22C55E"
                        fill="url(#successGrad)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                    No data
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="routes" className="mt-4">
          <Card className="bg-[#111111] border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                Configured Routes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {target.routes?.map((route, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2.5 rounded-md bg-white/[0.02] border border-border/20"
                    data-testid={`route-config-${i}`}
                  >
                    <div>
                      <p className="text-sm font-medium">{route.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {route.method || "GET"} {route.path}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {route.maxLoadTimeMs && (
                        <span className="font-mono">
                          max {route.maxLoadTimeMs}ms
                        </span>
                      )}
                      {route.requiredSelectors?.length > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {route.requiredSelectors.length} selector{route.requiredSelectors.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
