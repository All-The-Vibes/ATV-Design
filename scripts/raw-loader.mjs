// raw-loader.mjs — committed Node ESM module-customization hook that replicates
// Vite's `?raw` import suffix for out-of-bundler tooling (the `pnpm smoke`
// harness). `@atv-design/core` imports design-skill / device-frame templates as
// `import x from './f.jsx?raw'`, where Vite/electron-vite inlines the file's
// text as the default export. Node's native ESM loader (and tsx) don't
// understand the `?raw` query, so any tsx/node entry into `core` that touches a
// template module throws `does not provide an export named 'default'`.
//
// This hook resolves `*.{jsx,js,html,md,svg,css}?raw` specifiers to the file's
// raw text as an ES module default export, and delegates everything else.
//
// Registered (not auto-hooked) via scripts/smoke-register.mjs using
// module.register — Node only treats a file as a customization hook when it is
// registered through that API, not merely `--import`ed.
//
// The resolve/load functions and the three pure helpers below are unit-tested
// in scripts/raw-loader.test.mjs.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const RAW_SUFFIX = '?raw';

/**
 * True when a specifier (or resolved URL) carries the bare `?raw` suffix.
 * Matches only an exact trailing `?raw` — `./x.jsx?raw=1` or `./x.jsx?foo` do
 * not qualify, mirroring Vite's exact-suffix contract.
 * @param {string} specifier
 * @returns {boolean}
 */
export function isRawSpecifier(specifier) {
  return typeof specifier === 'string' && specifier.endsWith(RAW_SUFFIX);
}

/**
 * Remove exactly one trailing `?raw` suffix. Caller guarantees presence via
 * isRawSpecifier.
 * @param {string} specifier
 * @returns {string}
 */
export function stripRawQuery(specifier) {
  return specifier.slice(0, -RAW_SUFFIX.length);
}

/**
 * Build the source text of a synthetic ES module whose default export is the
 * verbatim file contents. JSON.stringify yields a valid, fully-escaped JS
 * string literal (quotes, backslashes, newlines, unicode) — no template
 * literals, so `${...}` / backticks in the content stay inert.
 * @param {string} contents
 * @returns {string}
 */
export function rawModuleSource(contents) {
  return `export default ${JSON.stringify(contents)};`;
}

/** @type {import('node:module').ResolveHook} */
export async function resolve(specifier, context, nextResolve) {
  if (isRawSpecifier(specifier)) {
    const resolved = await nextResolve(stripRawQuery(specifier), context);
    return { url: `${resolved.url}${RAW_SUFFIX}`, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

/** @type {import('node:module').LoadHook} */
export async function load(url, context, nextLoad) {
  if (isRawSpecifier(url)) {
    const contents = await readFile(fileURLToPath(stripRawQuery(url)), 'utf8');
    return {
      format: 'module',
      source: rawModuleSource(contents),
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
