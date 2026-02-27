import { useState } from "react";
import {
  Server,
  Cloud,
  Terminal,
  Shield,
  FileCode,
  Copy,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Box,
  HardDrive,
  Globe,
  Lock,
  Cpu,
  Database,
  Cog,
  Rocket,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";

function CodeBlock({ code, language, title }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-md overflow-hidden border border-border/30" data-testid={`code-block-${title?.replace(/\s+/g, '-').toLowerCase()}`}>
      {title && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] border-b border-border/20">
          <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
            {title}
          </span>
          <Badge variant="outline" className="text-[9px] h-4 px-1.5">
            {language}
          </Badge>
        </div>
      )}
      <div className="relative">
        <pre className="font-mono text-xs bg-[#0c0c0c] p-4 overflow-x-auto leading-relaxed text-gray-300 max-h-[500px]">
          <code>{code}</code>
        </pre>
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-7 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity bg-white/5 hover:bg-white/10"
          onClick={handleCopy}
          data-testid={`copy-${title?.replace(/\s+/g, '-').toLowerCase()}`}
        >
          {copied ? (
            <CheckCircle2 className="w-3 h-3 text-green-500" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </Button>
      </div>
    </div>
  );
}

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false, testId }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-border/30 rounded-lg overflow-hidden" data-testid={testId}>
      <button
        className="flex items-center justify-between w-full px-5 py-3.5 text-left bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm font-medium">{title}</span>
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="px-5 py-4 space-y-4 border-t border-border/20">{children}</div>}
    </div>
  );
}

const OCI_PREREQUISITES = `# 1. Create an OCI Compute Instance
#    - Shape: VM.Standard.A1.Flex (ARM) or VM.Standard.E4.Flex (x86)
#    - Recommended: 2 OCPU, 4 GB RAM minimum
#    - OS: Ubuntu 22.04 (Canonical)
#    - Boot volume: 50 GB minimum

# 2. Configure VCN Security List (Networking > Virtual Cloud Networks)
#    Add Ingress Rules:
#    - Source: 0.0.0.0/0, Protocol: TCP, Dest Port: 80   (HTTP)
#    - Source: 0.0.0.0/0, Protocol: TCP, Dest Port: 443  (HTTPS)
#    - Source: your-ip/32, Protocol: TCP, Dest Port: 22   (SSH)

# 3. SSH into your instance
ssh -i ~/.ssh/your-key ubuntu@<PUBLIC_IP>`;

const QUICK_START = `# Clone the repository
git clone https://github.com/your-org/route-sentinel.git
cd route-sentinel

# Run the automated setup script
sudo DOMAIN=monitor.yourdomain.com \\
     ENABLE_SSL=true \\
     EMAIL_FOR_SSL=admin@yourdomain.com \\
     bash deploy/setup.sh

# Edit the environment config
sudo nano /opt/route-sentinel/backend/.env

# Edit the monitoring config
sudo nano /opt/route-sentinel/backend/config/monitor_config.json

# Restart to apply
sudo systemctl restart route-sentinel-backend`;

const MANUAL_INSTALL = `# ── System packages ──
sudo apt-get update && sudo apt-get install -y \\
  curl wget gnupg2 build-essential git nginx certbot python3-certbot-nginx \\
  libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \\
  libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 \\
  libcairo2 libasound2 libnspr4 libnss3

# ── MongoDB 7.0 ──
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \\
  sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \\
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \\
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt-get update && sudo apt-get install -y mongodb-org
sudo systemctl enable mongod && sudo systemctl start mongod

# ── Node.js 20 ──
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
sudo npm install -g yarn

# ── Python 3.11 ──
sudo apt-get install -y python3.11 python3.11-venv python3-pip`;

const BACKEND_SETUP = `# Create app directory and user
sudo useradd -r -m -s /bin/bash routesentinel
sudo mkdir -p /opt/route-sentinel
sudo cp -r backend/ /opt/route-sentinel/backend/

# Python virtual environment
cd /opt/route-sentinel/backend
sudo -u routesentinel python3.11 -m venv .venv
sudo -u routesentinel .venv/bin/pip install -r requirements.txt

# Install Playwright browsers
sudo -u routesentinel .venv/bin/python -m playwright install chromium
sudo -u routesentinel .venv/bin/python -m playwright install-deps chromium

# Create screenshots directory
sudo mkdir -p /opt/route-sentinel/backend/screenshots
sudo chown routesentinel:routesentinel /opt/route-sentinel/backend/screenshots

# Configure environment
sudo cp deploy/.env.template /opt/route-sentinel/backend/.env
sudo nano /opt/route-sentinel/backend/.env  # Edit with real values`;

