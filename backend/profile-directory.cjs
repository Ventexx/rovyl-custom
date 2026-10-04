"use strict";

const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');

/** Only managed custom icons move; app launch commands and other user paths stay unchanged. */
function relocateIcons(value, oldDir, newDir) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.customIconUrl === 'string') {
    const original = value.customIconUrl;
    try {
      const isUrl = original.startsWith('file:');
      const iconPath = isUrl ? fileURLToPath(original) : original;
      const relative = path.relative(path.join(oldDir, 'custom-icons'), iconPath);
      if (relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
        const destination = path.join(newDir, 'custom-icons', relative);
        if (fs.existsSync(destination)) value.customIconUrl = isUrl ? pathToFileURL(destination).href : destination;
      }
    } catch { /* Non-file URLs and malformed paths are preserved. */ }
  }
  for (const child of Object.values(value)) relocateIcons(child, oldDir, newDir);
}

/** Copy an older profile once, never modifying its source or replacing an existing custom profile. */
function initializeProfileDirectory(appData, log = () => {}) {
  const destination = path.join(appData, 'rovyl-custom');
  const marker = path.join(destination, '.profile-initialized');
  fs.mkdirSync(destination, { recursive: true });
  if (fs.existsSync(marker)) return destination;

  const hasProfile = ['config-v2.json', 'config-v2.json.bak', 'settings.json']
    .some(file => fs.existsSync(path.join(destination, file)));
  if (!hasProfile) {
    const source = ['Rovyl', 'Zenith OS', 'zenith-radial-menu']
      .map(name => path.join(appData, name))
      .find(dir => ['config-v2.json', 'config-v2.json.bak'].some(file => fs.existsSync(path.join(dir, file))));
    if (source) {
      const icons = path.join(source, 'custom-icons');
      if (fs.existsSync(icons)) {
        fs.cpSync(icons, path.join(destination, 'custom-icons'), { recursive: true, force: false });
      }
      for (const file of ['config-v2.json', 'config-v2.json.bak', 'settings.json', 'icon-cache.json']) {
        const from = path.join(source, file);
        const to = path.join(destination, file);
        if (!fs.existsSync(from) || fs.existsSync(to)) continue;
        const contents = fs.readFileSync(from, 'utf8');
        let migrated = contents;
        try {
          const data = JSON.parse(contents);
          relocateIcons(data, source, destination);
          migrated = JSON.stringify(data, null, 2);
        } catch { /* Preserve damaged originals so normal backup recovery can handle them. */ }
        fs.writeFileSync(to, migrated, { flag: 'wx' });
      }
      log(`[Persist] Copied profile from ${source} to ${destination}`);
    }
  }
  // This survives a settings reset, preventing old settings from being imported again.
  fs.writeFileSync(marker, 'Initialized local profile\n');
  return destination;
}

module.exports = { initializeProfileDirectory };
