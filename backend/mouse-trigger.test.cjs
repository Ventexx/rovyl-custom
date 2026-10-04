const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the actual helper transport without installing a global Windows hook.
function transport() {
  const source = fs.readFileSync(path.join(__dirname, 'electron-main.js'), 'utf8');
  const writes = [];
  const events = [];
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { writable: true, write: value => writes.push(value.trim()) };
  const context = vm.createContext({
    process: { platform: 'win32', pid: 123 }, path, __dirname, isDev: true,
    spawn: () => child, diagLog() {}, isAppQuitting: false, setTimeout, clearTimeout,
    events,
    lastMouseContext: 'CONTEXT -1',
  });
  vm.runInContext(source.slice(source.indexOf('let radialMouseBlocker = null;'),
    source.indexOf('\nfunction stopRadialMouseBlocker()')), context);
  vm.runInContext('radialTriggerListener = text => events.push(text)', context);
  return { writes, events, run: code => vm.runInContext(code, context),
    output: text => { child.stdout.emit('data', Buffer.from(text)); if (writes[0] === 'CONTEXT -1') writes.shift(); } };
}

test('startup cleanup cannot discard the forward-button capture', () => {
  const t = transport();
  t.run('setRadialTriggerCapture(6, "click", 6); clearRadialMouseBlocking()');
  t.output('READY\r\n');
  assert.deepEqual(t.writes, ['TRIGGER 6 click 6']);
});

test('startup restores both trigger and blocking state', () => {
  const t = transport();
  t.run('setRadialTriggerCapture(6, "hold", 6); writeRadialMouseBlocker("BLOCK 1 2 3 4 0 0 100 100")');
  t.output('READY\n');
  assert.deepEqual(t.writes, ['TRIGGER 6 hold 6', 'BLOCK 1 2 3 4 0 0 100 100']);
});

test('disabled trigger is not restored when helper finishes starting', () => {
  const t = transport();
  t.run('setRadialTriggerCapture(6, "click", 6); clearRadialTriggerCapture()');
  t.output('READY\n');
  assert.deepEqual(t.writes, ['TRIGGER OFF']);
});

test('pipe chunks preserve split ready and button events', () => {
  const t = transport();
  t.run('setRadialTriggerCapture(6, "click", 6); clearRadialMouseBlocking()');
  t.output('REA');
  assert.deepEqual(t.writes, []);
  t.output('DY\r\nTRIGGER_DO');
  t.output('WN\nTRIGGER_');
  t.output('UP\n');
  assert.deepEqual(t.writes, ['TRIGGER 6 click 6']);
  assert.deepEqual(t.events, ['TRIGGER_DOWN\n', 'TRIGGER_UP\n']);
});
