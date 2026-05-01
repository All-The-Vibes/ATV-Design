import { describe, expect, it } from 'vitest';
import { DESIGN_SKILLS } from './index.js';

describe('DESIGN_SKILLS', () => {
  it('loads the starter skill files', () => {
    const names = DESIGN_SKILLS.map(([n]) => n).sort();
    expect(names).toEqual([
      'calendar.jsx',
      'chart-svg.jsx',
      'chat-ui.jsx',
      'dashboard.jsx',
      'data-table.jsx',
      'editorial-typography.jsx',
      'footers.jsx',
      'glassmorphism.jsx',
      'heroes.jsx',
      'landing-page.jsx',
      'pricing.jsx',
      'slide-deck.jsx',
    ]);
  });

  it('every skill declares a when_to_use hint', () => {
    for (const [name, content] of DESIGN_SKILLS) {
      expect(content, `${name} must declare when_to_use`).toMatch(/when_to_use:/);
    }
  });

  it('every skill carries an EDITMODE block', () => {
    for (const [name, content] of DESIGN_SKILLS) {
      expect(content, `${name} must have EDITMODE markers`).toMatch(/EDITMODE-BEGIN/);
      expect(content, `${name} must have EDITMODE markers`).toMatch(/EDITMODE-END/);
    }
  });

  it('every skill renders a React root', () => {
    for (const [name, content] of DESIGN_SKILLS) {
      expect(content, `${name} must call ReactDOM.createRoot`).toMatch(/ReactDOM\.createRoot/);
    }
  });

  it('skill bodies are non-trivial (≥ 200 chars)', () => {
    for (const [name, content] of DESIGN_SKILLS) {
      expect(content.length, `${name} body is empty`).toBeGreaterThan(200);
    }
  });
});
