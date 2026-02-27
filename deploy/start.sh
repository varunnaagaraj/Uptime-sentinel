#!/bin/bash

echo "==> Stopping any running Docker containers..."
docker compose down --remove-orphans 2>/dev/null || true

echo "==> Waiting for containers to fully stop..."
sleep 5

echo "==> Freeing ports 80, 443, 8001, 3000, 27017..."
for port in 80 443 8001 3000 27017; do
  if sudo fuser -k ${port}/tcp 2>/dev/null; then
    echo "  Cleared port $port"
  else
    echo "  Port $port was free"
  fi
done

echo "==> Waiting for ports to be released..."
sleep 3

echo "==> Ensuring native MongoDB is stopped..."
sudo systemctl stop mongod 2>/dev/null || true
sudo systemctl mask mongod 2>/dev/null || true

echo "==> Verifying all ports are free..."
for port in 80 443 8001 3000 27017; do
  if sudo lsof -ti :$port > /dev/null 2>&1; then
    echo "  WARNING: port $port still occupied"
  else
    echo "  Port $port confirmed free"
  fi
done

echo "==> Starting stack..."
DOMAIN_URL=http://146.235.12.174 docker compose --env-file .env.docker.local up -d

echo "==> Done. Container status:"
docker compose ps
