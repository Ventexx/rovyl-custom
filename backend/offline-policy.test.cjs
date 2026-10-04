const test = require('node:test');
const assert = require('node:assert/strict');
const { isAllowedRequest, installOfflinePolicy } = require('./offline-policy.cjs');

test('packaged app blocks network requests, including legacy icon services and loopback', () => {
  for (const value of [
    'https://www.google.com/s2/favicons?domain=example.com',
    'https://wttr.in/?format=j1', 'https://api.github.com/repos/example/app/releases',
    'http://localhost:5173', 'ws://localhost:5173', 'https://example.com/icon.png',
    'ftp://example.com/file', 'file://server/share/icon.png', 'not a URL',
  ]) assert.equal(isAllowedRequest(value), false, value);
});

test('development only permits the local Vite server and its websocket', () => {
  for (const value of ['http://localhost:5173/src/main.tsx', 'ws://127.0.0.1:5173/', 'http://[::1]:5173/']) {
    assert.equal(isAllowedRequest(value, true), true, value);
  }
  for (const value of ['http://localhost:3892/', 'http://localhost.example.com:5173/', 'https://example.com/', 'http://localhost:5173@example.com/']) {
    assert.equal(isAllowedRequest(value, true), false, value);
  }
});

test('bundled images and local renderer assets remain available', () => {
  for (const value of ['file:///C:/app/dist/index.html', 'data:image/png;base64,AA==', 'blob:file:///test', 'about:blank']) {
    assert.equal(isAllowedRequest(value), true, value);
  }
});

test('session registration enforces cancellation and denies permission requests', () => {
  const handlers = {};
  installOfflinePolicy({
    webRequest: { onBeforeRequest: fn => { handlers.request = fn; } },
    setPermissionRequestHandler: fn => { handlers.permission = fn; },
    setPermissionCheckHandler: fn => { handlers.check = fn; },
  }, false);
  handlers.request({ url: 'https://example.com' }, result => assert.equal(result.cancel, true));
  handlers.request({ url: 'file:///C:/app/icon.png' }, result => assert.equal(result.cancel, false));
  handlers.permission(null, 'geolocation', result => assert.equal(result, false));
  assert.equal(handlers.check(), false);
});
