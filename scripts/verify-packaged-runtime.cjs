// Run with the packaged Electron executable in Node mode. Never start the user's app.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(process.argv[2]);
const inside = file => {
  const p = path.resolve(file).toLowerCase();
  return p.startsWith(root.toLowerCase() + path.sep) ||
    p.startsWith(root.toLowerCase() + '.unpacked' + path.sep);
};
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  const result = resolve.call(this, request, parent, ...rest);
  if (parent?.filename && inside(parent.filename) && !Module.isBuiltin(result)) {
    assert.ok(inside(result), `Packaged dependency escaped into development files: ${request}`);
  }
  return result;
};
const appRequire = Module.createRequire(path.join(root, 'package.json'));
const timeout = setTimeout(() => { console.error('Packaged runtime verification timed out'); process.exit(1); }, 30000);
(async () => {
  const manifest = appRequire('./package.json');
  for (const name of Object.keys(manifest.dependencies)) {
    assert.ok(fs.existsSync(path.join(root, 'node_modules', name, 'package.json')),
      `Missing packaged dependency: ${name}`);
  }
  const keyboard = appRequire('node-global-key-listener');
  assert.equal(typeof keyboard.GlobalKeyboardListener, 'function');
  const keyboardDir = path.dirname(appRequire.resolve('node-global-key-listener/package.json'));
  assert.ok(fs.existsSync(path.join(keyboardDir, 'bin', 'WinKeyServer.exe')));
  const nativeRequire = Module.createRequire(appRequire.resolve('active-win/package.json'));
  const binding = nativeRequire('@mapbox/node-pre-gyp').find(appRequire.resolve('active-win/package.json'));
  assert.ok(inside(binding) && fs.existsSync(binding), 'Missing packaged active-win native binding');
  assert.ok(Array.isArray(await appRequire('active-win').getOpenWindows()));
  const sqlDist = path.dirname(appRequire.resolve('sql.js'));
  const SQL = await appRequire('sql.js')({ locateFile: file => path.join(sqlDist, file) });
  const db = new SQL.Database();
  assert.equal(db.exec('SELECT 42')[0].values[0][0], 42);
  db.close();
  console.log(`Packaged runtime ${manifest.version}: all production packages present; keyboard helper, native window detection and SQLite passed without external dependencies.`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => clearTimeout(timeout));
