# Route Sentinel

**Production-Grade Synthetic UI Monitoring Appliance**

A config-driven, single-VM monitoring platform that uses Playwright headless Chromium to perform synthetic browser checks against your web applications, tracks route health, manages alerts with deterministic state machine logic, and provides a real-time operations dashboard.

---

## Architecture

```
                    Internet
                       |
                  ┌────┴────┐
                  │  Nginx  │  :80 / :443
                  │  Proxy  │  SSL termination
                  └────┬────┘
                       |
            ┌──────────┴──────────┐
            |                     |
      /api/* routes          /* routes
            |                     |
     ┌──────┴──────┐     ┌───────┴───────┐
     │   FastAPI   │     │   React SPA   │
     │   Backend   │     │   Frontend    │
     │   :8001     │     │   :3000       │
     └──────┬──────┘     └───────────────┘
            |
     ┌──────┴──────┐
     │  MongoDB    │
     │  :27017     │
     └─────────────┘
            |
     ┌──────┴──────┐
     │  Playwright │
     │  Chromium   │
     │  (headless) │
     └─────────────┘
```

### Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Backend** | FastAPI (Python 3.11) | API server, monitoring engine, alert state machine |
| **Monitor** | Playwright (Chromium) | Headless browser for synthetic route checks |
| **Database** | MongoDB 7.0 | Targets, route runs, alert state, alert history |
| **Frontend** | React + shadcn/ui + Recharts | Operations dashboard |
| **Proxy** | Nginx | Reverse proxy, SSL termination, security headers |
| **Scheduler** | APScheduler | Periodic monitoring check execution |
| **Alerts** | Slack + SMTP | Notification delivery (configurable) |

---

## Quick Start (OCI / Ubuntu VM)

### Prerequisites

- Ubuntu 22.04+ VM (Oracle Cloud, AWS, DigitalOcean, etc.)
- 2+ CPU cores, 4 GB+ RAM, 50 GB disk
- Domain name pointed to server IP (for SSL)
- OCI Security List: ports 80, 443, 22 open

### One-Command Setup

```bash
git clone https://github.com/your-org/route-sentinel.git
cd route-sentinel

sudo DOMAIN=monitor.yourdomain.com \
     ENABLE_SSL=true \
     EMAIL_FOR_SSL=admin@yourdomain.com \
     bash deploy/setup.sh
```

### Post-Install

```bash
# Edit environment variables
sudo nano /opt/route-sentinel/backend/.env

# Edit monitoring targets
sudo nano /opt/route-sentinel/backend/config/monitor_config.json

# Restart backend
sudo systemctl restart route-sentinel-backend
```

---

## Docker Deployment

```bash
cd deploy
cp .env.docker .env.docker.local
nano .env.docker.local

DOMAIN_URL=https://monitor.yourdomain.com \
  docker compose up -d --build
```

---

## Configuration

Route Sentinel is **config-driven**. All monitoring behavior is defined in `monitor_config.json`.

### Config Schema

```json
{
  "version": "1.0",
  "global": {
    "defaultTimeoutMs": 30000,
    "defaultIntervalMinutes": 5,
    "screenshotOnFailure": true,
    "maxConcurrentChecks": 3
  },
  "targets": [
    {
      "id": "my-app",
      "name": "My Production App",
      "baseUrl": "https://app.example.com",
      "enabled": true,
      "tags": ["production"],
      "intervalMinutes": 3,
      "auth": { "strategy": "none" },
      "routes": [
        {
          "path": "/",
          "name": "Homepage",
          "maxLoadTimeMs": 5000,
          "requiredSelectors": ["#app", "nav"]
        }
      ]
    }
  ],
  "alerting": {
    "consecutiveFailureThreshold": 3,
    "debounceMinutes": 15,
    "slack": { "enabled": true, "webhookUrlEnvVar": "SLACK_WEBHOOK_URL" },
    "email": { "enabled": false, "smtpHostEnvVar": "SMTP_HOST", ... }
  }
}
```

### Key Rules

