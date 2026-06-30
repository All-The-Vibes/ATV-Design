/**
 * In-iframe bridge for live tweaks on STATIC (script-less) artifacts.
 *
 * Scripted JSX artifacts get live tweaks via tweaks-bridge.ts: it swaps the
 * EDITMODE block in the cached script and re-renders through React. But a pure
 * HTML/CSS mockup (the model's legitimate choice for, say, an onboarding
 * visual) has no script and no TWEAK_DEFAULTS — the React bridge has nothing to
 * bind, so those artifacts were entirely un-tweakable.
 *
 * Their tweakable surface is the `:root` custom-property block. This bridge
 * listens for the same `codesign:tweaks:update` postMessage the React bridge
 * uses, and applies each token by setting the CSS variable on
 * `document.documentElement` — the browser repaints in place, no reload, no
 * React, no Babel. The host seeds it with the tokens extracted at build time
 * (via @atv-design/shared `extractRootCssVars`) so a TweakPanel can render
 * controls with correct defaults.
 *
 * Bundled as a string at build time; injected by `buildSrcdoc` only when the
 * static artifact actually declares `:root` vars.
 */

/** Marker the host uses to detect an already-injected static bridge (idempotency). */
export const STATIC_TWEAKS_MARKER = 'CODESIGN_STATIC_TWEAKS';

/**
 * Build the static-tweak bridge script for an iframe. `defaults` is the
 * build-time-extracted `:root` token map; it is embedded so the in-iframe
 * `window.__codesign_static_tweaks__.defaults` is readable by a panel and so
 * the bridge can restore a token to its original value when a tweak is cleared.
 */
export function buildStaticTweaksBridge(defaults: Record<string, string>): string {
  // JSON.stringify yields a safe JS object literal (quotes/backslashes escaped),
  // but it does NOT neutralize a script-closing sequence inside a value. Per the
  // HTML spec a <script> element's text ends at `</script` followed by
  // whitespace, `/`, or `>` (case-insensitive) — so `</script >`, `</script/`,
  // `</script\t…` ALL break out, not just the literal `</script>`. Escape the
  // `<` of ANY `</script` occurrence so the agent's :root values can never close
  // our injected element and smuggle markup into the sandbox.
  const defaultsLiteral = JSON.stringify(defaults).replace(/<(\/script)/gi, '<\\$1');
  return `<script>/* ${STATIC_TWEAKS_MARKER} */(function(){
  'use strict';
  var root = document.documentElement;
  if (!root || !root.style) return;
  var defaults = ${defaultsLiteral};
  window.__codesign_static_tweaks__ = { defaults: defaults };
  function applyTokens(tokens) {
    if (!tokens || typeof tokens !== 'object') return;
    for (var name in tokens) {
      if (!Object.prototype.hasOwnProperty.call(tokens, name)) continue;
      // Only touch CSS custom properties (\`--*\`). Ignore anything else so a
      // malformed payload can't set arbitrary inline styles on the document.
      if (name.indexOf('--') !== 0) continue;
      var value = tokens[name];
      if (value === null || value === undefined || value === '') {
        // Empty → restore the original declared value (or clear if none).
        if (Object.prototype.hasOwnProperty.call(defaults, name)) {
          root.style.setProperty(name, String(defaults[name]));
        } else {
          root.style.removeProperty(name);
        }
        continue;
      }
      root.style.setProperty(name, String(value));
    }
  }
  window.addEventListener('message', function(event) {
    var data = event && event.data;
    if (!data || data.type !== 'codesign:tweaks:update') return;
    applyTokens(data.tokens);
  });
})();</script>`;
}
