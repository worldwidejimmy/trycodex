#!/usr/bin/env bash
set -euo pipefail

PID_FILE=".server.pid"
PORT_FILE=".server.port"
LOG_FILE=".server.log"

if [ ! -f "$PID_FILE" ]; then
  echo "Status: stopped (no PID file)"
  exit 1
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
  STATE="running"
else
  echo "Status: stopped (stale PID $PID)"
  exit 1
fi

PORT="8080"
if [ -f "$PORT_FILE" ]; then
  PORT=$(cat "$PORT_FILE")
else
  # Try to parse from log as a fallback
  if [ -f "$LOG_FILE" ]; then
    URL_LINE=$(grep -Eo "http://[^ ]+" "$LOG_FILE" | tail -n1 || true)
    if [[ "$URL_LINE" =~ :([0-9]+)$ ]]; then PORT="${BASH_REMATCH[1]}"; fi
  fi
fi

UPTIME=""
if command -v ps >/dev/null 2>&1; then
  UPTIME=$(ps -o etime= -p "$PID" 2>/dev/null || true)
fi

echo "Status: $STATE"
echo "PID: $PID"
echo "Port: $PORT"
if [ -n "$UPTIME" ]; then
  echo "Uptime: $UPTIME"
fi
echo "URL: http://localhost:$PORT"
echo "Logs: tail -f $LOG_FILE"

if [[ ${1:-} == "--ping" || ${1:-} == "-p" ]]; then
  echo "Ping: checking http://localhost:$PORT ..."
  STATUS=""
  if command -v curl >/dev/null 2>&1; then
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT" || true)
    if [ -n "$STATUS" ]; then
      echo "HTTP $STATUS"
      exit 0
    fi
  fi
  if command -v nc >/dev/null 2>&1; then
    if nc -z localhost "$PORT" >/dev/null 2>&1; then
      echo "TCP port open"
      exit 0
    fi
  fi
  # Bash /dev/tcp fallback
  if (exec 3<>/dev/tcp/localhost/"$PORT") 2>/dev/null; then
    exec 3>&- 3<&-
    echo "TCP port open"
    exit 0
  fi
  echo "Ping failed"
  exit 1
fi
