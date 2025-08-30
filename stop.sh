#!/usr/bin/env bash
set -euo pipefail

PID_FILE=".server.pid"
PORT_FILE=".server.port"

if [ ! -f "$PID_FILE" ]; then
  echo "No PID file found. Server not running?"
  exit 0
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
  echo "Stopping server PID $PID..."
  kill "$PID" || true
  # Give it a moment, then SIGKILL if needed
  for i in {1..10}; do
    if kill -0 "$PID" 2>/dev/null; then
      sleep 0.2
    else
      break
    fi
  done
  if kill -0 "$PID" 2>/dev/null; then
    echo "Force killing PID $PID"
    kill -9 "$PID" || true
  fi
else
  echo "Process $PID not running."
fi

rm -f "$PID_FILE"
rm -f "$PORT_FILE"
echo "Stopped."
