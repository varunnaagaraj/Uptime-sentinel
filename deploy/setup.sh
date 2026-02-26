#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Route Sentinel — Full VM Setup Script
# Target: Ubuntu 22.04+ on Oracle Cloud Infrastructure (OCI)
# Run as root or with sudo
# Usage: sudo bash setup.sh
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# ─── Configuration (override via env vars before running) ─────
APP_USER="${APP_USER:-routesentinel}"
APP_DIR="${APP_DIR:-/opt/route-sentinel}"
DOMAIN="${DOMAIN:-}"
ENABLE_SSL="${ENABLE_SSL:-false}"
EMAIL_FOR_SSL="${EMAIL_FOR_SSL:-}"
MONGO_PORT="${MONGO_PORT:-27017}"
BACKEND_PORT="${BACKEND_PORT:-8001}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
NODE_VERSION="${NODE_VERSION:-20}"
PYTHON_VERSION="${PYTHON_VERSION:-3.11}"

# ─── Colors ───────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $1"; exit 1; }

# ─── Pre-flight checks ───────────────────────────────────────
[[ $EUID -ne 0 ]] && fail "This script must be run as root (sudo bash setup.sh)"
info "Starting Route Sentinel setup on $(hostname)..."

# ─── Step 1: System packages ─────────────────────────────────
info "Step 1/9 — Installing system packages..."
apt-get update -qq
apt-get install -y -qq \
  curl wget gnupg2 software-properties-common \
  build-essential git unzip \
  nginx certbot python3-certbot-nginx \
  libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 \
  libcairo2 libasound2 libnspr4 libnss3 libxss1 libxtst6 \
  xdg-utils fonts-liberation libappindicator3-1 2>/dev/null
ok "System packages installed"

# ─── Step 2: MongoDB ─────────────────────────────────────────
info "Step 2/9 — Installing MongoDB 7.0..."
if ! command -v mongod &>/dev/null; then
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
    gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
  echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
    https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
    tee /etc/apt/sources.list.d/mongodb-org-7.0.list
  apt-get update -qq
  apt-get install -y -qq mongodb-org
fi
systemctl enable mongod
systemctl start mongod
ok "MongoDB running on port ${MONGO_PORT}"

# ─── Step 3: Node.js ─────────────────────────────────────────
info "Step 3/9 — Installing Node.js ${NODE_VERSION}..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y -qq nodejs
fi
npm install -g yarn 2>/dev/null || true
ok "Node.js $(node -v) + Yarn installed"

# ─── Step 4: Python ──────────────────────────────────────────
info "Step 4/9 — Setting up Python ${PYTHON_VERSION}..."
apt-get install -y -qq python${PYTHON_VERSION} python${PYTHON_VERSION}-venv python3-pip
ok "Python $(python${PYTHON_VERSION} --version) ready"

# ─── Step 5: Application user & directory ────────────────────
info "Step 5/9 — Creating app user and directory..."
id -u ${APP_USER} &>/dev/null || useradd -r -m -s /bin/bash ${APP_USER}
mkdir -p ${APP_DIR}
ok "User '${APP_USER}', directory '${APP_DIR}'"

# ─── Step 6: Deploy application code ─────────────────────────
info "Step 6/9 — Deploying application code..."

# Copy backend
cp -r ./backend ${APP_DIR}/backend
cp -r ./deploy  ${APP_DIR}/deploy 2>/dev/null || true

# Setup Python venv
python${PYTHON_VERSION} -m venv ${APP_DIR}/backend/.venv
source ${APP_DIR}/backend/.venv/bin/activate
pip install --upgrade pip -q
pip install -r ${APP_DIR}/backend/requirements.txt -q

# Install Playwright browsers
python -m playwright install chromium
python -m playwright install-deps chromium
deactivate

# Copy frontend and build
cp -r ./frontend ${APP_DIR}/frontend
cd ${APP_DIR}/frontend
yarn install --frozen-lockfile 2>/dev/null || yarn install
yarn build
ok "Frontend built to ${APP_DIR}/frontend/build"

# Create screenshots dir
mkdir -p ${APP_DIR}/backend/screenshots

# Set .env if template exists but .env doesn't
if [ ! -f "${APP_DIR}/backend/.env" ] && [ -f "${APP_DIR}/deploy/.env.template" ]; then
  cp ${APP_DIR}/deploy/.env.template ${APP_DIR}/backend/.env
  warn "Created backend/.env from template — please edit with real values"
fi

# Create frontend .env for production
cat > ${APP_DIR}/frontend/.env.production <<EOF
REACT_APP_BACKEND_URL=https://${DOMAIN:-localhost}
EOF

# Permissions
chown -R ${APP_USER}:${APP_USER} ${APP_DIR}
ok "Application deployed to ${APP_DIR}"

# ─── Step 7: Systemd services ────────────────────────────────
info "Step 7/9 — Installing systemd services..."

