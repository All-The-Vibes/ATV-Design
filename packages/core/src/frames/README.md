# Device frame starter templates

Vanilla HTML+CSS skeletons that the agent can pull from its virtual
filesystem when a design needs accurate device chrome. Each file is
fully self-contained (no JS, no external CSS, no React) so it works
inside the iframe `srcdoc` sandbox renderer.

## Available frames

- `iphone.html` — iPhone 16 Pro (402x874, dynamic island, home indicator)
- `ipad.html` — iPad (820x1180, slim status bar, no island)
- `watch.html` — Apple Watch Ultra (200x244, digital crown + side button)

## How the agent uses them

The host (`apps/desktop/src/main/index.ts`) seeds the agent's virtual
filesystem with `frames/iphone.html`, `frames/ipad.html`, etc. The
system prompt mentions only that these frames exist; the model decides
whether the design benefits from device chrome and `view`s the
relevant frame on its own. There is no keyword detection in either the
main process or the prompt.

If the model picks a frame, it copies the skeleton into `index.html`
and inserts its app HTML inside the `<div id="screen">` container.

## Adding a new frame

1. Drop `<name>.html` in this directory.
2. Append the filename to the `FRAME_FILES` tuple in `index.ts`.
3. The frame becomes available at `frames/<name>` in the agent's fs.

Conventions:

- Self-contained (`<style>` inline, no external resources).
- Empty `<div id="screen">` placeholder where the user's app HTML goes.
- Expose tunable colors via `:root` CSS variables (`--screen-bg`,
  `--text`, etc.) so the agent can theme without touching the chrome.
- Comment the frame with what overrides are safe.
