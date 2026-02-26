import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Clock,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { getAlerts, getActiveAlerts } from "../lib/api";
import { format, parseISO } from "date-fns";

const STATE_ICONS = {
  ok: CheckCircle2,
  triggered: AlertTriangle,
  alerted: XCircle,
  resolved: CheckCircle2,
};

const STATE_COLORS = {
  ok: "text-green-500",
  triggered: "text-yellow-500",
  alerted: "text-red-500",
  resolved: "text-green-500",
};

const TRANSITION_COLORS = {
  alerted: "border-red-500/30 bg-red-500/5",
  resolved: "border-green-500/30 bg-green-500/5",
  triggered: "border-yellow-500/30 bg-yellow-500/5",
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 30;

  const fetchAlerts = useCallback(async () => {
    try {
      const [alertsResult, activeResult] = await Promise.all([
        getAlerts({ limit, offset }),
        getActiveAlerts(),
      ]);
      setAlerts(alertsResult.alerts);
      setTotal(alertsResult.total);
      setActiveAlerts(activeResult);
    } catch (err) {
      console.error("Failed to load alerts:", err);
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  if (loading) {
    return (
      <div className="space-y-6" data-testid="alerts-loading">
        <Skeleton className="h-8 w-48 bg-[#111111]" />
        <Skeleton className="h-24 bg-[#111111]" />
        <Skeleton className="h-96 bg-[#111111]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="alerts-page">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Alert state machine transitions and notification history
        </p>
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <Card className="bg-[#111111] border-red-500/20 glow-error" data-testid="active-alerts-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2 text-red-500">
              <Bell className="w-4 h-4" />
              Active Alerts ({activeAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeAlerts.map((alert, i) => {
              const Icon = STATE_ICONS[alert.state] || AlertTriangle;
              return (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2.5 rounded-md bg-red-500/5 border border-red-500/10"
                  data-testid={`active-alert-${i}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${STATE_COLORS[alert.state]}`} />
                    <div>
                      <p className="text-sm font-medium">{alert.target_id}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {alert.route_path}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px]"
                    >
                      {alert.consecutive_failures} consecutive failures
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase"
                    >
                      {alert.state}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {activeAlerts.length === 0 && (
        <Card className="bg-[#111111] border-green-500/20 glow-success" data-testid="no-active-alerts">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-sm font-medium text-green-500">All Clear</p>
              <p className="text-xs text-muted-foreground">
                No active alerts. All targets operating normally.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert History */}
      <Card className="bg-[#111111] border-border/40" data-testid="alert-history-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Alert History ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length > 0 ? (
            <div className="space-y-2">
              {alerts.map((alert, i) => {
                const toState = alert.to_state || "unknown";
                const colorClass = TRANSITION_COLORS[toState] || "border-border/20 bg-white/[0.02]";
                const ToIcon = STATE_ICONS[toState] || AlertTriangle;

                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-4 py-3 rounded-md border ${colorClass}`}
                    data-testid={`alert-history-${i}`}
                  >
                    <div className="flex items-center gap-3">
                      <ToIcon
                        className={`w-4 h-4 ${STATE_COLORS[toState]}`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            {alert.target_name || alert.target_id}
                          </p>
                          <span className="text-xs font-mono text-muted-foreground">
                            {alert.route_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase ${STATE_COLORS[alert.from_state]}`}
                          >
                            {alert.from_state}
                          </Badge>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase ${STATE_COLORS[toState]}`}
                          >
                            {toState}
                          </Badge>
                        </div>
                        {alert.error_message && (
                          <p className="text-xs text-red-400 font-mono mt-1 truncate max-w-[400px]">
                            {alert.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {alert.timestamp
                          ? format(parseISO(alert.timestamp), "MMM d, HH:mm:ss")
                          : ""}
                      </span>
                      {alert.notification_sent && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20"
                        >
                          Notified
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {alert.consecutive_failures} failures
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No alert history</p>
              <p className="text-xs mt-1">
                Alerts are triggered after consecutive failures
              </p>
            </div>
          )}

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/20">
              <span className="text-xs text-muted-foreground">
                Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  data-testid="alerts-prev"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  disabled={offset + limit >= total}
                  onClick={() => setOffset(offset + limit)}
                  data-testid="alerts-next"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
