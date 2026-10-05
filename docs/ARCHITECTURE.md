# Architecture

`rovyl-custom` is Ventexx's private, local Windows launcher derived from Rovyl.
Its purpose is quick access to installed apps, folders, commands, and workspaces.
There are no accounts, purchase activation, self-updates, weather requests, or remote
icon services. The original GPL license and attribution remain in the repository.

## Layout

```text
backend/
  electron-main.js           Window lifecycle, shortcuts, launch commands, persistence, icons
  electron-preload.js        Explicit renderer-facing IPC API
  offline-policy.cjs         Session request restrictions and permission denial
  mouse-blocker.ps1          Global mouse hook and trigger handling
  foreground-focus.ps1      Windows foreground/focus helper
  get-foreground-exe.ps1     Foreground application detection
  extract-icon.ps1           Local Windows app icon extraction
  simulate-keys.ps1          Keyboard simulation for launch actions
  game-detection.cjs         Local fullscreen/game detection
  win32-launch.js            Windows command parsing and quoting
  persistence-normalize.cjs  Legacy and current backup shape compatibility
  profile-directory.cjs     Separate custom profile and one-time migration
  *.test.cjs                Focused Node tests, excluded from packaged builds
src/
  App.tsx                   State, persistence, IPC wiring, radial/window coordination
  components/
    PrecisionSettings.tsx   Current settings and workspace editor, loaded lazily
    RadialMenu.tsx          Wheel layout, aiming, gestures, folders, recent projects
    RadialHud.tsx           Optional local battery indicator
    installedApps.tsx       Shared installed-app discovery and icon loading
    SmartIcon.tsx           Local images; remote saved URLs get a bundled fallback
  localIcons.ts             Offline icon handling for website shortcuts
  defaults.ts               Defaults and migration of old bundled/widget shortcuts
  index.css                 Design tokens and styles (some base styles remain in index.html)
scripts/                    Local launch, build, icon, verification, and diagnostic tools
nsis/                       Windows installer cleanup
build/                      Installer artwork and generated icon.ico
```

## Offline behavior

`offline-policy.cjs` installs a request filter on Electron's default session before
the main window is created. Packaged builds allow local content, not HTTP requests
or remote websockets. Development additionally permits the local Vite server and
its websocket on port 5173. A Content Security Policy further limits renderer
resources. Permission requests and in-app page navigation/popups are denied.

The main process contains no service clients for updates, authentication, licensing,
weather, or favicon downloads. Fonts and icons are bundled or extracted locally.
Previously saved remote icon URLs display a local fallback instead of being fetched.

Explicitly selecting a website shortcut still asks Windows to open the default
browser. Launching a browser, another app, a network folder, or a user-supplied command
can cause that program to use the network; the launcher is not a firewall for programs
it starts. Installing development dependencies also requires package downloads.

## Radial windowing

The transparent, frameless window is resized before reveal. The paint handshake is:

`prepare-radial-show` -> neutral cover -> `radial-prep-paint-done` -> `open-menu`
-> transparent wheel paint -> `radial-open-paint-done` -> native reveal
-> `radial-native-revealed` -> animation.

This ordering prevents stale frames and black flashes from the Windows compositor.
`scripts/verify-radial-windowing.mjs` checks the key markers during every build.
Keep the handshake when changing window geometry or animations.

## Input and launching

`mouse-blocker.ps1` runs a Windows `WH_MOUSE_LL` hook in a separate process. It captures
the configured middle/side button, suppresses unwanted clicks below the wheel, and
reports trigger events. A short stationary hold can replay a normal click. The old
AutoHotkey helper is no longer used or shipped.

The main process polls cursor position while Windows pointer capture prevents normal
renderer mouse events. Aiming and release confirmation share `resolveAimAtPoint`,
using the live pointer rather than potentially stale React state. Angle and cursor
aiming modes remain supported. Global keyboard shortcuts use Electron and the local
keyboard listener. Fullscreen protection uses foreground process and local game files.

App commands, folders, and user-selected URLs are dispatched through Windows. IDE
recent-project lists are read from local files, including SQLite through `sql.js`.
Prewarming and process reuse remain optional launch modes.

## Icons

`extract-icon.ps1` produces normalized 256px PNG data URLs from local app resources.
Packaged Windows apps prefer the Square44x44Logo family; desktop apps use shell icon
extraction. Candidates are checked for unwanted white halos. Extraction is queued
with limited concurrency and cached on disk.

