"""
Synthetic Monitor Runner - Playwright-based browser automation for route health checks.
Captures screenshots, console errors, timing, and selector validation.
"""
import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

SCREENSHOT_DIR = Path(__file__).parent.parent / "screenshots"
SCREENSHOT_DIR.mkdir(exist_ok=True)


class RouteCheckResult:
    def __init__(self):
        self.id = str(uuid.uuid4())
        self.target_id = ""
        self.target_name = ""
        self.route_path = ""
        self.route_name = ""
        self.full_url = ""
        self.status = "pending"  # pending, success, failure
        self.duration_ms = 0
        self.http_status = None
        self.console_logs = []
        self.js_errors = []
        self.missing_selectors = []
        self.forbidden_selectors_found = []
        self.screenshot_path = None
        self.error_message = None
        self.timestamp = datetime.now(timezone.utc)

    def to_dict(self):
        return {
            "id": self.id,
            "target_id": self.target_id,
            "target_name": self.target_name,
            "route_path": self.route_path,
            "route_name": self.route_name,
            "full_url": self.full_url,
            "status": self.status,
            "duration_ms": self.duration_ms,
            "http_status": self.http_status,
            "console_logs": self.console_logs,
            "js_errors": self.js_errors,
            "missing_selectors": self.missing_selectors,
            "forbidden_selectors_found": self.forbidden_selectors_found,
            "screenshot_path": self.screenshot_path,
            "error_message": self.error_message,
            "timestamp": self.timestamp.isoformat(),
        }


async def check_route(browser, target_config: dict, route_config: dict, global_config: dict) -> RouteCheckResult:
    """Execute a single route health check using Playwright."""
    result = RouteCheckResult()
    result.target_id = target_config["id"]
    result.target_name = target_config["name"]
    result.route_path = route_config["path"]
    result.route_name = route_config["name"]
    result.full_url = target_config["baseUrl"].rstrip("/") + route_config["path"]

    timeout_ms = target_config.get("timeoutMs", global_config.get("defaultTimeoutMs", 30000))
    max_load_ms = route_config.get("maxLoadTimeMs", timeout_ms)
    screenshot_on_failure = global_config.get("screenshotOnFailure", True)

    context = None
    page = None
    start_time = asyncio.get_event_loop().time()

    try:
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="RouteSentinel/1.0 SyntheticMonitor"
        )
        page = await context.new_page()

        # Capture console messages
        page.on("console", lambda msg: result.console_logs.append({
            "type": msg.type,
            "text": msg.text,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }))

        # Capture JS errors
        page.on("pageerror", lambda err: result.js_errors.append({
            "message": str(err),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }))

        # Navigate
        response = await page.goto(
            result.full_url,
            wait_until="networkidle",
            timeout=timeout_ms
        )

        elapsed_ms = int((asyncio.get_event_loop().time() - start_time) * 1000)
        result.duration_ms = elapsed_ms
        result.http_status = response.status if response else None

        # Check load time violation
        if elapsed_ms > max_load_ms:
            result.status = "failure"
            result.error_message = f"Load time {elapsed_ms}ms exceeded max {max_load_ms}ms"

        # Check required selectors
        for selector in route_config.get("requiredSelectors", []):
            try:
                await page.wait_for_selector(selector, timeout=5000)
            except Exception:
                result.missing_selectors.append(selector)

        # Check forbidden selectors
        for selector in route_config.get("forbiddenSelectors", []):
            try:
                el = await page.query_selector(selector)
                if el:
                    result.forbidden_selectors_found.append(selector)
            except Exception:
                pass

        # Determine final status
        if result.missing_selectors:
            result.status = "failure"
            result.error_message = f"Missing selectors: {', '.join(result.missing_selectors)}"
        elif result.forbidden_selectors_found:
            result.status = "failure"
            result.error_message = f"Forbidden selectors found: {', '.join(result.forbidden_selectors_found)}"
        elif result.js_errors:
            result.status = "failure"
            result.error_message = f"JS errors detected: {len(result.js_errors)}"
        elif result.http_status and result.http_status >= 400:
            result.status = "failure"
            result.error_message = f"HTTP {result.http_status}"
        elif result.status != "failure":
            result.status = "success"

        # Screenshot on failure
        if result.status == "failure" and screenshot_on_failure:
            screenshot_name = f"{result.id}.png"
            screenshot_path = SCREENSHOT_DIR / screenshot_name
            await page.screenshot(path=str(screenshot_path), full_page=False)
            result.screenshot_path = screenshot_name

        # Screenshot on success if configured
        if result.status == "success" and route_config.get("screenshotOnSuccess"):
            screenshot_name = f"{result.id}.png"
            screenshot_path = SCREENSHOT_DIR / screenshot_name
            await page.screenshot(path=str(screenshot_path), full_page=False)
            result.screenshot_path = screenshot_name

    except Exception as e:
        elapsed_ms = int((asyncio.get_event_loop().time() - start_time) * 1000)
        result.duration_ms = elapsed_ms
        result.status = "failure"
        result.error_message = str(e)[:500]

        # Try screenshot on error
        if page and screenshot_on_failure:
            try:
                screenshot_name = f"{result.id}.png"
                screenshot_path = SCREENSHOT_DIR / screenshot_name
                await page.screenshot(path=str(screenshot_path), full_page=False)
                result.screenshot_path = screenshot_name
            except Exception:
                pass

    finally:
        if context:
            try:
                await context.close()
            except Exception:
                pass

    return result


async def run_target_checks(target_config: dict, global_config: dict) -> list:
    """Run all route checks for a single target. Returns list of RouteCheckResult dicts."""
    if not target_config.get("enabled", True):
        return []

    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
        )
        try:
            for route in target_config.get("routes", []):
                result = await check_route(browser, target_config, route, global_config)
                results.append(result.to_dict())
                logger.info(
                    f"Check [{result.status}] {target_config['name']} - {route['name']}: "
                    f"{result.duration_ms}ms"
                )
        finally:
            await browser.close()

    return results


async def run_all_checks(config: dict) -> list:
    """Run checks for all enabled targets. Respects maxConcurrentChecks."""
    global_config = config.get("global", {})
    max_concurrent = global_config.get("maxConcurrentChecks", 3)
    targets = [t for t in config.get("targets", []) if t.get("enabled", True)]

    all_results = []
    semaphore = asyncio.Semaphore(max_concurrent)

    async def run_with_semaphore(target):
        async with semaphore:
            return await run_target_checks(target, global_config)

    tasks = [run_with_semaphore(t) for t in targets]
    results_lists = await asyncio.gather(*tasks, return_exceptions=True)

    for r in results_lists:
        if isinstance(r, Exception):
            logger.error(f"Target check failed: {r}")
        elif isinstance(r, list):
            all_results.extend(r)

    return all_results
