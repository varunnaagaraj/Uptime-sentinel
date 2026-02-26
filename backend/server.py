"""
Route Sentinel - Production-Grade Synthetic UI Monitoring Appliance
FastAPI backend with MongoDB storage, Playwright-based synthetic checks,
deterministic alert state machine, and config-driven architecture.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone

from monitor.config_validator import (
    load_config,
    validate_config,
    validate_config_strict,
    resolve_env_credentials,
    sanitize_config_for_display,
)
from monitor.runner import run_all_checks, run_target_checks
from monitor.alert_engine import process_check_result, get_alert_state
from monitor.scheduler import (
    init_scheduler,
    schedule_targets,
    start_scheduler,
    stop_scheduler,
    get_scheduler_status,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# MongoDB connection
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# Config
SCREENSHOT_DIR = ROOT_DIR / "screenshots"
SCREENSHOT_DIR.mkdir(exist_ok=True)
CONFIG_PATH = ROOT_DIR / "config" / "monitor_config.json"

# Load and validate config at startup
monitor_config = None
config_warnings = []

app = FastAPI(title="Route Sentinel", version="1.0.0")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# ─── Startup / Shutdown ────────────────────────────────────────

@app.on_event("startup")
async def startup():
    global monitor_config, config_warnings
    try:
        monitor_config = load_config(CONFIG_PATH)
        validate_config_strict(monitor_config)
        config_warnings = resolve_env_credentials(monitor_config)

        if config_warnings:
            for w in config_warnings:
                logger.warning(f"Config warning: {w}")

        # Sync targets to MongoDB
        await sync_targets_to_db(monitor_config)

        # Create indices
        await create_indices()

        # Init & start scheduler
        init_scheduler(db, monitor_config)
        schedule_targets(monitor_config)
        start_scheduler()

        logger.info("Route Sentinel started successfully")

    except FileNotFoundError:
        logger.warning("No config file found. Running in unconfigured mode.")
        monitor_config = None
    except ValueError as e:
        logger.error(f"Config validation failed: {e}")
        monitor_config = None
    except Exception as e:
        logger.error(f"Startup error: {e}")
        monitor_config = None


@app.on_event("shutdown")
async def shutdown():
    stop_scheduler()
    client.close()


async def create_indices():
    """Create MongoDB indices for performance."""
    await db.route_runs.create_index([("target_id", 1), ("timestamp", -1)])
    await db.route_runs.create_index([("status", 1)])
    await db.route_runs.create_index([("timestamp", -1)])
    await db.alert_state.create_index([("target_id", 1), ("route_path", 1)], unique=True)
    await db.alert_history.create_index([("target_id", 1), ("timestamp", -1)])
    await db.alert_history.create_index([("timestamp", -1)])
    await db.targets.create_index([("id", 1)], unique=True)


async def sync_targets_to_db(config: dict):
    """Sync target configs to MongoDB for dashboard queries."""
    for target in config.get("targets", []):
        await db.targets.update_one(
            {"id": target["id"]},
            {"$set": {
                "id": target["id"],
                "name": target["name"],
                "base_url": target["baseUrl"],
                "enabled": target.get("enabled", True),
                "tags": target.get("tags", []),
                "interval_minutes": target.get("intervalMinutes",
                    config.get("global", {}).get("defaultIntervalMinutes", 5)),
                "routes": target.get("routes", []),
                "auth_strategy": target.get("auth", {}).get("strategy", "none"),
                "synced_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )


# ─── API: Overview ─────────────────────────────────────────────

@api_router.get("/overview")
async def get_overview():
    """System health overview with aggregate stats."""
    total_targets = await db.targets.count_documents({})
    enabled_targets = await db.targets.count_documents({"enabled": True})

    total_runs = await db.route_runs.count_documents({})
    success_runs = await db.route_runs.count_documents({"status": "success"})
    failure_runs = await db.route_runs.count_documents({"status": "failure"})

    active_alerts = await db.alert_state.count_documents({"state": {"$in": ["triggered", "alerted"]}})

    # Recent runs (last 20)
    recent_runs = await db.route_runs.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).limit(20).to_list(20)

    # Avg duration
    pipeline = [
        {"$group": {"_id": None, "avg_duration": {"$avg": "$duration_ms"}}}
    ]
    avg_result = await db.route_runs.aggregate(pipeline).to_list(1)
    avg_duration = avg_result[0]["avg_duration"] if avg_result else 0

    # Success rate
    success_rate = (success_runs / total_runs * 100) if total_runs > 0 else 100

    # Uptime data (last 24 hours grouped by hour)
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    hourly_pipeline = [
        {"$match": {"timestamp": {"$gte": cutoff}}},
        {"$addFields": {
            "hour": {"$substr": ["$timestamp", 0, 13]}
        }},
        {"$group": {
            "_id": "$hour",
            "total": {"$sum": 1},
            "successes": {"$sum": {"$cond": [{"$eq": ["$status", "success"]}, 1, 0]}},
            "failures": {"$sum": {"$cond": [{"$eq": ["$status", "failure"]}, 1, 0]}},
            "avg_duration": {"$avg": "$duration_ms"},
        }},
        {"$sort": {"_id": 1}},
    ]
    hourly_stats = await db.route_runs.aggregate(hourly_pipeline).to_list(100)

    scheduler_status = get_scheduler_status()

    return {
        "total_targets": total_targets,
        "enabled_targets": enabled_targets,
        "total_runs": total_runs,
        "success_runs": success_runs,
        "failure_runs": failure_runs,
        "success_rate": round(success_rate, 2),
        "avg_duration_ms": round(avg_duration, 2) if avg_duration else 0,
        "active_alerts": active_alerts,
        "recent_runs": recent_runs,
        "hourly_stats": hourly_stats,
        "scheduler": scheduler_status,
        "config_loaded": monitor_config is not None,
        "config_warnings": config_warnings,
    }


# ─── API: Targets ──────────────────────────────────────────────

@api_router.get("/targets")
async def list_targets():
    """List all monitoring targets with current status."""
    targets = await db.targets.find({}, {"_id": 0}).to_list(100)

    # Enrich with latest status
    for target in targets:
        # Get latest run per route
        latest_runs = await db.route_runs.find(
            {"target_id": target["id"]},
            {"_id": 0}
        ).sort("timestamp", -1).limit(len(target.get("routes", []))).to_list(50)

        # Get alert states
        alert_states = await db.alert_state.find(
            {"target_id": target["id"]},
            {"_id": 0}
        ).to_list(50)

        # Aggregate stats for this target
        total = await db.route_runs.count_documents({"target_id": target["id"]})
        successes = await db.route_runs.count_documents({"target_id": target["id"], "status": "success"})

        target["latest_runs"] = latest_runs[:5]
        target["alert_states"] = alert_states
        target["total_checks"] = total
        target["success_rate"] = round((successes / total * 100), 2) if total > 0 else 100
        target["status"] = _derive_target_status(alert_states, latest_runs)

    return targets


@api_router.get("/targets/{target_id}")
async def get_target(target_id: str):
    """Get target detail with recent route runs."""
    target = await db.targets.find_one({"id": target_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    # Recent runs
    runs = await db.route_runs.find(
        {"target_id": target_id}, {"_id": 0}
    ).sort("timestamp", -1).limit(100).to_list(100)

    # Alert states
    alert_states = await db.alert_state.find(
        {"target_id": target_id}, {"_id": 0}
    ).to_list(50)

    # Stats
    total = await db.route_runs.count_documents({"target_id": target_id})
    successes = await db.route_runs.count_documents({"target_id": target_id, "status": "success"})

    # Duration trend
    duration_pipeline = [
        {"$match": {"target_id": target_id}},
        {"$sort": {"timestamp": -1}},
        {"$limit": 50},
        {"$project": {"_id": 0, "timestamp": 1, "duration_ms": 1, "status": 1, "route_name": 1}},
    ]
    duration_trend = await db.route_runs.aggregate(duration_pipeline).to_list(50)

    return {
        **target,
        "recent_runs": runs,
        "alert_states": alert_states,
        "total_checks": total,
        "success_rate": round((successes / total * 100), 2) if total > 0 else 100,
        "status": _derive_target_status(alert_states, runs),
        "duration_trend": duration_trend,
    }


@api_router.get("/targets/{target_id}/runs")
async def get_target_runs(
    target_id: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None),
):
    """Paginated route runs for a target."""
    query = {"target_id": target_id}
    if status:
        query["status"] = status

    runs = await db.route_runs.find(
        query, {"_id": 0}
    ).sort("timestamp", -1).skip(offset).limit(limit).to_list(limit)

    total = await db.route_runs.count_documents(query)

    return {"runs": runs, "total": total, "limit": limit, "offset": offset}


# ─── API: Individual Run ───────────────────────────────────────

@api_router.get("/runs/{run_id}")
async def get_run(run_id: str):
    """Get a single route run detail."""
    run = await db.route_runs.find_one({"id": run_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


# ─── API: Alerts ───────────────────────────────────────────────

@api_router.get("/alerts")
async def list_alerts(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Alert history with state transitions."""
    alerts = await db.alert_history.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).skip(offset).limit(limit).to_list(limit)

    total = await db.alert_history.count_documents({})

    return {"alerts": alerts, "total": total, "limit": limit, "offset": offset}