const FRONTEND_SETUP = `# Copy frontend source
sudo cp -r frontend/ /opt/route-sentinel/frontend/
cd /opt/route-sentinel/frontend

# Set production backend URL
echo "REACT_APP_BACKEND_URL=https://your-domain.com" > .env.production

# Install dependencies and build
sudo -u routesentinel yarn install
sudo -u routesentinel yarn build

# Copy the static file server
sudo cp deploy/docker/serve-frontend.js /opt/route-sentinel/serve-frontend.js`;

const SYSTEMD_SETUP = `# Copy service files
sudo cp deploy/systemd/route-sentinel-backend.service /etc/systemd/system/
sudo cp deploy/systemd/route-sentinel-frontend.service /etc/systemd/system/

# Reload, enable, and start
sudo systemctl daemon-reload
sudo systemctl enable route-sentinel-backend route-sentinel-frontend
sudo systemctl start route-sentinel-backend route-sentinel-frontend

# Check status
sudo systemctl status route-sentinel-backend
sudo systemctl status route-sentinel-frontend

# View logs
sudo journalctl -u route-sentinel-backend -f
sudo journalctl -u route-sentinel-frontend -f`;

const NGINX_SETUP = `# Copy Nginx config (choose HTTP or SSL version)
sudo cp deploy/nginx/route-sentinel.conf /etc/nginx/sites-available/route-sentinel

# Edit: replace 'server_name _' with your domain
sudo nano /etc/nginx/sites-available/route-sentinel

# Enable site, remove default
sudo ln -sf /etc/nginx/sites-available/route-sentinel /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t && sudo systemctl reload nginx`;

const SSL_SETUP = `# Ensure DNS A record points to your server IP first!
# Then run Certbot:

sudo certbot --nginx \\
  -d monitor.yourdomain.com \\
  --non-interactive \\
  --agree-tos \\
  -m admin@yourdomain.com \\
  --redirect

# Certbot auto-renew is configured automatically
# Test renewal:
sudo certbot renew --dry-run`;

const OCI_FIREWALL = `# OCI Ubuntu instances block ports by default via iptables
# Open HTTP and HTTPS:
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT

# Persist across reboots
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save

# Verify
sudo iptables -L INPUT -n --line-numbers | grep -E '80|443'`;

const DOCKER_DEPLOY = `# Clone repo and navigate to deploy dir
git clone https://github.com/your-org/route-sentinel.git
cd route-sentinel

# Configure environment
cp deploy/.env.docker deploy/.env.docker.local
nano deploy/.env.docker.local

# Build and start all services
cd deploy
DOMAIN_URL=https://monitor.yourdomain.com \\
  docker compose -f docker-compose.yml \\
  --env-file .env.docker.local \\
  up -d --build

# Check logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop
docker compose down`;

const MONITOR_CONFIG_EXAMPLE = `{
  "version": "1.0",
  "global": {
    "defaultTimeoutMs": 30000,
    "defaultIntervalMinutes": 5,
    "screenshotOnFailure": true,
    "maxConcurrentChecks": 3
  },
  "targets": [
    {
      "id": "my-production-app",
      "name": "Production App",
      "baseUrl": "https://app.yourdomain.com",
      "enabled": true,
      "tags": ["production", "critical"],
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
    },
    {
      "id": "my-authenticated-app",
      "name": "Internal Dashboard (Form Login)",
      "baseUrl": "https://internal.yourdomain.com",
      "enabled": true,
      "tags": ["internal", "authenticated"],
      "intervalMinutes": 5,
      "timeoutMs": 30000,
      "auth": {
        "strategy": "form",
        "formLogin": {
          "loginUrl": "https://internal.yourdomain.com/login",
          "usernameSelector": "#username",
          "passwordSelector": "#password",
          "submitSelector": "button[type=submit]",
          "usernameEnvVar": "MYAPP_USERNAME",
          "passwordEnvVar": "MYAPP_PASSWORD",
          "successIndicator": ".dashboard-nav"
        }
      },
      "routes": [
        {
          "path": "/dashboard",
          "name": "Dashboard (Post-Login)",
          "maxLoadTimeMs": 10000,
          "requiredSelectors": [".dashboard-content", ".user-info"],
          "forbiddenSelectors": [".login-form", ".error-page"]
        },
        {
          "path": "/settings",
          "name": "Settings Page",
          "maxLoadTimeMs": 8000,
          "requiredSelectors": ["form.settings"]
        }
      ]
    }
  ],
  "alerting": {
    "consecutiveFailureThreshold": 3,
    "debounceMinutes": 15,
    "slack": {
      "enabled": true,
      "webhookUrlEnvVar": "SLACK_WEBHOOK_URL"
    },
    "email": {
      "enabled": false,
      "smtpHostEnvVar": "SMTP_HOST",
      "smtpPortEnvVar": "SMTP_PORT",
      "smtpUserEnvVar": "SMTP_USER",
      "smtpPassEnvVar": "SMTP_PASS",
      "fromAddress": "alerts@yourdomain.com",
      "toAddresses": ["oncall@yourdomain.com"]
    }
  }
}`;

