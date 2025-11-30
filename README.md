# YT-DL — Electron + FastAPI + React

A small cross-platform desktop app that bundles a Python backend (FastAPI) and a React front-end inside an Electron shell.

This README shows how to run the app in development and how to build it for production (using Electron Forge & PyInstaller).

---

## 📦 Repo layout (important folders)
- `electron/` — Electron main process & packaging helpers
- `python-yt-dl/` — Python FastAPI backend (server & packaging scripts)
- `react-yt-dl/` — React + Vite frontend

---

## 🧰 Prerequisites
- Node.js (recommended latest LTS / v18+ or above) and npm
- Python 3.10+ (for `|` union types) and pip
- PyInstaller installed if you plan to build the packaged Python executable:
	- `python -m pip install --user pyinstaller` (or install in a virtualenv)
- On Windows: `taskkill` is used by the launcher for force-kill fallback (builtin).

---

## 🚀 Development (fast iteration)

Start the frontend dev server (Vite) using the root helper script in one terminal (recommended):

```powershell
npm install   # once, or use `npm ci` if you're using a lockfile
npm run fe-dev   # from the repository root — starts the Vite dev server for react-yt-dl
```

Then start Electron (development) in the project root in a second terminal:

```powershell
npm install    # ensure root dev deps are installed (electron-forge etc.)
npm run dev    # launches Electron (dev mode)
```

Notes:
 - The Electron dev launcher will automatically start the Python backend for you if it's not already running (it tries `python` then `python3`). In a typical workflow you'll use two terminals from the repo root:

	1) `npm run fe-dev` (frontend — Vite)
	2) `npm run dev` (Electron — auto-starts Python backend)
- If you prefer to start Python manually (e.g. to enable a debug session), you can run it directly from the `python-yt-dl` folder:

```powershell
cd python-yt-dl
python -m pip install -r requirements.txt   # optional
python main.py
```

- Use DevTools (auto-opened in dev) to inspect renderer logs and network requests.

---

## 🔧 Packaging / Production build

Packaging creates a single distributable for your platform via Electron Forge and PyInstaller.

From the repo root:

```powershell
# 1) Install dependencies (one-time on CI / machine)
npm install
# 2) Build & package (this will run hooks that build the React UI and run PyInstaller)
npm run make
```

What the `make` pipeline does (hooked in `forge.config.js`):
- Builds the React app (via `react-yt-dl` build script)
- Runs PyInstaller for the Python backend and stages the produced executable under `pack-resources/python-dist` so the packaged installer contains a runnable backend.
- Packs everything with electron-forge

After packaging inspect the output (example on Windows):

```
out/yt-dl-win32-x64/resources/pack-resources/python-dist/main.exe
out/yt-dl-win32-x64/resources/pack-resources/react-dist/index.html
```

If packaging fails with messages about the backend executable missing, run the PyInstaller step manually inside `python-yt-dl` to inspect errors.

---

## 🧭 Troubleshooting + FAQ

- `Blank window in dev`: Make sure the React dev server is running (http://localhost:5173). Check Electron DevTools and Electron stdout for did-fail-load messages.
- `Packaged python executable not found`: PyInstaller likely failed to produce an exe — re-run it manually:

```powershell
cd python-yt-dl
pyinstaller --onefile main.py           # or python -m PyInstaller --onefile main.py
ls dist\
```

- `Cannot start backend in dev`: ensure `python` or `python3` is on PATH. The app tries both names when launching the backend automatically.
- `workers=1` removed: packaging runs PyInstaller to produce a single-file backend; the programmatic uvicorn server uses no worker processes so HTTP shutdown works reliably via /shutdown.

---

## 🧼 Cleanup notes
- I recommend using a transient staging directory for builds (the project uses `pack-resources/*`) — if you want the build to be placed somewhere else we can standardize the layout.

---

If you'd like, I can add a tiny `scripts/smoke-test.js` that validates packaged artifacts exist and tries to run the backend for a few seconds — helpful for CI.

Happy to help add CI steps or a one-click build/test script next.