@api_router.get("/alerts/active")
async def active_alerts():
    """Currently active alerts."""
    states = await db.alert_state.find(
        {"state": {"$in": ["triggered", "alerted"]}},
        {"_id": 0}
    ).to_list(100)
    return states


# ─── API: Config ───────────────────────────────────────────────

@api_router.get("/config")
async def get_config():
    """Read-only sanitized config display."""
    if not monitor_config:
        return {"loaded": False, "config": None, "warnings": []}

    return {
        "loaded": True,
        "config": sanitize_config_for_display(monitor_config),
        "warnings": config_warnings,
    }


@api_router.post("/config/validate")
async def validate_config_endpoint(config_data: dict):
    """Validate a config against the schema."""
    errors = validate_config(config_data)
    return {
        "valid": len(errors) == 0,
        "errors": errors,
    }


@api_router.post("/config/reload")
async def reload_config():
    """Reload config from file and restart scheduler."""
    global monitor_config, config_warnings
    try:
        new_config = load_config(CONFIG_PATH)
        validate_config_strict(new_config)
        config_warnings = resolve_env_credentials(new_config)
        monitor_config = new_config

        await sync_targets_to_db(monitor_config)
        init_scheduler(db, monitor_config)
        schedule_targets(monitor_config)

        return {"success": True, "warnings": config_warnings}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── API: Screenshots ─────────────────────────────────────────

