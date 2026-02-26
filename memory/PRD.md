# Route Sentinel - PRD

## Problem Statement
Build a Production-Grade Multi-Tenant Authenticated Synthetic UI Monitoring Appliance that runs Playwright-based browser checks, tracks route health, manages alerts, and provides a monitoring dashboard.

## Architecture
- **Backend**: FastAPI (Python) + MongoDB + Playwright
- **Frontend**: React + shadcn/ui + recharts + Tailwind CSS
- **Monitoring**: Playwright headless Chromium for real browser automation
- **Alerts**: Deterministic state machine with Slack/SMTP support
- **Scheduling**: APScheduler for periodic checks
- **Config**: JSON schema-validated configuration (fail-fast)

## User Personas
- Site Reliability Engineers (SREs)
- DevOps Engineers
- Platform Engineers
- Operations Teams

## Core Requirements
1. Config-driven monitoring (JSON only, AJV-style validation)
2. Playwright-based synthetic browser checks
3. Alert state machine (OK -> TRIGGERED -> ALERTED -> RESOLVED)
4. Read-only dashboard (no config editing from UI)
5. Screenshot capture on failure
6. Console log and JS error capture
7. Selector validation (required/forbidden)
8. Slack webhook and SMTP email notifications
9. Scheduled periodic checks

## What's Been Implemented (Feb 26, 2026)
- Full FastAPI backend with 10+ API endpoints
- Playwright-based synthetic monitoring runner (real browser automation)
- JSON schema config validation (strict mode, fail-fast)
- APScheduler background job scheduling
- Alert state machine with debounce logic
- Slack webhook + SMTP email notification support
- MongoDB storage with proper indices
- React dashboard: Overview, Targets, Target Detail, Alerts, Config pages
- "Tactical Obsidian" dark theme
- Recharts data visualization
- Screenshot viewer with dialog modal
- Console log viewer with collapsible display
- Timeline view for route runs
- Real-time auto-refresh (10-15s intervals)
- Manual trigger: Run All + Run Individual Target

## Prioritized Backlog
### P0 (Done)
- [x] Core monitoring engine
- [x] Dashboard UI
- [x] Alert state machine
- [x] Config validation
- [x] Scheduler

### P1 (Next)
- [ ] Auth strategies (form login, OAuth, scripted)
- [ ] JWT dashboard authentication + RBAC
- [ ] Screenshot disk cleanup / retention policy
- [ ] Config migration (versioned schema)

### P2
- [ ] Multi-tenant isolation (filter by allowedTargetIds)
- [ ] Alert escalation policies
- [ ] SLA/uptime reporting
- [ ] Export route run data (CSV/JSON)
- [ ] Webhook notifications (generic)

## Next Tasks
1. Implement auth strategies for target login
2. Add JWT auth to dashboard with role-based access
3. Screenshot retention policy & disk management
4. Historical trend analysis & reporting