const AUTH_CONFIG_EXAMPLE = `# ── Form Login Authentication ──
# Route Sentinel logs in via Playwright before checking protected routes.
# Credentials are ALWAYS read from environment variables — never from config.

# 1. Set credentials in .env (NEVER in monitor_config.json):
MYAPP_USERNAME=monitoring-bot@yourcompany.com
MYAPP_PASSWORD=your-secure-password

# 2. Simple direct login (one-page form):
{
  "auth": {
    "strategy": "form",
    "formLogin": {
      "loginUrl": "https://app.yoursite.com/login",
      "usernameSelector": "#email",
      "passwordSelector": "#password",
      "submitSelector": "button[type=submit]",
      "usernameEnvVar": "MYAPP_USERNAME",
      "passwordEnvVar": "MYAPP_PASSWORD",
      "successIndicator": ".dashboard-nav"
    }
  }
}

# 3. Multi-step login (landing page → click Sign In → login form):
{
  "auth": {
    "strategy": "form",
    "formLogin": {
      "preSteps": [
        {
          "action": "navigate",
          "url": "https://app.yoursite.com",
          "description": "Go to landing page"
        },
        {
          "action": "click",
          "selector": "a[href='/login'], button:has-text('Sign In')",
          "description": "Click the Sign In button on landing page"
        },
        {
          "action": "waitForSelector",
          "selector": "#email",
          "description": "Wait for login form to appear"
        }
      ],
      "usernameSelector": "#email",
      "passwordSelector": "#password",
      "submitSelector": "button[type=submit]",
      "usernameEnvVar": "MYAPP_USERNAME",
      "passwordEnvVar": "MYAPP_PASSWORD",
      "successIndicator": ".dashboard-nav"
    }
  }
}`;

const PRESTEPS_EXAMPLE = `# preSteps — Available actions:
#
# navigate:          Go to a URL
#   { "action": "navigate", "url": "https://..." }
#
# click:             Click an element (waits for navigation after)
#   { "action": "click", "selector": "button.sign-in" }
#
# waitForSelector:   Wait for an element to appear on the page
#   { "action": "waitForSelector", "selector": "#login-form" }
#
# waitForNavigation: Wait for page to finish loading
#   { "action": "waitForNavigation" }
#
# fill:              Type text into an input (useful for multi-page forms)
#   { "action": "fill", "selector": "#org-name", "value": "mycompany" }
#
# waitMs:            Wait a fixed time (last resort)
#   { "action": "waitMs", "timeoutMs": 2000 }
#
# ── Example: SSO-style multi-step login ──
# Landing page → "Sign In with SSO" → Org selection → Login form
{
  "preSteps": [
    {
      "action": "navigate",
      "url": "https://app.example.com",
      "description": "Open the app"
    },
    {
      "action": "click",
      "selector": "[data-testid='login-btn']",
      "description": "Click Sign In on the hero section"
    },
    {
      "action": "waitForSelector",
      "selector": "#org-selector",
      "timeoutMs": 10000,
      "description": "Wait for org selection page"
    },
    {
      "action": "fill",
      "selector": "#org-name",
      "value": "mycompany",
      "description": "Enter organization name"
    },
    {
      "action": "click",
      "selector": "button.continue",
      "description": "Continue to login form"
    }
  ]
}`;

