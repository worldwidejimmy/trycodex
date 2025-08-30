#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $(basename "$0") [--kill|-k|--force] <port>" >&2
  echo "Examples:" >&2
  echo "  $(basename "$0") 8080" >&2
  echo "  $(basename "$0") --kill 8080   # ask before killing" >&2
  echo "  $(basename "$0") --force 8080  # kill without prompt" >&2
}

KILL_MODE="none"   # none|ask|force

ARGS=()
for a in "$@"; do
  case "$a" in
    --kill|-k) KILL_MODE="ask" ;;
    --force)   KILL_MODE="force" ;;
    -h|--help) usage; exit 0 ;;
    *) ARGS+=("$a") ;;
  esac
done

if [ ${#ARGS[@]} -lt 1 ]; then
  usage; exit 1;
fi

PORT_INDEX=$((${#ARGS[@]}-1))
PORT="${ARGS[$PORT_INDEX]}"
if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
  echo "Error: port must be a number" >&2
  usage; exit 1
fi

SERVER_PID_FILE=".server.pid"

echo "Inspecting port $PORT..."

found=0
if command -v lsof >/dev/null 2>&1; then
  echo "\n[lsof] Listeners on TCP:$PORT" 
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN || true
PIDS=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | sort -u || true)
  if [ -n "$PIDS" ]; then
    found=1
    for PID in $PIDS; do
      echo "\n[ps] PID $PID details:" 
      if command -v ps >/dev/null 2>&1; then
        ps -o pid,ppid,user,etime,command -p "$PID" || true
      fi
      echo "\n[lsof] Sockets for PID $PID:" 
      lsof -nP -a -p "$PID" -iTCP -sTCP:LISTEN || true
      if [ -f "$SERVER_PID_FILE" ] && [ "$(cat "$SERVER_PID_FILE")" = "$PID" ]; then
        echo "\nNote: This PID matches your app's .server.pid"
      fi

      if [ "$KILL_MODE" != "none" ]; then
        do_kill=0
        if [ "$KILL_MODE" = "force" ]; then
          do_kill=1
        else
          read -r -p "Kill PID $PID listening on port $PORT? [y/N] " ans
          case "$ans" in
            y|Y|yes|YES) do_kill=1;;
            *) do_kill=0;;
          esac
        fi
        if [ $do_kill -eq 1 ]; then
          echo "Sending SIGTERM to $PID..."
          kill "$PID" 2>/dev/null || true
          for i in {1..20}; do
            if kill -0 "$PID" 2>/dev/null; then
              sleep 0.1
            else
              break
            fi
          done
          if kill -0 "$PID" 2>/dev/null; then
            echo "SIGTERM failed, sending SIGKILL to $PID..."
            kill -9 "$PID" 2>/dev/null || true
          fi
          if kill -0 "$PID" 2>/dev/null; then
            echo "Unable to kill PID $PID (permission denied or zombie)." >&2
            exit_code=1
          else
            echo "PID $PID stopped."
          fi
        fi
      fi
    done
  fi
fi

if [ $found -eq 0 ]; then
  if command -v ss >/dev/null 2>&1; then
    echo "\n[ss] Listeners on :$PORT" 
    ss -lntp | awk -v p=":$PORT" '$4 ~ p {print}' || true
  elif command -v netstat >/dev/null 2>&1; then
    echo "\n[netstat] Listeners on :$PORT" 
    netstat -anv | grep "\.$PORT " | grep LISTEN || true
  else
    echo "\nNo suitable tool (lsof/ss/netstat) found to inspect ports." >&2
    exit 2
  fi
fi

echo "\nDone."
