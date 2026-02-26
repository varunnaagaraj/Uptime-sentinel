import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Target,
  Bell,
  TrendingUp,
  ArrowRight,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
} from "recharts";
import { getOverview } from "../lib/api";
import { format, parseISO } from "date-fns";

function MetricCard({ title, value, subtitle, icon: Icon, trend, status, testId }) {
  const statusColors = {
    success: "text-green-500",
    warning: "text-yellow-500",
    error: "text-red-500",
    info: "text-blue-500",
    neutral: "text-muted-foreground",
  };

  return (
    <Card
      className="bg-[#111111] border-border/40 hover:border-border/60 transition-colors"
      data-testid={testId}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <p className="text-2xl font-semibold tracking-tight font-mono">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div
            className={`p-2 rounded-md bg-white/[0.04] ${
              statusColors[status] || statusColors.neutral
            }`}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {trend !== undefined && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            <TrendingUp className="w-3 h-3 text-green-500" />
            <span className="text-green-500">{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentRunsTable({ runs }) {
  if (!runs || runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Activity className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-sm">No route runs yet</p>
        <p className="text-xs mt-1">Click "Run All" to start monitoring</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {runs.map((run) => (
        <Link
          key={run.id}
          to={`/targets/${run.target_id}`}
          className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-white/[0.03] transition-colors group"
          data-testid={`recent-run-${run.id}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {run.status === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm truncate">{run.target_name}</p>
              <p className="text-xs text-muted-foreground truncate font-mono">
                {run.route_name} - {run.route_path}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-mono text-muted-foreground">
              {run.duration_ms}ms
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {run.timestamp ? format(parseISO(run.timestamp), "HH:mm:ss") : ""}
            </span>
            <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </Link>
      ))}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#18181b] border border-[#3f3f46] rounded-md px-3 py-2 text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" ? Math.round(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
};

export default function OverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const result = await getOverview();
      setData(result);
    } catch (err) {
      console.error("Failed to load overview:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6" data-testid="overview-loading">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 bg-[#111111]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 bg-[#111111] lg:col-span-2" />
          <Skeleton className="h-64 bg-[#111111]" />
        </div>
      </div>
    );
  }

  const hourlyData = (data?.hourly_stats || []).map((h) => ({
    hour: h._id ? h._id.split("T")[1] || h._id.slice(-2) + ":00" : "",
    successes: h.successes,
    failures: h.failures,
    total: h.total,
    avg_duration: Math.round(h.avg_duration || 0),
  }));

  return (
    <div className="space-y-8" data-testid="overview-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time synthetic monitoring health
        </p>
      </div>

      {/* Config warning */}
      {!data?.config_loaded && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm"
          data-testid="config-warning"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          No monitoring config loaded. Add a config file or reload.
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Targets"
          value={data?.enabled_targets || 0}
          subtitle={`${data?.total_targets || 0} total configured`}
          icon={Target}
          status="info"
          testId="metric-targets"
        />
        <MetricCard
          title="Success Rate"
          value={`${data?.success_rate || 0}%`}
          subtitle={`${data?.success_runs || 0} / ${data?.total_runs || 0} checks`}
          icon={CheckCircle2}
          status={data?.success_rate >= 95 ? "success" : data?.success_rate >= 80 ? "warning" : "error"}
          testId="metric-success-rate"
        />
        <MetricCard
          title="Avg Response"
          value={`${Math.round(data?.avg_duration_ms || 0)}ms`}
          subtitle="Across all routes"
          icon={Clock}
          status="neutral"
          testId="metric-avg-response"
        />
        <MetricCard
          title="Active Alerts"
          value={data?.active_alerts || 0}
          subtitle="Triggered or firing"
          icon={Bell}
          status={data?.active_alerts > 0 ? "error" : "success"}
          testId="metric-active-alerts"
        />
      </div>

      {/* Charts + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Chart */}
        <Card className="bg-[#111111] border-border/40 lg:col-span-2" data-testid="hourly-chart">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              Check Results (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hourlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hourlyData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="successes"
                    name="Success"
                    fill="#22C55E"
                    radius={[2, 2, 0, 0]}
                    maxBarSize={16}
                  />
                  <Bar
                    dataKey="failures"
                    name="Failures"
                    fill="#EF4444"
                    radius={[2, 2, 0, 0]}
                    maxBarSize={16}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
                No data yet. Run a check to see results.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scheduler Status */}
        <Card className="bg-[#111111] border-border/40" data-testid="scheduler-status">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              Scheduler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  data?.scheduler?.running
                    ? "bg-green-500 animate-pulse-dot"
                    : "bg-red-500"
                }`}
              />
              <span className="text-sm">
                {data?.scheduler?.running ? "Running" : "Stopped"}
              </span>
            </div>
            {data?.scheduler?.jobs?.map((job) => (
              <div
                key={job.id}
                className="px-3 py-2 rounded-md bg-white/[0.03] border border-border/20"
              >
                <p className="text-xs font-medium truncate">{job.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono mt-1">
                  Next: {job.next_run ? format(parseISO(job.next_run), "HH:mm:ss") : "N/A"}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  Every {job.interval_minutes}min
                </p>
              </div>
            ))}
            {(!data?.scheduler?.jobs || data.scheduler.jobs.length === 0) && (
              <p className="text-xs text-muted-foreground">No scheduled jobs</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Runs */}
      <Card className="bg-[#111111] border-border/40" data-testid="recent-runs">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Recent Runs</CardTitle>
            <Link
              to="/targets"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <RecentRunsTable runs={data?.recent_runs} />
        </CardContent>
      </Card>
    </div>
  );
}
