const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'electron-main.js'), 'utf8');
function fullscreenHarness(scale = 1, autoHide = false, origin = 0) {
  const bounds = { x: origin, y: 0, width: 1920, height: 1080 };
  const context = vm.createContext({
    path, app: { getPath: () => 'rovyl.exe' }, process: { platform: 'win32' },
    screen: {
      screenToDipRect: (_window, rect) => Object.fromEntries(Object.entries(rect).map(([key, value]) => [key, value / scale])),
      getDisplayNearestPoint: () => ({ bounds, workArea: { ...bounds, height: autoHide ? 1080 : 1040 } }),
    },
  });
  vm.runInContext(source.slice(source.indexOf('function isBoundsFullscreenMonitor('), source.indexOf('function isForegroundWindowFullscreen(')), context);
  return rect => context.isBoundsFullscreenMonitor(rect, 'browser.exe');
}
test('fullscreen detection allows maximized windows and rejects oversized window borders', () => {
  const check = fullscreenHarness();
  assert.equal(check({ x: 0, y: 0, width: 1920, height: 1040 }), false);
  assert.equal(check({ x: -8, y: -8, width: 1936, height: 1056 }), false);
  assert.equal(check({ x: -8, y: -8, width: 1936, height: 1096 }), false);
  assert.equal(check({ x: 0, y: 0, width: 1920, height: 1080 }), true);
});
test('fullscreen detection accounts for display scaling, secondary monitors and hidden taskbars', () => {
  assert.equal(fullscreenHarness(1.5)({ x: 0, y: 0, width: 2880, height: 1560 }), false);
  assert.equal(fullscreenHarness(1.5)({ x: 0, y: 0, width: 2880, height: 1620 }), true);
  assert.equal(fullscreenHarness(1, true)({ x: 0, y: 0, width: 1920, height: 1080 }), true);
  assert.equal(fullscreenHarness(1, false, -1920)({ x: -1920, y: 0, width: 1920, height: 1080 }), true);
});
function setup(config, foreground) {
  const context = vm.createContext({
    gameModeConfig: config, Date, Number,
    getActiveWinModule: () => async () => foreground,
    parseBlockedAppTokens: value => value.split(','),
    foregroundMatchesBlockedList: (fg, tokens) => tokens.includes(fg.owner.path),
    isForegroundWindowFullscreen: fg => fg.fullscreen,
    radialMouseBlockerReady: false,
  });
  vm.runInContext(source.slice(source.indexOf('// Explicit pause rules.'), source.indexOf('let tray = null;')), context);
  return { run: code => vm.runInContext(code, context) };
}
test('fullscreen and selected-app rules operate independently', async () => {
  const fg = { id: 42, owner: { path: 'game.exe' }, fullscreen: false };
  const config = { pauseFullscreen: true, pauseSelected: false, blockedApps: 'game.exe' };
  const t = setup(config, fg);
  assert.equal((await t.run('getPauseDecision()')).context, 42);
  fg.fullscreen = true;
  assert.equal((await t.run('getPauseDecision()')).reason, 'Paused — fullscreen app');
  fg.fullscreen = false;
  config.pauseSelected = true;
  assert.equal((await t.run('getPauseDecision()')).reason, 'Paused — selected app');
});
test('manual pause expires and automatic rules still apply after resume', async () => {
  const t = setup({ pauseSelected: true, blockedApps: 'game.exe' }, { id: 42, owner: { path: 'game.exe' } });
  t.run('pauseUntil = Date.now() + 1800000');
  assert.equal((await t.run('getPauseDecision()')).reason, 'Paused for 30 minutes');
  t.run('pauseUntil = Date.now() - 1');
  assert.equal((await t.run('getPauseDecision()')).reason, 'Paused — selected app');
});
test('unknown foreground passes mouse through; disabled rules allow all windows', async () => {
  const config = { pauseFullscreen: true };
  const t = setup(config, null);
  assert.equal((await t.run('getPauseDecision()')).context, 0);
  config.pauseFullscreen = false;
  assert.equal((await t.run('getPauseDecision()')).context, -1);
});
