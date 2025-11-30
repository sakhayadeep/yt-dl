# **YT-DL — Electron + FastAPI + React**

A cross-platform desktop app that bundles a Python FastAPI backend and a React (Vite) frontend inside an Electron shell.
This README explains how to run the project in development and how to build production binaries using **Electron Forge** and **PyInstaller**.

---

## 📁 **Repository Structure**

| Folder          | Description                                |
| --------------- | ------------------------------------------ |
| `electron/`     | Electron main process & packaging config   |
| `python-yt-dl/` | Python FastAPI backend & packaging scripts |
| `react-yt-dl/`  | React + Vite frontend                      |

---

## 🧰 **Requirements**

* **Node.js** (LTS v18+ recommended) & npm
* **Python 3.10+** + pip
* **PyInstaller** (required for production build)

  ```bash
  python -m pip install --user pyinstaller
  ```
* **Windows only:** uses `taskkill` for fallback cleanup (built-in)

---

## 🚀 **Development Setup**

### **1. Start the React frontend**

From the repo root:

```bash
npm install        # once (or npm ci with lockfile)
npm run fe-dev     # starts Vite dev server for react-yt-dl
```

### **2. Start Electron**

In a second terminal at the repo root:

```bash
npm install        # ensure dev dependencies exist
npm run dev        # launches Electron (auto-starts backend)
```

### Notes

* Electron's dev launcher automatically starts the Python backend (tries `python` then `python3`).
* Typical dev workflow:

  1. `npm run fe-dev` — frontend
  2. `npm run dev` — Electron + backend auto-launch
* If you want to run the backend manually (e.g. debugging):

  ```bash
  cd python-yt-dl
  python -m pip install -r requirements.txt
  python main.py
  ```

---

## 📦 **Packaging / Production Build**

Creates a standalone distribution using Electron Forge + PyInstaller.

From the repo root:

```bash
npm install         # one time per machine or CI
npm run make        # builds React, runs PyInstaller, packages app
```

### What the build pipeline does

* Builds the React app
* Runs PyInstaller and places output under:

  ```
  pack-resources/python-dist
  ```
* Packages everything via Electron Forge

### Example build output (Windows)

```
out/yt-dl-win32-x64/resources/pack-resources/python-dist/main.exe
out/yt-dl-win32-x64/resources/pack-resources/react-dist/index.html
```

If packaging fails, try PyInstaller manually:

```bash
cd python-yt-dl
pyinstaller --onefile main.py
```

---

## 🧭 **Troubleshooting / FAQ**

| Issue                               | Solution                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Blank window in dev                 | Ensure Vite is running (`http://localhost:5173`) and check DevTools      |
| Backend not found in packaged build | PyInstaller likely failed → run manually and inspect `dist/`             |
| Backend fails to start in dev       | Confirm `python`/`python3` is available in PATH                          |
| Shutdown issues / workers           | Uvicorn runs in single worker mode for clean shutdown in packaged builds |

---

## 🧼 **Cleanup / Build Artifacts**

Build staging output is stored in:

```
pack-resources/
```

You can change this if needed for CI or custom installers.

---

Thanks for checking out the project — feedback and improvements welcome!
