import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Target,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Play,
  Globe,
  Tag,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { getTargets, triggerRunTarget } from "../lib/api";
import { toast } from "sonner";

const STATUS_CONFIG = {
  healthy: {
    icon: CheckCircle2,
    label: "Healthy",
    className: "bg-green-500/10 text-green-500 border-green-500/20",
    glow: "glow-success",
  },
  degraded: {
    icon: AlertTriangle,
    label: "Degraded",
    className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    glow: "glow-warning",
  },
  critical: {
    icon: XCircle,
    label: "Critical",
    className: "bg-red-500/10 text-red-500 border-red-500/20",
    glow: "glow-error",
  },
  unknown: {
    icon: Clock,
    label: "Unknown",
    className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    glow: "",
  },
};

function TargetCard({ target }) {
  const [running, setRunning] = useState(false);
  const statusConf = STATUS_CONFIG[target.status] || STATUS_CONFIG.unknown;
  const StatusIcon = statusConf.icon;

  const handleRun = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setRunning(true);
    try {
      const result = await triggerRunTarget(target.id);
      toast.success(
        `${target.name}: ${result.successes} passed, ${result.failures} failed`
      );
    } catch (err) {
      toast.error("Check failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Link to={`/targets/${target.id}`} data-testid={`target-card-${target.id}`}>
      <Card
        className={`bg-[#111111] border-border/40 hover:border-border/60 transition-all group cursor-pointer ${statusConf.glow}`}
      >
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-md ${
                  target.status === "healthy"
                    ? "bg-green-500/10"
                    : target.status === "critical"
                    ? "bg-red-500/10"
                    : "bg-yellow-500/10"
                }`}
              >
                <Globe className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-medium tracking-tight">{target.name}</h3>
                <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px]">
                  {target.base_url}
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold ${statusConf.className}`}
              data-testid={`target-status-${target.id}`}
            >
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConf.label}
            </Badge>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Routes
              </p>
              <p className="text-sm font-mono font-medium mt-0.5">
                {target.routes?.length || 0}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Checks
              </p>
              <p className="text-sm font-mono font-medium mt-0.5">
                {target.total_checks || 0}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Success
              </p>
              <p
                className={`text-sm font-mono font-medium mt-0.5 ${
                  target.success_rate >= 95
                    ? "text-green-500"
                    : target.success_rate >= 80
                    ? "text-yellow-500"
                    : "text-red-500"
                }`}
              >
                {target.success_rate || 0}%
              </p>
            </div>
          </div>

          {/* Tags */}
          {target.tags && target.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {target.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-white/[0.04] text-muted-foreground"
                >
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border/20">
            <span className="text-[10px] text-muted-foreground font-mono">
              Every {target.interval_minutes}min
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={handleRun}
                disabled={running}
                data-testid={`run-target-${target.id}`}
              >
                <Play className={`w-3 h-3 mr-1 ${running ? "animate-spin" : ""}`} />
                {running ? "Running" : "Run Now"}
              </Button>
              <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function TargetsPage() {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTargets = useCallback(async () => {
    try {
      const result = await getTargets();
      setTargets(result);
    } catch (err) {
      console.error("Failed to load targets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTargets();
    const interval = setInterval(fetchTargets, 10000);
    return () => clearInterval(interval);
  }, [fetchTargets]);

  if (loading) {
    return (
      <div className="space-y-6" data-testid="targets-loading">
        <Skeleton className="h-8 w-48 bg-[#111111]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64 bg-[#111111]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="targets-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Targets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {targets.length} monitoring target{targets.length !== 1 ? "s" : ""} configured
          </p>
        </div>
      </div>

      {targets.length === 0 ? (
        <Card className="bg-[#111111] border-border/40">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Target className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No targets configured</p>
            <p className="text-xs mt-1">
              Add targets to your monitor_config.json file
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {targets.map((target) => (
            <TargetCard key={target.id} target={target} />
          ))}
        </div>
      )}
    </div>
  );
}
