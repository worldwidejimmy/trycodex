#!/usr/bin/env bash
set -euo pipefail

LOG_FILE=".server.log"
PID_FILE=".server.pid"
PORT_FILE=".server.port"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Server already running with PID $(cat "$PID_FILE")"
  exit 0
fi

if [ ! -f "dist/index.html" ]; then
  echo "dist/ not found. Run ./build.sh first."
  exit 1
fi

PORT="${PORT:-8080}"

# find a free port (up to +20)
port_in_use() {
  local p="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1 && return 0 || return 1
  elif command -v nc >/dev/null 2>&1; then
    nc -z localhost "$p" >/dev/null 2>&1 && return 0 || return 1
  else
    (exec 3<>/dev/tcp/localhost/"$p") >/dev/null 2>&1 && { exec 3>&- 3<&-; return 0; } || return 1
  fi
}

orig_port="$PORT"
tries=0
while port_in_use "$PORT" && [ $tries -lt 20 ]; do
  PORT=$((PORT+1))
  tries=$((tries+1))
done

if [ "$PORT" != "$orig_port" ]; then
  echo "Requested port $orig_port was busy; using $PORT instead."
fi

echo "Starting production server on :$PORT..."
nohup env PORT="$PORT" npm run start > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
echo "$PORT" > "$PORT_FILE"
echo "Started. PID $(cat "$PID_FILE"). Logs: $LOG_FILE"
