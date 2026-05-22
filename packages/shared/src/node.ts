/**
 * Node-only entry point for `@atv-design/shared`.
 *
 * Anything that depends on Node built-ins (`node:fs`, `node:child_process`,
 * `node:os`, etc.) lives here so it never gets pulled into the renderer
 * bundle via the public `.` entry. Renderer code must NOT import from
 * `@atv-design/shared/node`.
 */

export { findSystemChrome } from './chrome-discovery';
export type { ChromeDiscoveryDeps } from './chrome-discovery';
