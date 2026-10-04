const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'electron-main.js'), 'utf8');
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
