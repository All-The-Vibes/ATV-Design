// smoke-register.mjs — bootstrap for `pnpm smoke` run as native ESM.
//
// Registers raw-loader.mjs as a real module-customization hook so the
// `*.?raw` template imports inside @atv-design/core resolve to strings.
//
// tsx's own ESM loader is chained separately on the command line via
// `--import tsx` (tsx refuses to be registered through module.register and
// must own its initialization). Load order on the command line is:
//   node --import tsx --import ./scripts/smoke-register.mjs scripts/smoke-models.mts
// tsx initializes first (TypeScript sources resolve), then this hook layers
// `?raw` support on top.
//
// Why an ESM entry at all: pi-ai (and its transitive deps) ship `exports`
// maps with only an `import` condition — no `require`. When the smoke script
// was a plain `.ts` run through tsx, the root package (no "type":"module")
// made tsx resolve it through Node's CJS loader, which consults the `require`
// condition, finds none, and throws ERR_PACKAGE_PATH_NOT_EXPORTED before the
// harness ever runs. Running the entry as `.mts` (forced ESM) keeps resolution
// on the `import` condition end-to-end.

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Vite `?raw` parity for out-of-bundler tooling. Registered after tsx (which
// the command line imports first) so TypeScript + `?raw` both resolve.
register('./raw-loader.mjs', pathToFileURL(`${import.meta.dirname}/`));