@api_router.get("/screenshots/{filename}")
async def get_screenshot(filename: str):
    """Serve screenshot images."""
    filepath = SCREENSHOT_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Screenshot not found")
    if not filepath.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
        raise HTTPException(status_code=400, detail="Invalid file type")
    return FileResponse(str(filepath), media_type="image/png")


# ─── API: Manual Run ──────────────────────────────────────────

@api_router.post("/monitor/run-all")
async def trigger_run_all():
    """Manually trigger checks for all enabled targets."""
    if not monitor_config:
        raise HTTPException(status_code=400, detail="No config loaded")

    results = await run_all_checks(monitor_config)
    alerting_config = monitor_config.get("alerting", {})

    for result in results:
        doc = {k: v for k, v in result.items()}
        await db.route_runs.insert_one(doc)
        await process_check_result(db, result, alerting_config)

    # Update targets
    for target in monitor_config.get("targets", []):
        await db.targets.update_one(
            {"id": target["id"]},
            {"$set": {"last_checked_at": datetime.now(timezone.utc).isoformat()}}
        )

    return {
        "success": True,
        "total_checks": len(results),
        "successes": sum(1 for r in results if r["status"] == "success"),
        "failures": sum(1 for r in results if r["status"] == "failure"),
        "results": [{k: v for k, v in r.items() if k != "_id"} for r in results],
    }


@api_router.post("/monitor/run/{target_id}")
async def trigger_run_target(target_id: str):
    """Manually trigger checks for a specific target."""
    if not monitor_config:
        raise HTTPException(status_code=400, detail="No config loaded")

    target = None
    for t in monitor_config.get("targets", []):
        if t["id"] == target_id:
            target = t
            break

    if not target:
        raise HTTPException(status_code=404, detail="Target not found in config")

    global_config = monitor_config.get("global", {})
    alerting_config = monitor_config.get("alerting", {})

    results = await run_target_checks(target, global_config)

    for result in results:
        await db.route_runs.insert_one(result)
        await process_check_result(db, result, alerting_config)

    await db.targets.update_one(
        {"id": target_id},
        {"$set": {"last_checked_at": datetime.now(timezone.utc).isoformat()}}
    )

    return {
        "success": True,
        "total_checks": len(results),
        "successes": sum(1 for r in results if r["status"] == "success"),
        "failures": sum(1 for r in results if r["status"] == "failure"),
        "results": results,
    }


# ─── API: Scheduler Status ────────────────────────────────────

@api_router.get("/scheduler")
async def scheduler_status():
    """Get current scheduler status and jobs."""
    return get_scheduler_status()


# ─── Utility ──────────────────────────────────────────────────

def _derive_target_status(alert_states: list, recent_runs: list) -> str:
    """Derive overall target status from alert states and recent runs."""
    if any(s.get("state") == "alerted" for s in alert_states):
        return "critical"
    if any(s.get("state") == "triggered" for s in alert_states):
        return "degraded"
    if recent_runs and all(r.get("status") == "success" for r in recent_runs[:5]):
        return "healthy"
    if recent_runs and any(r.get("status") == "failure" for r in recent_runs[:5]):
        return "degraded"
    return "unknown"


# ─── App Setup ────────────────────────────────────────────────

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