- **Fail-fast**: Invalid config = process exits immediately
- **No secrets in config**: Credentials reference env var names only
- **JSON only**: YAML is not supported
- **Read-only dashboard**: Config cannot be edited from the UI

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URL` | Yes | MongoDB connection string |
| `DB_NAME` | Yes | Database name |
| `CORS_ORIGINS` | No | Allowed origins (default: `*`) |
| `DOMAIN` | No | Domain for frontend build |
| `SLACK_WEBHOOK_URL` | No | Slack incoming webhook |
| `SMTP_HOST` | No | SMTP server |
| `SMTP_PORT` | No | SMTP port (default: 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |

---

## Alert State Machine

```
     ┌──────┐  success   ┌──────┐
     │  OK  │ ◄────────  │RESOLV│
     └──┬───┘            └──▲───┘
        │ failure            │ success
        ▼                    │
  ┌─────────┐  threshold  ┌────────┐
  │TRIGGERED│ ──────────► │ALERTED │
  └─────────┘   reached   └────────┘
                           (notify)
```

- **OK** → TRIGGERED: Route check fails
- **TRIGGERED** → ALERTED: Consecutive failures reach threshold
- **ALERTED** → RESOLVED: Route check succeeds (notification sent)
- **Debounce**: Repeated alerts suppressed within `debounceMinutes`

---

## Route Health Checks

Each check performs:

1. Navigate to URL via headless Chromium
2. Wait for `networkidle`
3. Enforce timeout
4. Validate required selectors exist
5. Check for forbidden selectors
6. Capture JS errors and console logs
7. Check load time against threshold
8. Screenshot on failure

---

## Operations

```bash
# Service management
sudo systemctl restart route-sentinel-backend
sudo journalctl -u route-sentinel-backend -f

# Reload config (no restart)
curl -X POST http://localhost:8001/api/config/reload

# Manual check trigger
curl -X POST http://localhost:8001/api/monitor/run-all

# Screenshot cleanup (7 day retention)
find /opt/route-sentinel/backend/screenshots -name "*.png" -mtime +7 -delete

# MongoDB backup
mongodump --db route_sentinel --out /backup/$(date +%Y%m%d)
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/overview` | System health summary |
| GET | `/api/targets` | List all targets |
| GET | `/api/targets/:id` | Target detail |
| GET | `/api/targets/:id/runs` | Paginated route runs |
| GET | `/api/runs/:id` | Single run detail |
| GET | `/api/alerts` | Alert history |
| GET | `/api/alerts/active` | Active alerts |
| GET | `/api/config` | Sanitized config |
| POST | `/api/config/reload` | Reload config |
| POST | `/api/monitor/run-all` | Trigger all checks |
| POST | `/api/monitor/run/:id` | Trigger target check |
| GET | `/api/scheduler` | Scheduler status |
| GET | `/api/system/info` | System information |
| GET | `/api/screenshots/:file` | Serve screenshots |

---

## File Structure

```
route-sentinel/
├── backend/
│   ├── server.py                  # FastAPI application
│   ├── monitor/
│   │   ├── config_validator.py    # JSON schema validation
│   │   ├── runner.py              # Playwright browser checks
│   │   ├── alert_engine.py        # Alert state machine
│   │   └── scheduler.py           # APScheduler jobs
│   ├── config/
│   │   ├── config_schema.json     # JSON schema definition
│   │   └── monitor_config.json    # Monitoring configuration
│   ├── screenshots/               # Failure screenshots
│   └── .env                       # Environment variables
├── frontend/
│   ├── src/
│   │   ├── pages/                 # Dashboard pages
│   │   ├── components/            # UI components
│   │   └── lib/api.js             # API client
│   └── build/                     # Production build
├── deploy/
│   ├── setup.sh                   # Automated setup script
│   ├── nginx/                     # Nginx configurations
│   ├── systemd/                   # Service definitions
│   ├── docker/                    # Docker files
│   ├── docker-compose.yml         # Docker Compose
│   ├── .env.template              # Env var template
│   └── .env.docker                # Docker env template
└── README.md
```

---

## Security

- Credentials only in `.env` files, never in JSON config
- Nginx security headers (X-Frame-Options, HSTS, etc.)
- Systemd hardening (NoNewPrivileges, ProtectSystem, PrivateTmp)
- Resource limits (MemoryMax, CPUQuota)
- SSL/TLS with Let's Encrypt auto-renewal
- Dashboard is read-only (no config editing from UI)

---

## License

MIT
