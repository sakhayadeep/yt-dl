const { app, BrowserWindow, dialog } = require("electron");
const { spawn, exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const getExecutableName = require("./utils/getExecutableName");

let pyProc = null;
let mainWindow = null;
const isDev = !app.isPackaged;

function startPython() {
  const executableName = getExecutableName();

  // Dev-only log
  if (isDev) console.log(`isDev: ${isDev}`);
  if (isDev) {
    // Use an absolute path to the dev Python script so we don't depend on CWD.
    const scriptPath = path.join(__dirname, '..', 'python-yt-dl', 'main.py');

    // Try several python binary names (windows/mac/linux differences)
    const pythonBinaries = ['python', 'python3'];
    let started = false;

    for (const pythonBin of pythonBinaries) {
      try {
        console.log(`Attempting to spawn python using ${pythonBin} ${scriptPath}`);
        const proc = spawn(pythonBin, [scriptPath]);
        // spawn returns a ChildProcess; attach an error handler
        proc.once('error', (err) => console.error(`${pythonBin} spawn error:`, err));

        // if spawn succeeded, save the process and stop trying
        pyProc = proc;
        started = true;
        break;
      } catch (err) {
        console.warn(`Failed to spawn using ${pythonBin}:`, err);
      }
    }

    if (!started) {
      console.error('Could not start Python backend in development mode. Ensure Python is installed and available on PATH (try "python" or "python3").');
    }
  } else {
    // Running from a packaged app — the built python exe should be located in
    // resources/python-dist/<executable>
    try {
      // Packaged builds put the Python binary under resources/python-dist
      let pyExecutable = path.join(process.resourcesPath, 'python-dist', executableName);

      if (isDev) console.log("Launching backend from", pyExecutable);
      pyProc = spawn(pyExecutable);
    } catch (err) {
      console.error('Error while attempting to start packaged python backend:', err);
      try { dialog.showErrorBox('Backend start failed', String(err)); } catch (dErr) { /* ignore */ }
      return;
    }
  }

  if (pyProc && pyProc.stdout) pyProc.stdout.on("data", data => { if (isDev) console.log(`PY: ${data}`); });
  if (pyProc && pyProc.stderr) pyProc.stderr.on("data", data => { if (isDev) console.error(`PYERR: ${data}`); });

  pyProc.once("exit", (code, signal) => {
    console.log(`Python backend exited (code=${code}, signal=${signal})`);
    pyProc = null;
  });
  pyProc.once("error", (err) => {
    console.error("Python backend process error:", err);
    pyProc = null;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Keep renderer secure by default; open DevTools in dev for debugging
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isDev,
    },
  });

  // Load React UI served by backend or use local build
  if (isDev) {
    const devUrl = "http://localhost:5173";
    if (isDev) console.log('Loading dev server at', devUrl);
    mainWindow.loadURL(devUrl);
    // Open devtools so you can see renderer/log errors in dev
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'undocked' });
  } else {
    // In packaged app the react build lives in resources/pack-resources/react-dist
    const packagedIndex = path.join(process.resourcesPath, 'pack-resources', 'react-dist', 'index.html');
    const fallbackIndex = path.join(__dirname, "../react-yt-dl/dist/index.html");
    if (fs.existsSync(packagedIndex)) {
      console.log('Loading packaged UI at', packagedIndex);
      mainWindow.loadFile(packagedIndex);
    } else if (fs.existsSync(fallbackIndex)) {
      console.log('Packaged index not found — using fallback', fallbackIndex);
      mainWindow.loadFile(fallbackIndex);
    } else {
      console.error('No packaged UI found at', packagedIndex, 'and no fallback at', fallbackIndex);
      mainWindow.loadURL('about:blank');
    }
  }

  // Helpful loader diagnostics: show a friendly error page if renderer fails
  mainWindow.webContents.on('did-finish-load', () => {
    try { if (isDev) console.log('Renderer loaded', mainWindow.webContents.getURL()); } catch (err) { if (isDev) console.log('Renderer loaded (could not read URL)'); }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error('did-fail-load:', { errorCode, errorDescription, validatedURL, isMainFrame });
    if (isMainFrame) {
      // Render a small helpful page so the user/developer can see why app is blank
      const html = `
        <html><body style="font-family:system-ui,Segoe UI,Arial;margin:40px;">
          <h1 style="color:#c00">UI failed to load</h1>
          <p><strong>URL:</strong> ${validatedURL}</p>
          <p><strong>Error:</strong> ${errorCode} — ${errorDescription}</p>
          <p>In development, make sure your frontend dev server is running (npm run fe-dev) or check the packaged path.</p>
        </body></html>`;
      mainWindow.loadURL('data:text/html,' + encodeURIComponent(html));
    }
  });
  // Ask before closing
  mainWindow.on("close", (e) => {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: "question",
      buttons: ["Yes", "No"],
      title: "Confirm",
      message: "Are you sure you want to exit the application?"
    });

    if (choice === 1) {
      e.preventDefault();
    } else {
      stopPython();
    }
  });
}

app.whenReady().then(() => {
  startPython();
  createWindow();
});

async function stopPython(timeoutMs = 5000) {
  if (!pyProc || !pyProc.pid) {
    console.log("No python backend process to stop");
    return;
  }

  console.log("Gracefully stopping backend...");

  try {
    // Try HTTP-based graceful shutdown if available
    if (typeof fetch === 'function') {
      await fetch("http://127.0.0.1:5000/shutdown", { method: "POST" });
    }
  } catch (e) {
    console.log("Backend not responding to graceful shutdown", e);
  }

  // Wait for the child process to exit or timeout
  const exitPromise = new Promise((resolve) => {
    if (!pyProc) return resolve(true);
    pyProc.once("exit", () => resolve(true));
  });

  const timed = new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs));

  const exited = await Promise.race([exitPromise, timed]);

  if (exited) {
    console.log("Python backend stopped gracefully");
    return;
  }

  console.log("Graceful shutdown failed or timed out; forcing termination");
  try {
    // Only kill if we still have a pid
    if (pyProc && pyProc.pid) {
      exec(`taskkill /pid ${pyProc.pid} /T /F`, (err, stdout, stderr) => {
        if (err) console.error('taskkill error', err);
      });
      // Clear reference; the exit listener will also clear it when the process terminates
    }
  } catch (err) {
    console.error('Failed to force-kill python backend', err);
  }
}

app.on("before-quit", async (e) => {
  // Ensure we wait for the backend to stop before quitting
  if (pyProc) {
    e.preventDefault();
    await stopPython();
    // allow quit to continue after stop
    app.quit();
  }
});

app.on("window-all-closed", async () => {
  // When all windows are closed, ensure backend is stopped, then quit
  if (pyProc) {
    await stopPython();
  }
  app.quit();
});
