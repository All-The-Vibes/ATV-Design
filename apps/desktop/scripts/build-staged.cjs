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
const builtinSkillsDir = path.join(workspaceDir, 'packages', 'core', 'src', 'skills', 'builtin');
const electronVersion = '39.8.9';
const APPLE_API_NOTARIZATION_ENV = ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'];
const APPLE_ID_NOTARIZATION_ENV = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'];

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
    env: resolveBuilderEnv(),
  });
}

function hasEnvValue(env, name) {
  return typeof env[name] === 'string' && env[name].length > 0;
}

function hasAnyEnv(env, names) {
  return names.some((name) => hasEnvValue(env, name));
}

function validateEnvGroup(env, names, label) {
  const present = names.filter((name) => hasEnvValue(env, name));
  if (present.length > 0 && present.length < names.length) {
    throw new Error(`${label} requires ${names.join(', ')} when any of them are set`);
  }
}

function validateSigningEnvironment(env = process.env) {
  validateEnvGroup(env, APPLE_API_NOTARIZATION_ENV, 'Apple API-key notarization');
  validateEnvGroup(env, APPLE_ID_NOTARIZATION_ENV, 'Apple ID notarization');
}

function hasCodeSigningConfiguration(env = process.env) {
  return hasAnyEnv(env, ['CSC_LINK', 'CSC_NAME']);
}

function resolveBuilderEnv(env = process.env, platform = process.platform) {
  validateSigningEnvironment(env);
  const nextEnv = { ...env };
  if (
    platform === 'darwin' &&
    !hasCodeSigningConfiguration(env) &&
    !hasEnvValue(env, 'CSC_IDENTITY_AUTO_DISCOVERY')
  ) {
    nextEnv.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
  }
  return nextEnv;
}

function resolveBuilderArgs(builderArgs, env = process.env, platform = process.platform) {
  const nextArgs = [...builderArgs];
  if (
    env.ATV_REQUIRE_CODE_SIGNING === '1' &&
    !nextArgs.some((arg) => arg.startsWith('--config.forceCodeSigning='))
  ) {
    nextArgs.push('--config.forceCodeSigning=true');
  }
  if (
    platform === 'win32' &&
    !hasCodeSigningConfiguration(env) &&
    !nextArgs.some((arg) => arg.startsWith('--config.win.signAndEditExecutable='))
  ) {
    nextArgs.push('--config.win.signAndEditExecutable=false');
  }
  return nextArgs;
}

function rewriteBuilderConfigText(originalConfig, { releaseOutput, skillBundle, builtinSkills }) {
  const stagedConfig = originalConfig.replace(/^(\s*output:\s*)release$/m, `$1"${releaseOutput}"`);
  if (stagedConfig === originalConfig) {
    throw new Error('Could not rewrite directories.output in electron-builder.yml');
  }

  const extraResourcePattern = /^(\s*(?:-\s*)?from:\s*)\.\.\/\.\.\/skills\/ui-ux-pro-max$/m;
  const withSkillBundle = stagedConfig.replace(extraResourcePattern, `$1"${skillBundle}"`);
  if (withSkillBundle === stagedConfig) {
    throw new Error('Could not rewrite extraResources.from in electron-builder.yml');
  }

  const builtinSkillsPattern =
    /^(\s*(?:-\s*)?from:\s*)\.\.\/\.\.\/packages\/core\/src\/skills\/builtin$/m;
  const withBuiltinSkills = withSkillBundle.replace(builtinSkillsPattern, `$1"${builtinSkills}"`);
  if (withBuiltinSkills === withSkillBundle) {
    throw new Error('Could not rewrite builtin skills extraResources.from in electron-builder.yml');
  }
  return withBuiltinSkills;
}

function writeStagedBuilderConfig(stageDir) {
  const originalConfig = fs.readFileSync(builderConfigPath, 'utf8');
  const releaseOutput = toPortablePath(releaseDir);
  const skillBundle = toPortablePath(skillBundleDir);
  const builtinSkills = toPortablePath(builtinSkillsDir);
  const rewritten = rewriteBuilderConfigText(originalConfig, {
    releaseOutput,
    skillBundle,
    builtinSkills,
  });

  const stagedConfigPath = path.join(stageDir, 'electron-builder.staged.yml');
  fs.writeFileSync(stagedConfigPath, rewritten);
  return stagedConfigPath;
}

function main() {
  const builderArgs = resolveBuilderArgs(process.argv.slice(2));
  const keepStage = process.env.ATV_DESKTOP_KEEP_STAGE === '1';
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atv-desktop-stage-'));
  let succeeded = false;

  assertWithin(desktopDir, releaseDir);
  if (!fs.existsSync(skillBundleDir)) {
    throw new Error(`Skill bundle is missing: ${skillBundleDir}`);
  }
  if (!fs.existsSync(builtinSkillsDir)) {
    throw new Error(`Builtin skills directory is missing: ${builtinSkillsDir}`);
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

if (require.main === module) {
  main();
}

module.exports = {
  APPLE_API_NOTARIZATION_ENV,
  APPLE_ID_NOTARIZATION_ENV,
  hasCodeSigningConfiguration,
  resolveBuilderArgs,
  resolveBuilderEnv,
  rewriteBuilderConfigText,
  validateSigningEnvironment,
};
