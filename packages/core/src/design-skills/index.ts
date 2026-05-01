/**
 * Design-skill starter snippets — JSX modules that the agent can `view` from
 * the virtual filesystem and adapt to the user's brief.
 *
 * Each .jsx file is a complete `<script type="text/babel">` payload with a
 * `// when_to_use:` hint comment at the top so the agent can decide which
 * skill (if any) applies before opening the file.
 */

import calendarJsx from './calendar.jsx?raw';
import chartSvgJsx from './chart-svg.jsx?raw';
import chatUiJsx from './chat-ui.jsx?raw';
import dashboardJsx from './dashboard.jsx?raw';
import dataTableJsx from './data-table.jsx?raw';
import editorialTypographyJsx from './editorial-typography.jsx?raw';
import footersJsx from './footers.jsx?raw';
import glassmorphismJsx from './glassmorphism.jsx?raw';
import heroesJsx from './heroes.jsx?raw';
import landingPageJsx from './landing-page.jsx?raw';
import pricingJsx from './pricing.jsx?raw';
import slideDeckJsx from './slide-deck.jsx?raw';

const DESIGN_SKILL_FILES = [
  'slide-deck.jsx',
  'dashboard.jsx',
  'landing-page.jsx',
  'chart-svg.jsx',
  'glassmorphism.jsx',
  'editorial-typography.jsx',
  'heroes.jsx',
  'pricing.jsx',
  'footers.jsx',
  'chat-ui.jsx',
  'data-table.jsx',
  'calendar.jsx',
] as const;

export type DesignSkillName = (typeof DESIGN_SKILL_FILES)[number];

export const DESIGN_SKILLS: ReadonlyArray<readonly [string, string]> = Object.freeze([
  ['slide-deck.jsx', slideDeckJsx],
  ['dashboard.jsx', dashboardJsx],
  ['landing-page.jsx', landingPageJsx],
  ['chart-svg.jsx', chartSvgJsx],
  ['glassmorphism.jsx', glassmorphismJsx],
  ['editorial-typography.jsx', editorialTypographyJsx],
  ['heroes.jsx', heroesJsx],
  ['pricing.jsx', pricingJsx],
  ['footers.jsx', footersJsx],
  ['chat-ui.jsx', chatUiJsx],
  ['data-table.jsx', dataTableJsx],
  ['calendar.jsx', calendarJsx],
] as const);
