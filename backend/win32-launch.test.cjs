"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  splitWin32SpawnExeAndArgs,
  canonicalizeWin32LaunchCommand,
  getWin32BatchWorkingDirectory,
  getWin32BatchLaunch,
} = require("./win32-launch.js");

describe("win32-launch", () => {
  it("runs batch launchers in a hidden shell that exits, preserving cwd and quoted arguments", () => {
    if (process.platform !== "win32") return;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rovyl-batch-exit-"));
    const appDir = path.join(dir, "Vael App");
    fs.mkdirSync(appDir);
    const launcher = path.join(appDir, "start_silent.bat");
    fs.writeFileSync(path.join(appDir, "activate.bat"), '@echo off\r\nset VAEL_TEST_VENV=activated\r\n');
    fs.writeFileSync(launcher, '@echo off\r\ncall activate.bat\r\necho %VAEL_TEST_VENV%\r\necho %1\r\n');
    try {
      const launch = getWin32BatchLaunch(`"${launcher}" "Cover & Indexer"`);
      assert.strictEqual(launch.options.windowsHide, true);
      const result = require("child_process").spawnSync(launch.file, launch.args, {
        ...launch.options, stdio: 'pipe', encoding: 'utf8', timeout: 5000,
      });
      assert.ifError(result.error);
      assert.strictEqual(result.status, 0, result.stderr);
      assert.match(result.stdout, /activated/);
      assert.match(result.stdout, /Cover & Indexer/);
      assert.strictEqual(getWin32BatchLaunch('"C:\\Apps\\editor.exe"'), null);
      assert.strictEqual(getWin32BatchLaunch('https://example.com'), null);
    } finally {
      assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  it("uses the batch folder for quoted paths and arguments, without changing executable launches", () => {
    assert.strictEqual(getWin32BatchWorkingDirectory('"C:\\Vael Apps\\indexer\\start.bat" --debug'), 'C:\\Vael Apps\\indexer');
    assert.strictEqual(getWin32BatchWorkingDirectory('C:\\vael\\cover\\START.CMD'), 'C:\\vael\\cover');
    assert.strictEqual(getWin32BatchWorkingDirectory('"C:\\Vael Apps\\editor.exe"'), undefined);
    assert.strictEqual(getWin32BatchWorkingDirectory('start.bat'), undefined);
  });

  it("lets a batch launcher read relative files when started from another folder", () => {
    if (process.platform !== "win32") return;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rovyl-batch-"));
    const appDir = path.join(dir, "Vael App");
    fs.mkdirSync(appDir);
    const launcher = path.join(appDir, "start.bat");
    fs.writeFileSync(path.join(appDir, "requirements.txt"), "relative file found");
    fs.writeFileSync(launcher, '@echo off\r\ntype requirements.txt > result.txt\r\n');
    try {
      require("child_process").execSync(`start "" /b /wait "${launcher}"`, {
        cwd: getWin32BatchWorkingDirectory(`"${launcher}"`),
        windowsHide: true,
        stdio: "pipe",
      });
      assert.strictEqual(fs.readFileSync(path.join(appDir, "result.txt"), "utf8"), "relative file found");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("splits Program Files style path + args using real file on disk", () => {
    if (process.platform !== "win32") return;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zenith-launch-"));
    const exe = path.join(dir, "sub dir", "fakeapp.exe");
    fs.mkdirSync(path.dirname(exe), { recursive: true });
    fs.writeFileSync(exe, "");
    try {
      const line = `${exe} --foo bar`;
      const { exe: e, args } = splitWin32SpawnExeAndArgs(line);
      assert.strictEqual(e, exe);
      assert.deepStrictEqual(args, ["--foo", "bar"]);
      const canon = canonicalizeWin32LaunchCommand(line);
      assert(canon.startsWith('"'), "canonicalized exe should be quoted");
      assert(canon.includes("--foo"));
    } finally {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (_) {}
    }
  });

  it("leaves internal: and https URLs unchanged", () => {
    assert.strictEqual(
      canonicalizeWin32LaunchCommand("internal:notes"),
      "internal:notes",
    );
    assert.strictEqual(
      canonicalizeWin32LaunchCommand("https://example.com/a b"),
      "https://example.com/a b",
    );
  });
});
