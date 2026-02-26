"""
Alert Engine - Deterministic state machine for alert management.
States: OK -> TRIGGERED -> ALERTED -> RESOLVED
Supports Slack webhook and SMTP email notifications.
"""
import os
import logging
import httpx
import aiosmtplib
from email.message import EmailMessage
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# Alert States
STATE_OK = "ok"
STATE_TRIGGERED = "triggered"
STATE_ALERTED = "alerted"
STATE_RESOLVED = "resolved"


async def get_alert_state(db: AsyncIOMotorDatabase, target_id: str, route_path: str) -> dict:
    """Get current alert state for a target/route combo."""
    state = await db.alert_state.find_one(
        {"target_id": target_id, "route_path": route_path},
        {"_id": 0}
    )
    if not state:
        return {
            "target_id": target_id,
            "route_path": route_path,
            "state": STATE_OK,
            "consecutive_failures": 0,
            "last_failure_at": None,
            "last_success_at": None,
            "last_alerted_at": None,
            "alert_count": 0,
        }
    return state


async def process_check_result(db: AsyncIOMotorDatabase, result: dict, alerting_config: dict):
    """Process a route check result and update alert state machine."""
    target_id = result["target_id"]
    route_path = result["route_path"]
    is_failure = result["status"] == "failure"

    state = await get_alert_state(db, target_id, route_path)
    now = datetime.now(timezone.utc).isoformat()
    prev_state = state["state"]

    if is_failure:
        state["consecutive_failures"] = state.get("consecutive_failures", 0) + 1
        state["last_failure_at"] = now

        threshold = alerting_config.get("consecutiveFailureThreshold", 3)
        debounce_minutes = alerting_config.get("debounceMinutes", 15)

        if state["consecutive_failures"] >= threshold:
            # Check debounce
            should_alert = True
            if state.get("last_alerted_at"):
                from datetime import timedelta
                last_alerted = datetime.fromisoformat(state["last_alerted_at"])
                if datetime.now(timezone.utc) - last_alerted < timedelta(minutes=debounce_minutes):
                    should_alert = False

            if should_alert and prev_state != STATE_ALERTED:
                state["state"] = STATE_ALERTED
                state["last_alerted_at"] = now
                state["alert_count"] = state.get("alert_count", 0) + 1

                # Send notifications
                await send_alert_notifications(
                    db, result, alerting_config, "ALERT"
                )

                # Record alert history
                await db.alert_history.insert_one({
                    "id": f"alert-{target_id}-{route_path}-{now}",
                    "target_id": target_id,
                    "target_name": result.get("target_name", ""),
                    "route_path": route_path,
                    "route_name": result.get("route_name", ""),
                    "transition": f"{prev_state} -> {STATE_ALERTED}",
                    "from_state": prev_state,
                    "to_state": STATE_ALERTED,
                    "consecutive_failures": state["consecutive_failures"],
                    "error_message": result.get("error_message"),
                    "timestamp": now,
                    "notification_sent": True,
                })
            else:
                state["state"] = STATE_TRIGGERED
        else:
            state["state"] = STATE_TRIGGERED

    else:
        # Success
        if prev_state in (STATE_TRIGGERED, STATE_ALERTED):
            state["state"] = STATE_RESOLVED

            # Record resolution
            await db.alert_history.insert_one({
                "id": f"resolved-{target_id}-{route_path}-{now}",
                "target_id": target_id,
                "target_name": result.get("target_name", ""),
                "route_path": route_path,
                "route_name": result.get("route_name", ""),
                "transition": f"{prev_state} -> {STATE_RESOLVED}",
                "from_state": prev_state,
                "to_state": STATE_RESOLVED,
                "consecutive_failures": state["consecutive_failures"],
                "error_message": None,
                "timestamp": now,
                "notification_sent": prev_state == STATE_ALERTED,
            })

            if prev_state == STATE_ALERTED:
                await send_alert_notifications(
                    db, result, alerting_config, "RESOLVED"
                )

            state["consecutive_failures"] = 0
            # Reset to OK after resolution
            state["state"] = STATE_OK

        state["consecutive_failures"] = 0
        state["last_success_at"] = now

    # Upsert alert state
    await db.alert_state.update_one(
        {"target_id": target_id, "route_path": route_path},
        {"$set": state},
        upsert=True
    )


