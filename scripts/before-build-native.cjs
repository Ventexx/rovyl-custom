const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const { promisify } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);

module.exports = async function beforePackNative(packContext) {
  const context = {
    appDir: packContext.packager.info.appDir,
    platform: { nodeName: packContext.electronPlatformName },
    arch: require('builder-util').Arch[packContext.arch],
  };
  if (context.platform.nodeName !== 'win32') return true;
  const appRequire = createRequire(path.join(context.appDir, 'package.json'));
  const activeWinManifest = appRequire.resolve('active-win/package.json');
  const nativeRequire = createRequire(activeWinManifest);
  const manifest = nativeRequire('./package.json');
  // active-win 8 ships a stable Node-API binary. The new rebuilder overlooks its
  // optional node-pre-gyp dependency and needlessly falls back to a C++ build.
  // Limit this exception to the verified package; other native modules still rebuild.
  assert.equal(manifest.version, '8.2.1', 'Revalidate the prebuilt hook when updating active-win');
  assert.ok(manifest.binary.napi_versions.includes(6));
  const options = { target_platform: 'win32', target_arch: context.arch };
  const preGyp = nativeRequire('@mapbox/node-pre-gyp');
  const binaryPath = preGyp.find(activeWinManifest, options);
  if (!fs.existsSync(binaryPath)) {
    const preGypManifestPath = nativeRequire.resolve('@mapbox/node-pre-gyp/package.json');
    const preGypManifest = nativeRequire('@mapbox/node-pre-gyp/package.json');
    const cli = path.resolve(path.dirname(preGypManifestPath), preGypManifest.bin);
    await execFile(process.execPath, [cli, 'install', '--target_platform=win32',
      `--target_arch=${context.arch}`, '--napi_build_version=6'], {
      cwd: path.dirname(activeWinManifest), windowsHide: true,
    });
  }
  assert.ok(fs.existsSync(binaryPath), `Missing active-win binary for ${context.arch}`);
  const builderRequire = createRequire(appRequire.resolve('app-builder-lib/package.json'));
  const rebuildRequire = createRequire(builderRequire.resolve('@electron/rebuild'));
  const { readBinaryFileArch } = await import(pathToFileURL(rebuildRequire.resolve('read-binary-file-arch')).href);
  assert.equal(await readBinaryFileArch(binaryPath), context.arch, 'Native binary architecture must match installer');
  if (process.platform === 'win32' && process.arch === context.arch) {
    const binding = nativeRequire(binaryPath);
    assert.equal(typeof binding.getActiveWindow, 'function');
    assert.equal(typeof binding.getOpenWindows, 'function');
  }
  const { rebuild } = await import(pathToFileURL(builderRequire.resolve('@electron/rebuild')).href);
  await rebuild({
    buildPath: context.appDir,
    electronVersion: context.electronVersion || appRequire('electron/package.json').version,
    platform: 'win32', arch: context.arch,
    ignoreModules: ['active-win'], disablePreGypCopy: true,
  });
  console.log(`before-build-native: verified active-win Node-API binary (${context.arch}); rebuilt other native modules`);
  // Run as beforePack, not a beforeBuild hook returning false: that return value
  // suppresses production dependency collection in electron-builder 26.
};
