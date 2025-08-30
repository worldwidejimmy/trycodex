#!/usr/bin/env bash
set -euo pipefail

LOG_FILE=".dev.log"
PID_FILE=".dev.pid"
PORT=5173

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Vite dev server already running (PID $(cat "$PID_FILE"))."
else
  echo "Starting Vite dev server on :$PORT..."
  nohup npm run dev > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  echo "Started. PID $(cat "$PID_FILE"). Logs: $LOG_FILE"
fi

# Wait until the dev server responds
echo -n "Waiting for http://localhost:$PORT to be ready"
for i in {1..60}; do
  if command -v curl >/dev/null 2>&1; then
    if curl -sSf "http://localhost:$PORT" >/dev/null 2>&1; then
      echo "\nDev server is ready."
      break
    fi
  else
    # Fallback to TCP check
    if (exec 3<>/dev/tcp/localhost/"$PORT") 2>/dev/null; then
      exec 3>&- 3<&-
      echo "\nDev server port is open."
      break
    fi
  fi
  echo -n "."
  sleep 0.5
done

URL="http://localhost:$PORT"
echo "Opening $URL"
if command -v open >/dev/null 2>&1; then
  open "$URL" || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" || true
else
  echo "Please open $URL in your browser."
fi

echo "Hint: tail -f $LOG_FILE  # view logs"
echo "To stop: kill $(cat $PID_FILE) && rm -f $PID_FILE"

