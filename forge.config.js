const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require("path");

module.exports = {

  packagerConfig: {
    asar: true,
    // Copy build outputs into pack-resources so packaging keeps a clear staging
    // area and avoids colliding on the same `dist` folder names.
    extraResource: [
      "pack-resources/python-dist",
      "pack-resources/react-dist",
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: "yt_dl_app"
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  hooks: {
    generateAssets: async () => {
      // Build UI and backend, ensure a runnable Python binary is placed
      // into python-dist so the packaged app can find it.
      const { execSync } = require("child_process");

      console.log('Building React UI');
      try {
        execSync("cd react-yt-dl && npm ci && npm run build", { stdio: "inherit" });
      } catch (err) {
        console.warn('`npm ci` failed, falling back to `npm install` (non-frozen install)');
        execSync("cd react-yt-dl && npm install && npm run build", { stdio: "inherit" });
      }

      console.log('Building Python backend');
      // Choose a PyInstaller command that exists on the host
      let pyInstallerCmd = 'pyinstaller';
      try {
        execSync('pyinstaller --version', { stdio: 'ignore' });
      } catch (err) {
        try {
          execSync('python -m PyInstaller --version', { stdio: 'ignore' });
          pyInstallerCmd = 'python -m PyInstaller';
        } catch (err2) {
          throw new Error('PyInstaller is not installed or not available on PATH. Install it or ensure `python -m PyInstaller` works.');
        }
      }

      // Produce a single-file binary with PyInstaller
      execSync(`cd python-yt-dl && ${pyInstallerCmd} --onefile main.py`, { stdio: 'inherit' });

      // Copy build outputs to a staging folder used by the packager.
      const fs = require('fs');
      const fspath = require('path');

      const projectRoot = __dirname;
      const packRoot = fspath.join(projectRoot, 'pack-resources');

      // Ensure a clean staging folder
      if (fs.existsSync(packRoot)) {
        // remove recursively
        try { fs.rmSync(packRoot, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
      }
      fs.mkdirSync(packRoot, { recursive: true });

      const srcUi = fspath.join(projectRoot, 'react-yt-dl', 'dist');
      const srcPy = fspath.join(projectRoot, 'python-yt-dl', 'dist');
      const dstUi = fspath.join(packRoot, 'react-dist');
      const dstPy = fspath.join(packRoot, 'python-dist');

      // Helper: recursive copy with fallback for older Node versions
      function copyRecursiveSync(src, dest) {
        if (!fs.existsSync(src)) return;
        try {
          // Use fs.cpSync when available (Node >= 16.7)
          if (typeof fs.cpSync === 'function') {
            fs.cpSync(src, dest, { recursive: true });
            return;
          }
        } catch (err) {
          // fallthrough to manual copy
        }

        // Manual recursive copy
        fs.mkdirSync(dest, { recursive: true });
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = fspath.join(src, entry.name);
          const destPath = fspath.join(dest, entry.name);
          if (entry.isDirectory()) {
            copyRecursiveSync(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      }

      copyRecursiveSync(srcUi, dstUi);
      copyRecursiveSync(srcPy, dstPy);

      // Validate PyInstaller output and copy a canonical filename for runtime
      const platform = process.platform; // 'win32'|'darwin'|'linux'
      const expectedName = platform === 'win32' ? 'main.exe' : 'main';

      function findExecutableFolder(root) {
        if (!fs.existsSync(root)) return null;
        const entries = fs.readdirSync(root, { withFileTypes: true });
        const candidates = [];
        for (const e of entries) {
          if (e.isFile()) {
            const name = e.name.toLowerCase();
            // windows executables
            if (platform === 'win32' && name.endsWith('.exe')) candidates.push(e.name);
            // unix executables (no extension) — check all files too
            if (platform !== 'win32' && !name.includes('.')) candidates.push(e.name);
          }
          // sometimes PyInstaller produces nested directories (one-folder mode)
          if (e.isDirectory()) {
            const nested = fs.readdirSync(fspath.join(root, e.name), { withFileTypes: true });
            for (const ne of nested) {
              if (ne.isFile()) {
                const name = ne.name.toLowerCase();
                if (platform === 'win32' && name.endsWith('.exe')) candidates.push(fspath.join(e.name, ne.name));
                if (platform !== 'win32' && !name.includes('.')) candidates.push(fspath.join(e.name, ne.name));
              }
            }
          }
        }
        return candidates.length ? candidates[0] : null;
      }

      const found = findExecutableFolder(dstPy);
      if (!found) {
        console.error('No runnable python binary found in', dstPy);
        // Fail early so packaged app won't error at runtime
        throw new Error(`PyInstaller did not produce a runnable binary in ${srcPy} — packaging cannot continue.`);
      }

      // Ensure we have a predictable filename for runtime lookups
      const foundPath = fspath.join(dstPy, found);
      const canonicalPath = fspath.join(dstPy, expectedName);
      if (foundPath !== canonicalPath) {
        try {
            // Copy the found executable to the canonical name so runtime can
            // always look for pack-resources/python-dist/${expectedName}
          fs.copyFileSync(foundPath, canonicalPath);
          console.log('Copying packaged python executable', foundPath, '->', canonicalPath);
        } catch (err) {
          console.warn('Failed to copy executable into canonical name:', err);
        }
      }
    },
  },
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
