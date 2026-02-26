import { useState, useEffect, useCallback } from "react";
import {
  FileCode,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { getConfig, reloadConfig } from "../lib/api";
import { toast } from "sonner";

function syntaxHighlight(json) {
  if (typeof json !== "string") {
    json = JSON.stringify(json, null, 2);
  }
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    function (match) {
      let cls = "text-blue-400"; // number
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = "text-yellow-300"; // key
        } else if (match.includes("REDACTED")) {
          cls = "text-red-400"; // redacted
        } else {
          cls = "text-green-400"; // string
        }
      } else if (/true|false/.test(match)) {
        cls = match === "true" ? "text-green-400" : "text-red-400"; // boolean
      } else if (/null/.test(match)) {
        cls = "text-zinc-500"; // null
      }
      return '<span class="' + cls + '">' + match + "</span>";
    }
  );
}

export default function ConfigPage() {
  const [configData, setConfigData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const result = await getConfig();
      setConfigData(result);
    } catch (err) {
      console.error("Failed to load config:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleReload = async () => {
    setReloading(true);
    try {
      const result = await reloadConfig();
      toast.success("Config reloaded successfully");
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach((w) => toast.warning(w));
      }
      fetchConfig();
    } catch (err) {
      toast.error(
        "Reload failed: " + (err.response?.data?.detail || err.message)
      );
    } finally {
      setReloading(false);
    }
  };

  const handleCopy = () => {
    if (configData?.config) {
      navigator.clipboard.writeText(JSON.stringify(configData.config, null, 2));
      toast.success("Config copied to clipboard");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="config-loading">
        <Skeleton className="h-8 w-48 bg-[#111111]" />
        <Skeleton className="h-96 bg-[#111111]" />
      </div>
    );
  }

  const highlightedJson = configData?.config
    ? syntaxHighlight(configData.config)
    : "";

  return (
    <div className="space-y-6" data-testid="config-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Configuration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Read-only view of the monitoring configuration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={handleCopy}
            data-testid="copy-config-btn"
          >
            <Copy className="w-3.5 h-3.5 mr-1" />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-blue-500/20 text-blue-400 hover:bg-blue-500/10"
            onClick={handleReload}
            disabled={reloading}
            data-testid="reload-config-btn"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1 ${reloading ? "animate-spin" : ""}`}
            />
            {reloading ? "Reloading..." : "Reload"}
          </Button>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-4">
        <Badge
          variant="outline"
          className={`text-xs ${
            configData?.loaded
              ? "bg-green-500/10 text-green-500 border-green-500/20"
              : "bg-red-500/10 text-red-500 border-red-500/20"
          }`}
          data-testid="config-status-badge"
        >
          {configData?.loaded ? (
            <>
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Config Loaded
            </>
          ) : (
            <>
              <AlertTriangle className="w-3 h-3 mr-1" />
              No Config
            </>
          )}
        </Badge>
      </div>

      {/* Warnings */}
      {configData?.warnings?.length > 0 && (
        <Card className="bg-[#111111] border-yellow-500/20">
          <CardContent className="p-4 space-y-2">
            {configData.warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs text-yellow-500"
              >
                <AlertTriangle className="w-3 h-3 shrink-0" />
                {w}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Config Viewer */}
      {configData?.config ? (
        <Card className="bg-[#111111] border-border/40" data-testid="config-viewer">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <FileCode className="w-4 h-4 text-muted-foreground" />
              monitor_config.json
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre
              className="font-mono text-xs bg-[#0c0c0c] border border-border/30 rounded-md p-4 max-h-[600px] overflow-auto leading-relaxed"
              dangerouslySetInnerHTML={{ __html: highlightedJson }}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-[#111111] border-border/40">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FileCode className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No configuration loaded</p>
            <p className="text-xs mt-1">
              Create a monitor_config.json file and reload
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
