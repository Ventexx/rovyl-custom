// Hidden-window integration check: real built UI/preload, isolated profile, simulated local IPC.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

if (!process.versions.electron) {
  const { spawn } = require('node:child_process');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), [__filename], { env, stdio: 'inherit', windowsHide: true });
  child.on('error', error => { console.error(error); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
} else {
  const { app, BrowserWindow, ipcMain, session } = require('electron');
  const { installOfflinePolicy } = require('../backend/offline-policy.cjs');
  app.setPath('userData', path.join(root, 'build-out', 'renderer-smoke-profile'));
  const timeout = setTimeout(() => { console.error('Renderer smoke test timed out'); app.exit(1); }, 40000);
  app.whenReady().then(async () => {
    const ts = require('typescript');
    const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'src/defaults.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText;
    const defaults = {};
    new Function('exports', compiled)(defaults);
    const fixture = { ...defaults.DEFAULT_UI_CONFIG, mainStartMenuDiscoveryDone: true };
    fixture.workspaces = [{ ...fixture.workspaces[0], apps: [{
      id: 'offline-smoke-link', label: 'Saved website', command: 'https://example.invalid',
      commandType: 'url', iconName: 'Globe', iconSource: 'native',
      customIconUrl: 'https://example.invalid/old-icon.png', description: '',
    }] }];
    const values = {
      'get-full-config': { user: null, apps: fixture.workspaces[0].apps, config: fixture },
      'get-settings': fixture, 'get-app-version': '1.2.6', 'was-opened-at-login': false,
      'get-installed-apps': [{ Name: 'Test Browser', Path: 'C:\\Apps\\browser.exe' }, { Name: 'Test Editor', Path: 'C:\\Apps\\editor.exe' }], 'get-startup-apps': [],
      'get-file-icon': null, 'get-config-persistence-meta': { primaryBytes: 1, backupBytes: 0 },
      'get-main-window-content-bounds': { x: 0, y: 0, width: 1100, height: 800 },
      'save-full-config': { ok: true }, 'app-supports-recents': false,
    };
    // Register every current invoke channel so optional layout calls behave like successful local IPC.
    const preload = fs.readFileSync(path.join(root, 'backend/electron-preload.js'), 'utf8');
    let lastSaved = null;
    for (const [, channel] of preload.matchAll(/ipcRenderer\.invoke\("([^"]+)"/g)) {
      ipcMain.handle(channel, (_event, payload) => {
        if (channel === 'save-full-config') lastSaved = payload;
        return channel in values ? values[channel] : true;
      });
    }
    for (const channel of ['save-full-config-sync', 'set-panel-surface-visible']) {
      ipcMain.on(channel, event => { event.returnValue = true; });
    }
    installOfflinePolicy(session.defaultSession, false);
    await session.defaultSession.clearStorageData();
    const window = new BrowserWindow({
      show: false, width: 1100, height: 800,
      webPreferences: { preload: path.join(root, 'backend/electron-preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, offscreen: true },
    });
    const errors = [];
    window.webContents.on('console-message', (_event, level, message) => {
      if (level >= 3 && !message.includes('Content Security Policy')) errors.push(message);
    });
    await window.loadFile(path.join(root, 'dist/index.html'));
    const waitFor = async expression => {
      for (let i = 0; i < 80; i++) {
        if (await window.webContents.executeJavaScript(expression)) return;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const text = await window.webContents.executeJavaScript('document.body.innerText');
      throw new Error(`UI condition failed: ${expression}\n${text.slice(0, 1800)}`);
    };
    await waitFor('!!document.querySelector("#root")?.children.length');
    // Let persistence hydrate before simulating the settings IPC event.
    await new Promise(resolve => setTimeout(resolve, 500));
    window.webContents.send('open-settings');
    await waitFor('document.body.innerText.includes("Workspaces") && document.body.innerText.includes("Advanced")');
    const visible = await window.webContents.executeJavaScript('document.body.innerText');
    assert.ok(!visible.includes('Check for updates'));
    assert.ok(!visible.includes('Sign in'));
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Advanced'))?.click()`);
    await waitFor('document.body.innerText.includes("Export settings")');
    await waitFor('document.body.innerText.includes("In fullscreen apps") && document.body.innerText.includes("In selected apps")');
    assert.ok(!(await window.webContents.executeJavaScript('document.body.innerText')).includes('Detect games automatically'));
    assert.ok(!(await window.webContents.executeJavaScript('document.body.innerText')).includes('Check for updates'));
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Appearance').click()`);
    await waitFor('!!document.querySelector("input[aria-labelledby=opacity-label]")');
    const choose = (key, text) => window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('[aria-labelledby="${key}-label"] button')).find(b => b.textContent === '${text}').click()`);
    await choose('theme', 'White');
    await waitFor(`document.querySelector('[aria-labelledby="theme-label"] [aria-checked="true"]')?.textContent === 'White'`);
    await choose('theme', 'Black');
    await choose('labels', 'Always');
    const setSlider = async (key, value) => {
      await window.webContents.executeJavaScript(`(() => {
        const input = document.querySelector('input[aria-labelledby="${key}-label"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '${value}');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      await waitFor(`document.querySelector('input[aria-labelledby="${key}-label"]').value === '${value}'`);
    };
    for (const [key, value] of [['radius', 180], ['iconSize', 80], ['spacing', 25], ['labelSize', 18], ['tileRoundness', 4], ['backdrop', 0], ['opacity', 0.45]]) {
      await setSlider(key, value);
    }
    const openPayload = { x: 550, y: 400, keepPanel: true, preSizedByMain: true, clientPosition: { x: 550, y: 400 }, clientSize: { width: 1100, height: 800 } };
    await window.webContents.executeJavaScript(`window.savedSettingsNode = document.querySelector('.zs-shell'); document.querySelector('.zs-scroll').scrollTop = 100; window.savedSettingsScroll = document.querySelector('.zs-scroll').scrollTop; document.querySelector('[aria-labelledby="locationLabel-label"]').click()`);
    for (const source of ['shortcut', 'mmb-click', 'mmb']) {
      window.webContents.send('prepare-radial-show');
      await new Promise(resolve => setTimeout(resolve, 60));
      window.webContents.send('open-menu', { ...openPayload, source });
      await waitFor(`document.querySelector('[data-wheel-content]')?.style.opacity === '0.45' && document.querySelector('[data-zenith-radial-modal]')?.style.visibility === 'visible'`);
      assert.equal(await window.webContents.executeJavaScript(`document.querySelector('[data-wheel-tile]').style.borderRadius`), '4px');
      assert.equal(await window.webContents.executeJavaScript(`document.querySelector('[data-wheel-label]').style.fontSize`), '18px');
      assert.equal(await window.webContents.executeJavaScript(`document.querySelector('[data-wheel-tile]').parentElement.style.width`), '66px');
      assert.equal(await window.webContents.executeJavaScript(`document.querySelectorAll('[data-wheel-location]').length`), 0);
      assert.ok(await window.webContents.executeJavaScript(`!document.querySelector('.zn-radial-scrim').style.background.includes('0.22') && document.querySelector('.zn-radial-scrim').style.background.includes('rgba(4, 5, 7, 0)')`));
      window.webContents.send('open-menu', { ...openPayload, closeOnly: true });
      await waitFor(`document.querySelector('[data-zenith-radial-modal]')?.style.visibility !== 'visible'`);
      await new Promise(resolve => setTimeout(resolve, 450));
      assert.ok(await window.webContents.executeJavaScript(`window.savedSettingsNode === document.querySelector('.zs-shell') && document.querySelector('.zs-scroll').scrollTop === window.savedSettingsScroll && document.querySelector('input[aria-labelledby="opacity-label"]') !== null`));
    }
    await window.webContents.executeJavaScript(`document.querySelector('[aria-labelledby="locationLabel-label"]').click()`);
    assert.equal(lastSaved.config.wheelOpacity, 0.45);
    assert.equal(lastSaved.config.wheelDimming, 0);
    assert.equal(lastSaved.config.labelSize, 18);
    await choose('labels', 'Hidden');
    window.webContents.send('open-menu', { ...openPayload, source: 'shortcut' });
    await waitFor(`document.querySelector('[data-zenith-radial-modal]')?.style.visibility === 'visible'`);
    assert.equal(await window.webContents.executeJavaScript(`document.querySelectorAll('[data-wheel-location]').length`), 1);
    assert.equal(await window.webContents.executeJavaScript(`document.querySelectorAll('[data-wheel-label]').length`), 0);
    window.webContents.send('open-menu', { ...openPayload, closeOnly: true });
    await new Promise(resolve => setTimeout(resolve, 500));
    await choose('labels', 'On hover');
    await window.webContents.executeJavaScript(`document.querySelectorAll('.zs-reset-slider').forEach(button => button.click())`);
    for (const [key, value] of [['radius', '140'], ['iconSize', '64'], ['spacing', '10'], ['labelSize', '12'], ['tileRoundness', '18'], ['backdrop', '0.28'], ['opacity', '1']]) {
      await waitFor(`document.querySelector('input[aria-labelledby="${key}-label"]').value === '${value}'`);
    }
    await new Promise(resolve => setTimeout(resolve, 300));
    fs.writeFileSync(path.join(root, 'build-out', 'appearance-preview.png'), (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Workspaces'))?.click()`);
    await waitFor('document.body.innerText.includes("Your workspaces")');
    await waitFor(`!!document.querySelector('.zs-ws-card')`);
    await window.webContents.executeJavaScript(`document.querySelector('.zs-ws-card').click()`);
    await waitFor('document.body.innerText.includes("Saved website")');
    const clickText = text => window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(text)})?.click()`);
    await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Change workspace icon"]').click()`);
    await waitFor(`!!document.querySelector('.zs-icon-library')`);
    assert.equal(await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Search icon library"]')`), null);
    await clickText('Gaming');
    await waitFor(`document.querySelectorAll('.zs-icon-library-grid > button').length > 10`);
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.zs-icon-library-toolbar button')).find(b => b.textContent.includes('Search')).click()`);
    await window.webContents.executeJavaScript(`(() => { const input = document.querySelector('[aria-label="Search icon library"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'steam'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await waitFor(`!!document.querySelector('.zs-icon-library-grid button svg text')`);
    assert.ok(await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.zs-icon-library-grid button')).every(button => button.textContent.toLowerCase().includes('steam'))`));
    await window.webContents.executeJavaScript(`document.querySelector('.zs-icon-library-grid button svg text').closest('button').click()`);
    await waitFor(`!!document.querySelector('.zs-icon-library-selected svg text')`);
    assert.ok(await window.webContents.executeJavaScript(`document.fonts.load('26px "Rovyl Nerd Symbols"').then(fonts => fonts.length > 0)`));
    await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Add icon to favorites"]').click()`);
    await clickText('Favorites');
    await waitFor(`document.querySelectorAll('.zs-icon-library-grid > button').length === 1`);
    await clickText('Gaming');
    await new Promise(resolve => setTimeout(resolve, 300));
    fs.writeFileSync(path.join(root, 'build-out', 'icon-picker-preview.png'), (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`document.querySelector('.zs-shell').setAttribute('data-zn-theme', 'white')`);
    await new Promise(resolve => setTimeout(resolve, 100));
    fs.writeFileSync(path.join(root, 'build-out', 'icon-picker-white-preview.png'), (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`document.querySelector('.zs-shell').setAttribute('data-zn-theme', 'black')`);
    await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Close icon picker"]').click()`);
    await waitFor(`!document.querySelector('.zs-icon-modal')`);
    assert.ok(await window.webContents.executeJavaScript(`!!document.querySelector('.zs-workspace-icon-button svg text')`));
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.ok(lastSaved.config.workspaces[0].pickerIconName.startsWith('nf-'));
    await clickText('Add apps');
    await waitFor('document.body.innerText.includes("Test Browser")');
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.zs-installed-apps button')).forEach(b => b.click())`);
    await waitFor('document.body.innerText.includes("2 selected")');
    await clickText('Add 2 apps');
    await waitFor('document.querySelectorAll(".zs-preview-orbit > button").length === 3');
    await clickText('Add apps');
    await waitFor('document.querySelectorAll(".zs-installed-apps button:disabled").length === 2');
    await clickText('Cancel');
    await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Edit Test Browser, position 2"]').click()`);
    await waitFor('document.body.innerText.includes("Replace app")');
    await clickText('Replace app');
    await waitFor('document.body.innerText.includes("Choose one application for this position.")');
    await clickText('Cancel');
    await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Move Test Browser up"]').click()`);
    await waitFor('!!document.querySelector(\'[aria-label="Edit Test Browser, position 1"]\')');
    await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Remove Test Browser"]').click()`);
    await waitFor('document.querySelectorAll(".zs-preview-orbit > button").length === 2');
    await waitFor('document.body.innerText.includes("✓ Saved")');
    await clickText('Duplicate workspace');
    await waitFor('document.querySelector(".zs-editor h2")?.textContent === "Main copy"');
    await waitFor('document.querySelectorAll(".zs-preview-orbit > button").length === 2');
    await clickText('Test workspace');
    await waitFor('document.body.innerText.includes("Testing Main copy")');
    await new Promise(resolve => setTimeout(resolve, 700));
    await clickText('Back to editor');
    await waitFor('!document.body.innerText.includes("Testing Main copy")');
    await new Promise(resolve => setTimeout(resolve, 500));
    await waitFor('document.querySelector(".zs-editor h2")?.textContent === "Main copy"');
    await clickText('Duplicate workspace');
    await waitFor('document.querySelector(".zs-editor h2")?.textContent === "Main copy copy"');
    values['save-full-config'] = { ok: false, error: 'Simulated disk failure' };
    await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Remove Test Editor"]').click()`);
    await waitFor('document.body.innerText.includes("Could not save changes")');
    values['save-full-config'] = { ok: true };
    await clickText('Duplicate workspace');
    await waitFor('document.body.innerText.includes("✓ Saved")');
    await new Promise(resolve => setTimeout(resolve, 700));
    fs.writeFileSync(path.join(root, 'build-out', 'workspace-editor-preview.png'), (await window.webContents.capturePage()).toPNG());
    const onlineImages = await window.webContents.executeJavaScript(`Array.from(document.images).filter(i => /^https?:/.test(i.src)).length`);
    assert.equal(onlineImages, 0);
    const networkAllowed = await window.webContents.executeJavaScript(`fetch('http://localhost:5173/offline-probe').then(() => true, () => false)`);
    assert.equal(networkAllowed, false);
    assert.deepEqual(errors, []);
    clearTimeout(timeout);
    console.log('Renderer smoke: settings render, local backup controls remain, updater absent, network blocked.');
    window.destroy();
    app.exit(0);
  }).catch(error => { console.error(error); app.exit(1); });
}
