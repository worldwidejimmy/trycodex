# Cool Things — Fractals & Chill (Vite + React)

A small React + Vite app that renders interactive, relaxing visuals with ambient music. It includes a tiny Node server for production (serves `dist/` and a file‑backed settings API), precompressed assets, and helper scripts to run locally or deploy on a Linux VM.

## Features

- Visual modes (dropdown at top):
  - Fractal Flow (WebGL2 Julia set, mouse‑seeded)
  - Flow Field Particles (2D canvas trails)
  - Game of Life (2D glowing cellular automaton)
- Ambient music with controls: Play/Pause, Mute/Unmute, Volume slider
- Settings persistence to `settings.json` in the project root
- Node server (`server.js`) to serve production build + `/api/settings`
- Build‑time precompression (`.br`, `.gz`) and selective serving
- Helper scripts to start, stop, restart, check status, inspect ports
- Optional systemd unit for Linux deployment

## Prerequisites

- Node.js 18+ recommended (works with >= 18 or >= 20). macOS/Linux.
- A shell with `bash`. For port inspection, `lsof` is recommended.

## Install

```bash
npm install
```

## Development (HMR)

- Start dev server with HMR and auto‑open browser:
  ```bash
  ./dev.sh
  ```
- Logs: `tail -f .dev.log`
- Stop dev server: `kill $(cat .dev.pid) && rm -f .dev.pid`

## Production Build

- Build (also creates `.br`/`.gz`):
  ```bash
  ./build.sh
  ```
- Output: `dist/`

## Production Server

The production server (`server.js`) serves `dist/` and exposes a simple JSON API for settings.

- Start (background):
  ```bash
  PORT=8080 ./start.sh
  ```
  - Picks a free port if requested one is busy; final port is saved in `.server.port`
- Stop:
  ```bash
  ./stop.sh
  ```
- Restart:
  ```bash
  ./restart.sh
  ```
- Status / ping:
  ```bash
  ./status.sh
  ./status.sh --ping
  ```
- Logs:
  - Server: `.server.log`
  - Client errors (posted from browser): `client.log`

Open the app in your browser: `http://localhost:$(cat .server.port)`

## Environment Variables (server)

- `PORT`: Port to bind (default chosen by `start.sh`, commonly 8080)
- `HOST`: Interface to bind (default `0.0.0.0`)
- `LOG_REQUESTS`: `1` to log each HTTP request
- `DISABLE_PRECOMP`: `1` to disable serving `.br`/`.gz` (for debugging)

Examples:
```bash
# Verbose logging, no precompressed assets
PORT=5273 LOG_REQUESTS=1 DISABLE_PRECOMP=1 ./restart.sh

# Typical production start
PORT=8080 ./restart.sh
```

## Settings Persistence

- File: `settings.json` in the project root (ignored by git)
- API:
  - `GET /api/settings` → returns current settings JSON
  - `POST /api/settings` → overwrites settings JSON
- Frontend auto‑loads on mount and debounced‑saves on change

## Port Inspection

Use `port.sh` to see who owns a port (and optionally kill it):
```bash
./port.sh 8080            # inspect
./port.sh --kill 8080     # ask before killing the owner
./port.sh --force 8080    # kill without prompt
```

## Files of Interest

- `index.html` — app HTML entry (contains a lightweight loading fallback)
- `src/main.jsx` — React bootstrap + minimal client error reporting
- `src/App.jsx` — dropdown, audio controls, layout, and mode routing
- `src/components/FractalCanvas.jsx` — WebGL2 fractal (Julia) canvas
- `src/components/ParticleField.jsx` — 2D flow field particles
- `src/components/LifeCanvas.jsx` — 2D Game of Life
- `src/audio/useAmbientAudio.js` — WebAudio ambient pad + notes
- `src/styles.css` — overall styling
- `server.js` — zero‑dependency Node static + API server
- `scripts/postcompress.js` — precompress `dist/` assets (`.gz`, `.br`)
- Shell scripts: `start.sh`, `stop.sh`, `restart.sh`, `status.sh`, `dev.sh`, `build.sh`, `port.sh`
- Systemd unit template: `systemd/cool-things.service`

## Deploy on Linux (systemd)

1) Place the repo (e.g., `/opt/cool-things`) and install deps:
```bash
cd /opt/cool-things
npm ci || npm install
./build.sh
```
2) Edit `systemd/cool-things.service`:
- `User`/`Group`: non‑root user that owns the repo
- `WorkingDirectory`: absolute path to the repo
- `Environment=PORT=8080` (adjust as needed)

3) Install and enable:
```bash
sudo cp systemd/cool-things.service /etc/systemd/system/cool-things.service
sudo systemctl daemon-reload
sudo systemctl enable cool-things
sudo systemctl start cool-things
```
4) Check:
```bash
systemctl status cool-things
journalctl -u cool-things -f
```

## Troubleshooting

- Blank page:
  - Hard refresh (Cmd/Ctrl+Shift+R)
  - Check `.server.log` for 404s or shader compile errors
  - Check `client.log` for client runtime errors (posted automatically)
- Port busy:
  - `./port.sh 8080` → inspect; `--kill` to free the port
  - `./status.sh --ping`
- WebGL2 unsupported:
  - Fractal shows a fallback message; try a modern browser
- Audio not playing:
  - Most browsers require a user gesture (click Play Music)

## License

No explicit license included. Add one before public distribution if needed.

