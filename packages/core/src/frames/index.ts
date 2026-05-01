/**
 * Device frame starter templates — JSX modules built against the runtime's
 * pre-loaded React + IOSDevice / DesignCanvas globals. The agent can `view`
 * one of these from the virtual filesystem and adapt it as the basis for a
 * mobile / tablet / watch design.
 *
 * Each .jsx file is a complete `<script type="text/babel">` payload (the
 * runtime wraps it in the React + Babel template). Keep the `TWEAK_DEFAULTS`
 * EDITMODE block at the top so the host can render a tweak panel.
 */

import androidJsx from './android.jsx?raw';
import ipadJsx from './ipad.jsx?raw';
import iphoneJsx from './iphone.jsx?raw';
import macosSafariJsx from './macos-safari.jsx?raw';
import watchJsx from './watch.jsx?raw';

const FRAME_FILES = [
  'iphone.jsx',
  'ipad.jsx',
  'watch.jsx',
  'android.jsx',
  'macos-safari.jsx',
] as const;

export type FrameName = (typeof FRAME_FILES)[number];

export const FRAME_TEMPLATES: ReadonlyArray<readonly [string, string]> = Object.freeze([
  ['iphone.jsx', iphoneJsx],
  ['ipad.jsx', ipadJsx],
  ['watch.jsx', watchJsx],
  ['android.jsx', androidJsx],
  ['macos-safari.jsx', macosSafariJsx],
] as const);
