<div align="center">

# rovyl-custom

**Quick access to your apps, on your own machine.**

A personal Windows radial launcher based on [Rovyl](https://github.com/HenryCauan/rovyl), modified by [Ventexx](https://github.com/Ventexx).

</div>

## Features

- Launch installed apps, folders, files, and custom commands from a radial menu.
- Organize shortcuts into workspaces and choose them with the mouse or number keys.
- Activate with the middle/side mouse button or a global keyboard shortcut.
- Choose click/hold activation and angle/cursor aiming.
- Avoid accidental activation during fullscreen apps and games.
- Read supported IDE recent-project lists locally.
- Back up and restore settings using local files.

## Offline operation

No accounts, license activation, automatic updates, weather service, or remote icon
downloads. Fonts and icons are bundled or obtained locally. The installed app blocks
network requests from its renderer; old remote icon URLs show a local fallback.

Website shortcuts remain optional: selecting one explicitly opens your default
browser. Apps, commands, or network folders you launch can use their own network
connections. The launcher does not restrict those programs.

## Building

Requires Windows 10 or 11 and Node.js **20.19+ or 22.12+** (tested with Node 24).
Downloading dependencies requires internet access.

```bash
git clone https://github.com/Ventexx/rovyl-custom.git
cd rovyl-custom
npm ci
npm start
```

`npm start` runs the project directly from this checkout, starting Vite and Electron.
No Google credentials or other service configuration is needed. Development permits
only the local Vite server and its live-reload connection on port 5173.

Settings live in `%APPDATA%\rovyl-custom`. On the first launch, existing Rovyl settings
and custom icons are copied into this folder if no custom profile exists. The original
profile is left untouched. Development and installed custom builds share this new folder.
For a separate test profile, set `ROVYL_USER_DATA` in your shell to an absolute folder
path before starting the app; this bypasses automatic migration.

| Command | Purpose |
| --- | --- |
| `npm start` | Run Vite and Electron together |
| `npm run dev` | Run the frontend development server |
| `npm run electron` | Run Electron against the development server |
| `npm run build` | Type-check, bundle, verify windowing, and generate the Windows icon |
| `npm test` | Run local regression checks |
| `npm run test:renderer` | Check the built UI in a hidden Electron window after building |
| `npm run dist` | Build a local Windows installer in `build-out/`; publishing is disabled |

Backend changes require restarting the app. Frontend edits reload through Vite.
`npm start` uses your current source without a build. An installed app is a snapshot:
after editing, run `npm run dist` and install the resulting installer to update it.
`npm run build` alone does not update an installed copy.
The installer offers a **Create a desktop shortcut** checkbox, unchecked by default.
Leaving it unchecked does not remove a shortcut you already have.
The installer is `build-out/Rovyl.exe`. Its final page offers to launch
the app when you click **Finish**. Quit the running app from its tray menu before upgrading.
See [Architecture](docs/ARCHITECTURE.md) before changing native input, windowing,
persistence, or icon handling.

## Links

The following link refers to the **original Rovyl project**, maintained by Henry Cauan:

- [Original source](https://github.com/HenryCauan/rovyl)

This custom version does not use the original project's online services or update feed.

## License

Copyright © 2026 Henry Cauan.

This repository is a personal version of Rovyl modified by [Ventexx](https://github.com/Ventexx).
It retains the **GNU General Public License v3.0 or later** declared by the original
project. See [LICENSE](LICENSE).