async def send_alert_notifications(db: AsyncIOMotorDatabase, result: dict, alerting_config: dict, alert_type: str):
    """Send Slack and/or email notifications."""
    slack_config = alerting_config.get("slack", {})
    email_config = alerting_config.get("email", {})

    if slack_config.get("enabled"):
        await send_slack_alert(result, slack_config, alert_type)

    if email_config.get("enabled"):
        await send_email_alert(result, email_config, alert_type)


async def send_slack_alert(result: dict, slack_config: dict, alert_type: str):
    """Send alert to Slack webhook."""
    webhook_env = slack_config.get("webhookUrlEnvVar", "SLACK_WEBHOOK_URL")
    webhook_url = os.environ.get(webhook_env)

    if not webhook_url:
        logger.warning(f"Slack webhook env var '{webhook_env}' not set. Skipping notification.")
        return

    color = "#ef4444" if alert_type == "ALERT" else "#22c55e"
    emoji = ":rotating_light:" if alert_type == "ALERT" else ":white_check_mark:"

    payload = {
        "attachments": [{
            "color": color,
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": (
                            f"{emoji} *Route Sentinel {alert_type}*\n"
                            f"*Target:* {result.get('target_name', 'Unknown')}\n"
                            f"*Route:* {result.get('route_name', '')} (`{result.get('route_path', '')}`)\n"
                            f"*URL:* {result.get('full_url', '')}\n"
                            f"*Error:* {result.get('error_message', 'N/A')}\n"
                            f"*Duration:* {result.get('duration_ms', 0)}ms"
                        )
                    }
                }
            ]
        }]
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(webhook_url, json=payload, timeout=10)
            if resp.status_code != 200:
                logger.error(f"Slack notification failed: {resp.status_code}")
    except Exception as e:
        logger.error(f"Slack notification error: {e}")


async def send_email_alert(result: dict, email_config: dict, alert_type: str):
    """Send alert via SMTP email."""
    smtp_host = os.environ.get(email_config.get("smtpHostEnvVar", "SMTP_HOST"))
    smtp_port = int(os.environ.get(email_config.get("smtpPortEnvVar", "SMTP_PORT"), "587"))
    smtp_user = os.environ.get(email_config.get("smtpUserEnvVar", "SMTP_USER"))
    smtp_pass = os.environ.get(email_config.get("smtpPassEnvVar", "SMTP_PASS"))

    if not all([smtp_host, smtp_user, smtp_pass]):
        logger.warning("SMTP credentials not fully configured. Skipping email.")
        return

    msg = EmailMessage()
    msg["Subject"] = f"[Route Sentinel] {alert_type}: {result.get('target_name', '')} - {result.get('route_name', '')}"
    msg["From"] = email_config.get("fromAddress", "alerts@routesentinel.local")
    msg["To"] = ", ".join(email_config.get("toAddresses", []))
    msg.set_content(
        f"Route Sentinel {alert_type}\n\n"
        f"Target: {result.get('target_name', '')}\n"
        f"Route: {result.get('route_name', '')} ({result.get('route_path', '')})\n"
        f"URL: {result.get('full_url', '')}\n"
        f"Error: {result.get('error_message', 'N/A')}\n"
        f"Duration: {result.get('duration_ms', 0)}ms\n"
        f"Timestamp: {result.get('timestamp', '')}\n"
    )

    try:
        await aiosmtplib.send(
            msg,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_user,
            password=smtp_pass,
            use_tls=True,
        )
        logger.info(f"Email alert sent for {alert_type}")
    except Exception as e:
        logger.error(f"Email notification error: {e}")