Bump `ICON_PIPELINE_VERSION` in `electron-main.js` when changing extraction semantics.
Website shortcuts use the bundled Globe icon. Custom local images remain supported.
Missing native icons are repaired asynchronously and merged by item ID so an older
request cannot overwrite newly edited workspace contents.

## Persistence and compatibility

`config-v2.json` is stored in `%APPDATA%\rovyl-custom`, written atomically with a `.bak`
and quarantine handling for damaged files. Development and installed custom builds
share this directory. `profile-directory.cjs` copies the first existing profile from
`Rovyl`, `Zenith OS`, or `zenith-radial-menu` only when the custom profile is absent.
Managed custom icons are copied and their stored paths updated. Existing custom data
is never replaced, and original profiles are never modified. A `.profile-initialized`
marker survives reset, preventing old data from being imported again after a reset.
Reset removes only this profile's settings and backup, not the original app's files.

Set `ROVYL_USER_DATA` (or the legacy `ZENITH_USER_DATA`) in the launching process
environment for a separate test profile; explicit overrides bypass migration.
The override is read before `.env.local`, so it must be set before starting Electron.

`persistence-normalize.cjs` accepts flat legacy data and the nested `{ user, apps,
config }` shape. Legacy `user` metadata is preserved for backup compatibility only;
it does not enable account or license behavior. Stored UI config is merged over
defaults. Migration removes obsolete internal widget shortcuts. Import writes the
backup before relaunch and prevents stale renderer state from overwriting it.

Shutdown asks the renderer to flush its state, then stops native helpers before exit.
Local export/import is retained. No configuration is synchronized to a server.

## Development and packaging

Use `npm ci`, then `npm start`. Startup runs Vite and Electron directly from this
checkout; there is no second copy of the project under LocalAppData. Frontend edits
reload through Vite; backend changes require a restart. `npm run build` type-checks,
bundles the UI, verifies windowing markers, and generates the Windows icon.

`npm run dist` builds the NSIS installer through `run-electron-builder.mjs`. Publishing
is explicitly disabled. Store packaging, release automation, promotional generators,
and auto-update dependencies have been removed. Backend tests are excluded from the
installed app. `after-pack-win-icon.cjs` still embeds the app icon and version metadata.
The output is `build-out`, with `ZENITH_BUILD_OUTPUT` available as an override.

Builds require Node 22.12 or newer. Native preparation runs in `beforePack` through
`before-build-native.cjs`: it verifies active-win's stable Node-API binary and rebuilds
other native modules. The default rebuild is disabled, but normal production dependency
collection remains enabled. Do not move this to a `beforeBuild` hook returning false:
electron-builder 26 also skips dependency collection in that case.

After packaging, `verify-packaged-runtime.cjs` runs with the packaged executable in
Node mode. Missing production packages, keyboard helpers, native bindings or SQLite
fail the build before the installer is created. Resolution outside the packaged app
is rejected, preventing development dependencies from masking missing files.
`npm run test:native` additionally checks Windows APIs in a hidden test window.

The assisted installer includes an unchecked desktop-shortcut option in `nsis/installer.nsh`;
automatic desktop shortcut creation is disabled. Its custom uninstall hook cleans up
opted-in shortcuts, while upgrades preserve existing shortcuts.
The installer artifact remains `Rovyl.exe`. Its `preInit` hook runs a temporary copy
named `rovyl-setup.exe` and exits the original launcher. The child waits for its parent
to exit before proceeding, so older uninstallers that kill every `Rovyl.exe` cannot
kill the setup process. This also avoids confusing the standard running-app check.
There is no custom process-kill command now: electron-builder handles running-app
checks, and the app stops its helpers on normal exit. Keep the standard Finish page
with `runAfterFinish: true` so users can choose whether to launch the app.

`npm test` runs command parsing, game detection, offline request policy, profile migration, persistence,
and windowing checks. After building, `npm run test:renderer` checks the settings UI
and request blocking in a hidden Electron window with simulated IPC and an isolated
profile under `build-out`. Native mouse/focus behavior still needs testing on Windows;
these automated checks do not substitute for exercising the installed launcher.

## Maintenance

Keep compatibility keys and low-level window workarounds unless their replacement is
verified. Much of the original explanatory commentary is in Portuguese. The settings
screen currently uses English while parts of the radial still use the translation
table, trimmed to the labels still in use. Removing unused styles or splitting the large main process can
be separate changes with focused visual and behavior checks.
