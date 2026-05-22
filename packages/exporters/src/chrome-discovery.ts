// Chrome discovery now lives in @atv-design/shared so it can be reused by
// core tools (read_brand, capture_element) without coupling core → exporters.
// Re-exported here so existing imports (./chrome-discovery from pdf.ts and
// its vi.mock target in pdf.test.ts) continue to work unchanged.
export { findSystemChrome } from '@atv-design/shared/node';
export type { ChromeDiscoveryDeps } from '@atv-design/shared/node';
