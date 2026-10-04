const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const source = fs.readFileSync(path.join(__dirname, 'electron-main.js'), 'utf8');

function openingHarness() {
  const ipcMain = new EventEmitter();
  const immediate = [];
  const timers = new Set();
  const sent = [];
  const state = { visible: false, interactive: false, shows: 0, hides: 0 };
  const bounds = { x: 0, y: 0, width: 900, height: 900 };
  const window = {
    isDestroyed: () => false, isMinimized: () => false,
    isVisible: () => state.visible, getBounds: () => bounds,
    setSkipTaskbar() {}, setOpacity() {}, setAlwaysOnTop() {}, focus() {},
    setIgnoreMouseEvents: ignore => { state.interactive = !ignore; },
    hide: () => { state.visible = false; state.hides++; },
    showInactive: () => { state.visible = true; state.shows++; },
    webContents: {
      isDestroyed: () => false, setBackgroundThrottling() {}, focus() {},
      send: (channel, payload) => sent.push({ channel, payload }),
    },
  };
  const context = vm.createContext({
    mainWindow: window, ipcMain, screen: { getPrimaryDisplay: () => ({ bounds }) },
    nativeWindowSizeMode: 'small', rendererPanelVisible: false,
    panelOverlayActive: false, panelOverlayKeptWindow: false,
    windowBuriedPassive: false, pendingWindowSize: null,
    clearSkipTaskbarHideTimer() {}, clearRadialMouseBlocking() {}, diagLog() {},
    radialModeBounds: () => bounds, boundsApproxEqual: () => true,
    updateWindowSize() {}, process: { platform: 'win32' },
    setImmediate: fn => immediate.push(fn),
    setTimeout: fn => { const timer = { fn, unref() {} }; timers.add(timer); return timer; },
    clearTimeout: timer => timers.delete(timer),
  });
  const start = source.indexOf('let radialOpenPaintSequence = 0;');
  const end = source.indexOf('\n/**\n * Em `small`', start);
  vm.runInContext(source.slice(start, end), context);
  return {
    state, window, sent, ipcMain,
    run: code => vm.runInContext(code, context),
    paint: () => {
      const open = sent.filter(item => item.channel === 'open-menu').at(-1);
      ipcMain.emit('radial-open-paint-done', { sender: window.webContents }, open.payload.paintToken);
    },
    flush: () => { while (immediate.length) immediate.shift()(); },
    timeout: () => { for (const timer of [...timers]) { timers.delete(timer); timer.fn(); } },
  };
}

test('a closed opening cannot reveal itself after its paint acknowledgement', () => {
  const h = openingHarness();
  h.run('showMenuAtCursor()');
  h.paint();
  h.run('releaseOverlayInput(mainWindow)');
  h.flush();
  assert.equal(h.state.shows, 0);
  assert.equal(h.state.interactive, false);
});

test('a missed paint deadline releases input instead of revealing a blank window', () => {
  const h = openingHarness();
  h.run('showMenuAtCursor()');
  h.timeout();
  h.paint();
  h.flush();
  assert.equal(h.state.shows, 0);
  assert.equal(h.state.interactive, false);
  assert.equal(h.ipcMain.listenerCount('radial-open-paint-done'), 0);
});

test('a confirmed current opening reveals normally', () => {
  const h = openingHarness();
  h.run('showMenuAtCursor()');
  h.paint();
  h.flush();
  h.timeout();
  assert.equal(h.state.shows, 1);
  assert.equal(h.state.interactive, true);
  assert(h.sent.some(item => item.channel === 'radial-native-revealed'));
});

test('input release still hides the window if mouse passthrough fails', () => {
  const h = openingHarness();
  h.window.setIgnoreMouseEvents = () => { throw new Error('native failure'); };
  h.run('releaseOverlayInput(mainWindow)');
  assert.equal(h.state.hides, 1);
});

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
