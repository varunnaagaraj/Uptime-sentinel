"""
Scheduler - Background task scheduler for periodic synthetic monitoring.
Uses APScheduler for cron-like scheduling of route health checks.
"""
import asyncio
import logging
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from monitor.runner import run_target_checks
from monitor.alert_engine import process_check_result

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()
_db = None
_config = None


def init_scheduler(db, config):
    """Initialize the scheduler with database and config."""
    global _db, _config
    _db = db
    _config = config


async def run_scheduled_check(target_config: dict):
    """Run checks for a target and store results."""
    global _db, _config
    if not _db or not _config:
        logger.error("Scheduler not initialized")
        return

    try:
        global_config = _config.get("global", {})
        alerting_config = _config.get("alerting", {})

        results = await run_target_checks(target_config, global_config)

        for result in results:
            # Store result in MongoDB
            await _db.route_runs.insert_one(result)

            # Process through alert engine
            await process_check_result(_db, result, alerting_config)

        # Update target last_checked
        await _db.targets.update_one(
            {"id": target_config["id"]},
            {"$set": {
                "last_checked_at": datetime.now(timezone.utc).isoformat(),
                "last_check_results": len(results),
            }}
        )

        logger.info(f"Scheduled check complete for '{target_config['name']}': {len(results)} routes checked")

    except Exception as e:
        logger.error(f"Scheduled check failed for '{target_config['name']}': {e}")


def schedule_targets(config: dict):
    """Schedule monitoring jobs for all enabled targets."""
    global_config = config.get("global", {})
    default_interval = global_config.get("defaultIntervalMinutes", 5)

    # Remove existing jobs
    scheduler.remove_all_jobs()

    for target in config.get("targets", []):
        if not target.get("enabled", True):
            continue

        interval = target.get("intervalMinutes", default_interval)
        job_id = f"monitor-{target['id']}"

        scheduler.add_job(
            run_scheduled_check,
            "interval",
            minutes=interval,
            args=[target],
            id=job_id,
            name=f"Monitor: {target['name']}",
            replace_existing=True,
            max_instances=1,
        )

        logger.info(f"Scheduled '{target['name']}' every {interval} minutes")


def start_scheduler():
    """Start the APScheduler."""
    if not scheduler.running:
        scheduler.start()
        logger.info("Scheduler started")


def stop_scheduler():
    """Stop the APScheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


def get_scheduler_status():
    """Get status of all scheduled jobs."""
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "interval_minutes": job.trigger.interval.total_seconds() / 60 if hasattr(job.trigger, 'interval') else None,
        })
    return {
        "running": scheduler.running,
        "jobs": jobs,
    }
