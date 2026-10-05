// Exercise runtime dependencies and Windows APIs without showing UI or changing user settings.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');

if (!process.versions.electron) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = require('node:child_process').spawn(require('electron'), [__filename], {
    env, stdio: 'inherit', windowsHide: true,
  });
  child.on('error', error => { console.error(error); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
} else {
  const { app, BrowserWindow, nativeImage, screen } = require('electron');
  app.setPath('userData', path.join(root, 'build-out', 'native-smoke-profile'));
  const timeout = setTimeout(() => { console.error('Native smoke timed out'); app.exit(1); }, 30000);
  app.whenReady().then(async () => {
    assert.equal(process.platform, 'win32', 'This smoke test verifies the Windows target');
    const appRoot = process.env.ROVYL_SMOKE_APP_ROOT || root;
    if (process.env.ROVYL_SMOKE_APP_ROOT) {
      // Do not let createRequire silently use node_modules above the packaged app.
      for (const name of ['active-win', 'node-global-key-listener', 'sql.js']) {
        assert.ok(fs.existsSync(path.join(appRoot, 'node_modules', name, 'package.json')),
          `Missing packaged dependency: ${name}`);
      }
    }
    const appRequire = createRequire(path.join(appRoot, 'package.json'));
    const activeWinRequire = createRequire(appRequire.resolve('active-win/package.json'));
    const bindingPath = activeWinRequire('@mapbox/node-pre-gyp').find(appRequire.resolve('active-win/package.json'));
    assert.ok(fs.existsSync(bindingPath), 'active-win must have a real native binding, not its silent fallback');
    const activeWin = appRequire('active-win');
    const windows = await activeWin.getOpenWindows();
    assert.ok(Array.isArray(windows), 'native window enumeration must return an array');
    assert.ok(Array.isArray(activeWin.getOpenWindowsSync()));
    const current = await activeWin();
    if (current) {
      assert.equal(typeof current.id, 'number');
      assert.equal(typeof current.bounds.width, 'number');
      assert.equal(typeof current.owner.processId, 'number');
    }
    const listenerRoot = path.dirname(appRequire.resolve('node-global-key-listener/package.json'));
    assert.ok(fs.existsSync(path.join(listenerRoot, 'bin', 'WinKeyServer.exe')), 'keyboard helper must be packaged');
    assert.equal(typeof appRequire('node-global-key-listener').GlobalKeyboardListener, 'function');
    const sqlDist = path.dirname(appRequire.resolve('sql.js'));
    const SQL = await appRequire('sql.js')({ locateFile: file => path.join(sqlDist, file) });
    const database = new SQL.Database();
    assert.equal(database.exec('SELECT 42 AS answer')[0].values[0][0], 42);
    database.close();

    const window = new BrowserWindow({
      show: false, width: 420, height: 420, frame: false, transparent: true,
      hasShadow: false, thickFrame: false, backgroundColor: '#00000000',
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    await window.loadURL('data:text/html,<html><body style="margin:0;background:transparent"></body></html>');
    assert.equal(window.isVisible(), false);
    assert.ok(window.getNativeWindowHandle().readBigUInt64LE(0) > 0n);
    window.setShape([{ x: 0, y: 0, width: 100, height: 100 }]);
    window.setShape([]);
    window.setIgnoreMouseEvents(true, { forward: true });
    window.setIgnoreMouseEvents(false);
    window.webContents.setBackgroundThrottling(false);
    window.webContents.setBackgroundThrottling(true);
    window.setBounds({ x: 0, y: 0, width: 500, height: 500 });
    assert.equal(window.getBounds().width, 500);
    assert.ok(screen.getAllDisplays().length > 0);
    assert.ok(!nativeImage.createFromPath(path.join(appRoot, 'dist', 'icon.png')).isEmpty());
    const shellIcon = await app.getFileIcon(process.execPath, { size: 'large' });
    assert.ok(!shellIcon.isEmpty());
    window.destroy();
    clearTimeout(timeout);
    console.log(`Native smoke passed on Electron ${process.versions.electron}: active-win binding, window enumeration, keyboard helper, SQLite, HWND, transparency setup, shape, mouse passthrough, sizing and icons.`);
    app.exit(0);
  }).catch(error => { console.error(error); app.exit(1); });
}