cat > /etc/systemd/system/route-sentinel-backend.service <<EOF
[Unit]
Description=Route Sentinel Backend (FastAPI + Playwright)
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/backend
Environment=PATH=${APP_DIR}/backend/.venv/bin:/usr/local/bin:/usr/bin:/bin
EnvironmentFile=${APP_DIR}/backend/.env
ExecStart=${APP_DIR}/backend/.venv/bin/uvicorn server:app \
  --host 0.0.0.0 \
  --port ${BACKEND_PORT} \
  --workers 1 \
  --log-level info
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=route-sentinel-backend

# Security hardening
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=${APP_DIR}/backend/screenshots ${APP_DIR}/backend/config
# Playwright needs /tmp and home
Environment=HOME=${APP_DIR}
Environment=PLAYWRIGHT_BROWSERS_PATH=/home/${APP_USER}/.cache/ms-playwright

[Install]
WantedBy=multi-user.target
EOF

# Frontend: serve the built static files via a simple Node server
cat > ${APP_DIR}/serve-frontend.js <<'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.FRONTEND_PORT || 3000;
const BUILD_DIR = path.join(__dirname, 'frontend', 'build');

const MIME_TYPES = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.map': 'application/json',
};

const server = http.createServer((req, res) => {
  let filePath = path.join(BUILD_DIR, req.url === '/' ? 'index.html' : req.url);

  // SPA fallback: if file doesn't exist, serve index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(BUILD_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      // Cache static assets for 1 year, HTML for 0
      const cacheControl = ext === '.html'
        ? 'no-cache, no-store, must-revalidate'
        : 'public, max-age=31536000, immutable';
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': cacheControl });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Route Sentinel frontend serving on port ${PORT}`);
});
EOF
chown ${APP_USER}:${APP_USER} ${APP_DIR}/serve-frontend.js

cat > /etc/systemd/system/route-sentinel-frontend.service <<EOF
[Unit]
Description=Route Sentinel Frontend (Static Server)
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=FRONTEND_PORT=${FRONTEND_PORT}
ExecStart=/usr/bin/node ${APP_DIR}/serve-frontend.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=route-sentinel-frontend

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable route-sentinel-backend route-sentinel-frontend
systemctl start route-sentinel-backend route-sentinel-frontend
ok "Systemd services installed and started"

# ─── Step 8: Nginx reverse proxy ─────────────────────────────
info "Step 8/9 — Configuring Nginx..."

cat > /etc/nginx/sites-available/route-sentinel <<EOF
server {
    listen 80;
    server_name ${DOMAIN:-_};

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API backend
    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;

        # CORS
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        if (\$request_method = OPTIONS) { return 204; }
    }

    # Frontend (React SPA)
    location / {
        proxy_pass http://127.0.0.1:${FRONTEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 256;

    client_max_body_size 10M;
}
EOF

ln -sf /etc/nginx/sites-available/route-sentinel /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
ok "Nginx configured (HTTP)"

# ─── Step 8b: SSL (optional) ─────────────────────────────────
if [[ "${ENABLE_SSL}" == "true" && -n "${DOMAIN}" && -n "${EMAIL_FOR_SSL}" ]]; then
  info "Configuring SSL with Let's Encrypt..."
  certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos -m ${EMAIL_FOR_SSL} --redirect
  ok "SSL enabled for ${DOMAIN}"
else
  warn "SSL skipped. To enable: ENABLE_SSL=true DOMAIN=your.domain EMAIL_FOR_SSL=you@email.com bash setup.sh"
fi

# ─── Step 9: OCI Firewall (iptables) ─────────────────────────
info "Step 9/9 — Configuring OCI iptables..."
# OCI Ubuntu images have iptables blocking ports by default
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80  -j ACCEPT 2>/dev/null || true
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
netfilter-persistent save 2>/dev/null || iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
ok "Firewall rules added for ports 80, 443"

# ─── Done ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Route Sentinel — Setup Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Backend:   http://localhost:${BACKEND_PORT}/api/overview"
echo "  Frontend:  http://localhost:${FRONTEND_PORT}"
if [[ -n "${DOMAIN}" ]]; then
  echo "  Domain:    http://${DOMAIN}"
fi
echo ""
echo "  Manage services:"
echo "    sudo systemctl status route-sentinel-backend"
echo "    sudo systemctl status route-sentinel-frontend"
echo "    sudo journalctl -u route-sentinel-backend -f"
echo ""
echo "  IMPORTANT: Edit ${APP_DIR}/backend/.env with your config"
echo "  Then: sudo systemctl restart route-sentinel-backend"
echo ""
echo -e "${YELLOW}  OCI Note: Don't forget to open ports 80/443 in your${NC}"
echo -e "${YELLOW}  VCN Security List or Network Security Group!${NC}"
echo ""
