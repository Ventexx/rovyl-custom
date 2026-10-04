"use strict";

/** Only bundled/local content is allowed. Development additionally needs Vite and HMR. */
function isAllowedRequest(value, isDev = false) {
  try {
    const target = new URL(value);
    if (target.protocol === 'file:') return !target.hostname;
    if (['data:', 'blob:', 'devtools:'].includes(target.protocol)) return true;
    if (target.href === 'about:blank') return true;
    return isDev &&
      ['http:', 'ws:'].includes(target.protocol) &&
      ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) &&
      target.port === '5173' && !target.username && !target.password;
  } catch {
    return false;
  }
}

function installOfflinePolicy(session, isDev) {
  session.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isAllowedRequest(details.url, isDev) });
  });
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
}

module.exports = { isAllowedRequest, installOfflinePolicy };
