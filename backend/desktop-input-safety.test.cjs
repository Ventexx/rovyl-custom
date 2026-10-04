const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'electron-main.js'), 'utf8');

test('opening the wheel never requests a monitor-wide mouse blocker', () => {
  let cleared = false;
  const start = source.indexOf('function setRadialMouseBlocking(');
  const end = source.indexOf('\n/**', start);
  const context = vm.createContext({ clearRadialMouseBlocking: () => { cleared = true; } });
  vm.runInContext(source.slice(start, end), context);
  vm.runInContext('setRadialMouseBlocking({}, {})', context);
  assert.equal(cleared, true);
});

test('idle overlay is hidden and cannot cover another app', async () => {
  let callback;
  let hidden = false;
  let passthrough = false;
  const bounds = { x: 0, y: 0, width: 900, height: 900 };
  const context = vm.createContext({
    ipcMain: { handle: (_channel, fn) => { callback = fn; } },
    mainWindow: {
      isDestroyed: () => false, isMinimized: () => false, getBounds: () => bounds,
      setShape() {}, setIgnoreMouseEvents: value => { passthrough = value; },
      setVisibleOnAllWorkspaces() {}, hide: () => { hidden = true; },
      webContents: { setBackgroundThrottling() {} },
    },
    nativeWindowSizeMode: 'small', lastWindowHitShapeKey: '', windowBuriedPassive: false,
    screen: { getPrimaryDisplay: () => ({ bounds }) }, smallModeBounds: () => bounds,
    boundsApproxEqual: () => true, diagLog() {},
  });
  const start = source.indexOf('ipcMain.handle("collapse-idle-overlay"');
  const end = source.indexOf('/** Re-run', start);
  vm.runInContext(source.slice(start, end), context);
  assert.equal(await callback(), true);
  assert.equal(hidden, true);
  assert.equal(passthrough, true);
});