const OPERATIONS_CMDS = `# ── Service Management ──
sudo systemctl restart route-sentinel-backend
sudo systemctl restart route-sentinel-frontend
sudo systemctl status route-sentinel-backend

# ── Live Logs ──
sudo journalctl -u route-sentinel-backend -f --no-pager
sudo journalctl -u route-sentinel-backend --since "1 hour ago"

# ── Reload monitoring config (no restart needed) ──
curl -X POST http://localhost:8001/api/config/reload

# ── Manual trigger all checks ──
curl -X POST http://localhost:8001/api/monitor/run-all

# ── Check MongoDB ──
mongosh --eval "use route_sentinel; db.route_runs.countDocuments({})"

# ── Disk usage (screenshots) ──
du -sh /opt/route-sentinel/backend/screenshots/

# ── Clean old screenshots (older than 7 days) ──
find /opt/route-sentinel/backend/screenshots -name "*.png" -mtime +7 -delete

# ── Backup MongoDB ──
mongodump --db route_sentinel --out /backup/route-sentinel-$(date +%Y%m%d)

# ── SSL certificate renewal ──
sudo certbot renew --dry-run`;

const ARCHITECTURE_DIAGRAM = `
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
     └─────────────┘`;

export default function SetupGuidePage() {
  return (
    <div className="space-y-8 max-w-5xl" data-testid="setup-guide-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Deployment Guide
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Complete setup instructions for hosting Route Sentinel on your own infrastructure
        </p>
      </div>

      {/* Architecture overview */}
      <Card className="bg-[#111111] border-border/40" data-testid="architecture-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            Architecture Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="font-mono text-xs text-green-400 bg-[#0c0c0c] border border-border/30 rounded-md p-4 overflow-x-auto">
            {ARCHITECTURE_DIAGRAM}
          </pre>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {[
              { label: "Backend", desc: "FastAPI + Uvicorn", icon: Server },
              { label: "Database", desc: "MongoDB 7.0", icon: Database },
              { label: "Frontend", desc: "React SPA (built)", icon: Globe },
              { label: "Proxy", desc: "Nginx + SSL", icon: Lock },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-white/[0.03] border border-border/20"
              >
                <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs font-medium">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Requirements */}
      <Card className="bg-[#111111] border-border/40" data-testid="requirements-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-yellow-500" />
            System Requirements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "OS", value: "Ubuntu 22.04 LTS (or Debian 12)" },
              { label: "CPU", value: "2+ cores (ARM or x86)" },
              { label: "RAM", value: "4 GB minimum (8 GB recommended)" },
              { label: "Disk", value: "50 GB (screenshots grow over time)" },
              { label: "Ports", value: "80 (HTTP), 443 (HTTPS), 22 (SSH)" },
              { label: "Software", value: "Python 3.11, Node.js 20, MongoDB 7" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between px-3 py-2 rounded-md bg-white/[0.02] border border-border/20"
              >
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-xs font-mono">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Deploy Methods Tabs */}
      <Tabs defaultValue="automated" className="w-full">
        <TabsList className="bg-[#111111] border border-border/40">
          <TabsTrigger value="automated" data-testid="tab-automated">
            <Rocket className="w-3.5 h-3.5 mr-1.5" />
            Automated
          </TabsTrigger>
          <TabsTrigger value="manual" data-testid="tab-manual">
            <Terminal className="w-3.5 h-3.5 mr-1.5" />
            Manual
          </TabsTrigger>
          <TabsTrigger value="docker" data-testid="tab-docker">
            <Box className="w-3.5 h-3.5 mr-1.5" />
            Docker
          </TabsTrigger>
        </TabsList>

        {/* Automated Setup */}
        <TabsContent value="automated" className="mt-4 space-y-4">
          <Card className="bg-[#111111] border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                One-Command Setup (Recommended)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The automated script handles all dependencies, configuration, and service setup.
                Works on Ubuntu 22.04+ (OCI, AWS, DigitalOcean, etc.)
              </p>

              <CollapsibleSection title="1. OCI Prerequisites" icon={Cloud} defaultOpen testId="oci-prereqs">
                <CodeBlock code={OCI_PREREQUISITES} language="bash" title="OCI Instance Setup" />
                <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-yellow-500/5 border border-yellow-500/10 text-xs text-yellow-500">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    OCI Security Lists control network access at the VCN level. You MUST add ingress rules
                    for ports 80 and 443 in addition to configuring iptables on the VM.
                  </span>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="2. Run Setup Script" icon={Terminal} defaultOpen testId="quick-start">
                <CodeBlock code={QUICK_START} language="bash" title="Quick Start" />
              </CollapsibleSection>

              <CollapsibleSection title="3. Configure OCI Firewall" icon={Shield} testId="oci-firewall">
                <CodeBlock code={OCI_FIREWALL} language="bash" title="iptables Rules" />
              </CollapsibleSection>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Setup */}
        <TabsContent value="manual" className="mt-4 space-y-4">
          <Card className="bg-[#111111] border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                Step-by-Step Manual Installation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CollapsibleSection title="1. Install System Dependencies" icon={Cog} defaultOpen testId="manual-deps">
                <CodeBlock code={MANUAL_INSTALL} language="bash" title="System Dependencies" />
              </CollapsibleSection>

              <CollapsibleSection title="2. Setup Backend" icon={Server} testId="manual-backend">
                <CodeBlock code={BACKEND_SETUP} language="bash" title="Backend Setup" />
              </CollapsibleSection>

              <CollapsibleSection title="3. Setup Frontend" icon={Globe} testId="manual-frontend">
                <CodeBlock code={FRONTEND_SETUP} language="bash" title="Frontend Setup" />
              </CollapsibleSection>

              <CollapsibleSection title="4. Configure Systemd Services" icon={Cpu} testId="manual-systemd">
                <CodeBlock code={SYSTEMD_SETUP} language="bash" title="Systemd Services" />
              </CollapsibleSection>

              <CollapsibleSection title="5. Configure Nginx" icon={Shield} testId="manual-nginx">
                <CodeBlock code={NGINX_SETUP} language="bash" title="Nginx Reverse Proxy" />
              </CollapsibleSection>

              <CollapsibleSection title="6. Enable SSL (Let's Encrypt)" icon={Lock} testId="manual-ssl">
                <CodeBlock code={SSL_SETUP} language="bash" title="SSL with Certbot" />
              </CollapsibleSection>

              <CollapsibleSection title="7. OCI Firewall Rules" icon={Shield} testId="manual-oci-fw">
                <CodeBlock code={OCI_FIREWALL} language="bash" title="iptables for OCI" />
              </CollapsibleSection>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Docker Setup */}
        <TabsContent value="docker" className="mt-4 space-y-4">
          <Card className="bg-[#111111] border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                Docker Compose Deployment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Docker Compose bundles MongoDB, backend, frontend, and Nginx into isolated containers.
                Requires Docker and Docker Compose installed on the host.
              </p>
              <CollapsibleSection title="Docker Compose Deploy" icon={Box} defaultOpen testId="docker-deploy">
                <CodeBlock code={DOCKER_DEPLOY} language="bash" title="Docker Compose" />
              </CollapsibleSection>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Monitoring Configuration */}
      <Card className="bg-[#111111] border-border/40" data-testid="monitor-config-section">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FileCode className="w-4 h-4 text-green-500" />
            Monitoring Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Edit <code className="text-xs bg-white/[0.05] px-1.5 py-0.5 rounded font-mono">/opt/route-sentinel/backend/config/monitor_config.json</code> to define your monitoring targets.
            The config is validated at startup using JSON schema. Invalid config causes a fail-fast exit.
          </p>
          <CodeBlock code={MONITOR_CONFIG_EXAMPLE} language="json" title="Example monitor_config.json" />
          <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-blue-500/5 border border-blue-500/10 text-xs text-blue-400">
            <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Credentials are NEVER stored in the config file. Use environment variables
              (referenced by name in the config) and set them in the .env file.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Authenticated Monitoring */}
      <Card className="bg-[#111111] border-border/40" data-testid="auth-config-section">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Lock className="w-4 h-4 text-yellow-500" />
            Authenticated Monitoring (Form Login)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Route Sentinel can monitor pages behind authentication. It uses Playwright to perform
            a real form login before checking routes. The browser session (cookies) is reused for all
            routes of the same target. Supports both direct logins and multi-step flows.
          </p>
          <CodeBlock code={AUTH_CONFIG_EXAMPLE} language="bash" title="Form Login Auth Setup" />

          <div className="space-y-2 mt-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">How the Auth Flow Works</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { step: "1", title: "Pre-Steps (optional)", desc: "Navigate to landing page, click Sign In button, wait for redirect" },
                { step: "2", title: "Login Form", desc: "Navigate to loginUrl (skipped if preSteps already reached it)" },
                { step: "3", title: "Fill Credentials", desc: "Type username/password from env vars into selectors" },
                { step: "4", title: "Submit", desc: "Click the submit button selector" },
                { step: "5", title: "Verify", desc: "Wait for successIndicator selector to appear" },
                { step: "6", title: "Session Reuse", desc: "Browser cookies shared across all route checks" },
                { step: "7", title: "Fail-Fast", desc: "If login fails, all routes for this target are marked as failed" },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-2.5 px-3 py-2 rounded-md bg-white/[0.02] border border-border/20">
                  <div className="w-5 h-5 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0 text-[10px] text-yellow-500 font-mono font-bold">
                    {item.step}
                  </div>
                  <div>
                    <p className="text-xs font-medium">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">Multi-Step preSteps Reference</p>
            <CodeBlock code={PRESTEPS_EXAMPLE} language="json" title="preSteps Actions Reference" />
          </div>

          <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-yellow-500/5 border border-yellow-500/10 text-xs text-yellow-500">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Best practice: create a dedicated monitoring service account with read-only access.
              Never use admin credentials for synthetic monitoring.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Environment Variables */}
      <Card className="bg-[#111111] border-border/40" data-testid="env-vars-section">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-400" />
            Environment Variables
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { name: "MONGO_URL", required: true, desc: "MongoDB connection string", example: "mongodb://localhost:27017" },
              { name: "DB_NAME", required: true, desc: "Database name", example: "route_sentinel" },
              { name: "CORS_ORIGINS", required: false, desc: "Allowed CORS origins", example: "https://monitor.yourdomain.com" },
              { name: "DOMAIN", required: false, desc: "Your domain (for frontend build)", example: "monitor.yourdomain.com" },
              { name: "SLACK_WEBHOOK_URL", required: false, desc: "Slack incoming webhook URL", example: "https://hooks.slack.com/services/..." },
              { name: "SMTP_HOST", required: false, desc: "SMTP server hostname", example: "smtp.gmail.com" },
              { name: "SMTP_PORT", required: false, desc: "SMTP port", example: "587" },
              { name: "SMTP_USER", required: false, desc: "SMTP username", example: "alerts@yourdomain.com" },
              { name: "SMTP_PASS", required: false, desc: "SMTP password / app password", example: "" },
            ].map((v) => (
              <div
                key={v.name}
                className="flex items-center justify-between px-3 py-2 rounded-md bg-white/[0.02] border border-border/20"
              >
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-yellow-300">{v.name}</code>
                  {v.required && (
                    <Badge variant="outline" className="text-[9px] h-4 bg-red-500/10 text-red-400 border-red-500/20">
                      required
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground max-w-[300px] truncate text-right">
                  {v.desc}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Operations */}
      <Card className="bg-[#111111] border-border/40" data-testid="operations-section">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            Operations Commands
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock code={OPERATIONS_CMDS} language="bash" title="Common Operations" />
        </CardContent>
      </Card>

      {/* Security Checklist */}
      <Card className="bg-[#111111] border-border/40" data-testid="security-checklist">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-400" />
            Security Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              "Enable SSL/TLS with Let's Encrypt (HTTPS only)",
              "Set CORS_ORIGINS to your specific domain (not *)",
              "Restrict SSH access to your IP in OCI Security List",
              "Never store credentials in monitor_config.json — use .env only",
              "Enable MongoDB authentication for production",
              "Set up automated backups (mongodump cron job)",
              "Configure log rotation for journal logs",
              "Set up screenshot cleanup cron (older than 7 days)",
              "Add firewall rules: only ports 80, 443, 22 open",
              "Keep system packages and dependencies updated",
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2 rounded-md bg-white/[0.02] border border-border/20"
              >
                <div className="w-5 h-5 rounded-full border border-border/40 flex items-center justify-center shrink-0 text-[10px] text-muted-foreground">
                  {i + 1}
                </div>
                <span className="text-xs">{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
