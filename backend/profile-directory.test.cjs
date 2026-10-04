const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { initializeProfileDirectory } = require('./profile-directory.cjs');

function fixture(t) {
  const base = path.resolve(os.tmpdir());
  const root = fs.mkdtempSync(path.join(base, 'rovyl-profile-test-'));
  t.after(() => {
    if (path.dirname(root) !== base || !path.basename(root).startsWith('rovyl-profile-test-')) throw Error('Unsafe test cleanup path');
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}

test('copies Rovyl settings and managed icons without changing the original', t => {
  const root = fixture(t), old = path.join(root, 'Rovyl');
  fs.mkdirSync(path.join(old, 'custom-icons'), { recursive: true });
  const icon = path.join(old, 'custom-icons', 'custom.png');
  fs.writeFileSync(icon, 'test image');
  const original = JSON.stringify({ config: { workspaces: [{ apps: [{ customIconUrl: pathToFileURL(icon).href, command: 'calc' }] }] } });
  fs.writeFileSync(path.join(old, 'config-v2.json'), original);
  const destination = initializeProfileDirectory(root);
  assert.equal(destination, path.join(root, 'rovyl-custom'));
  const copied = JSON.parse(fs.readFileSync(path.join(destination, 'config-v2.json')));
  assert.equal(copied.config.workspaces[0].apps[0].customIconUrl, pathToFileURL(path.join(destination, 'custom-icons', 'custom.png')).href);
  assert.equal(copied.config.workspaces[0].apps[0].command, 'calc');
  assert.equal(fs.readFileSync(path.join(old, 'config-v2.json'), 'utf8'), original);
  fs.unlinkSync(path.join(destination, 'config-v2.json'));
  initializeProfileDirectory(root);
  assert.equal(fs.existsSync(path.join(destination, 'config-v2.json')), false, 'reset must not reimport old settings');
});

test('does not replace an existing custom profile', t => {
  const root = fixture(t);
  for (const name of ['Rovyl', 'rovyl-custom']) {
    fs.mkdirSync(path.join(root, name));
    fs.writeFileSync(path.join(root, name, 'config-v2.json'), JSON.stringify({ name }));
  }
  const destination = initializeProfileDirectory(root);
  assert.equal(JSON.parse(fs.readFileSync(path.join(destination, 'config-v2.json'))).name, 'rovyl-custom');
});

test('migrates a backup-only profile and handles a fresh installation', t => {
  const root = fixture(t);
  const old = path.join(root, 'Rovyl');
  fs.mkdirSync(old);
  fs.writeFileSync(path.join(old, 'config-v2.json.bak'), '{"backup":true}');
  const destination = initializeProfileDirectory(root);
  assert.equal(JSON.parse(fs.readFileSync(path.join(destination, 'config-v2.json.bak'))).backup, true);
  const fresh = fixture(t);
  assert.equal(fs.existsSync(path.join(initializeProfileDirectory(fresh), '.profile-initialized')), true);
});
