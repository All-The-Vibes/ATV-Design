#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const desktopDir = path.resolve(__dirname, '..');
const workspaceDir = path.resolve(desktopDir, '..', '..');
const releaseDir = path.join(desktopDir, 'release');
const builderConfigPath = path.join(desktopDir, 'electron-builder.yml');
const skillBundleDir = path.join(workspaceDir, 'skills', 'ui-ux-pro-max');
const electronVersion = '39.8.9';

function log(message) {
  process.stdout.write(`[desktop-build] ${message}\n`);
}

function toPortablePath(targetPath) {
  return path.resolve(targetPath).replace(/\\/g, '/');
}

function assertWithin(rootDir, candidateDir) {
  const relative = path.relative(path.resolve(rootDir), path.resolve(candidateDir));
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to operate outside ${rootDir}: ${candidateDir}`);
  }
}

function runPnpm(args, cwd) {
  let command = 'pnpm';
  let commandArgs = args;

  if (process.platform === 'win32') {
    const pnpmEntrypoint = process.env.APPDATA
      ? path.join(process.env.APPDATA, 'npm', 'node_modules', 'pnpm', 'bin', 'pnpm.cjs')
      : null;

    if (pnpmEntrypoint && fs.existsSync(pnpmEntrypoint)) {
      command = process.execPath;
      commandArgs = [pnpmEntrypoint, ...args];
    } else {
      command = 'cmd.exe';
      commandArgs = ['/d', '/s', '/c', 'pnpm', ...args];
    }
  }

  execFileSync(command, commandArgs, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
}

function writeStagedBuilderConfig(stageDir) {
  const originalConfig = fs.readFileSync(builderConfigPath, 'utf8');
  const releaseOutput = toPortablePath(releaseDir);
  const skillBundle = toPortablePath(skillBundleDir);

  const stagedConfig = originalConfig.replace(/^(\s*output:\s*)release$/m, `$1"${releaseOutput}"`);
  if (stagedConfig === originalConfig) {
    throw new Error('Could not rewrite directories.output in electron-builder.yml');
  }

  const withSkillBundle = stagedConfig.replace(
    /^(\s*from:\s*)\.\.\/\.\.\/skills\/ui-ux-pro-max$/m,
    `$1"${skillBundle}"`,
  );
  if (withSkillBundle === stagedConfig) {
    throw new Error('Could not rewrite extraResources.from in electron-builder.yml');
  }

  const stagedConfigPath = path.join(stageDir, 'electron-builder.staged.yml');
  fs.writeFileSync(stagedConfigPath, withSkillBundle);
  return stagedConfigPath;
}

function main() {
  const builderArgs = process.argv.slice(2);
  const keepStage = process.env.ATV_DESKTOP_KEEP_STAGE === '1';
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atv-desktop-stage-'));
  let succeeded = false;

  assertWithin(desktopDir, releaseDir);
  if (!fs.existsSync(skillBundleDir)) {
    throw new Error(`Skill bundle is missing: ${skillBundleDir}`);
  }

  try {
    log('Building desktop app with electron-vite');
    runPnpm(['exec', 'electron-vite', 'build'], desktopDir);

    log(`Deploying prod package to staged project at ${stageDir}`);
    runPnpm(['--filter', '@atv-design/desktop', '--prod', 'deploy', stageDir], workspaceDir);

    log(`Preparing clean release output at ${releaseDir}`);
    fs.rmSync(releaseDir, { force: true, recursive: true });
    fs.mkdirSync(releaseDir, { recursive: true });

    const stagedConfigPath = writeStagedBuilderConfig(stageDir);
    log('Running electron-builder against staged project');
    runPnpm(
      [
        'exec',
        'electron-builder',
        '--projectDir',
        stageDir,
        '--config',
        stagedConfigPath,
        `--config.electronVersion=${electronVersion}`,
        ...builderArgs,
      ],
      desktopDir,
    );

    succeeded = true;
    log(`Build artifacts available in ${releaseDir}`);
  } finally {
    if (succeeded && !keepStage) {
      fs.rmSync(stageDir, { force: true, recursive: true });
    } else {
      log(`Staged project preserved at ${stageDir}`);
    }
  }
}

main();
