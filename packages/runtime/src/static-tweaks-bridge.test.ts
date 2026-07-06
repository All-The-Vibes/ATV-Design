import { describe, expect, it } from 'vitest';
import { STATIC_TWEAKS_MARKER, buildStaticTweaksBridge } from './static-tweaks-bridge';

describe('buildStaticTweaksBridge', () => {
  it('emits a self-invoking script tagged with the static marker', () => {
    const out = buildStaticTweaksBridge({ '--a': '1' });
    expect(out).toContain(STATIC_TWEAKS_MARKER);
    expect(out.startsWith('<script>')).toBe(true);
    expect(out.trimEnd().endsWith('</script>')).toBe(true);
  });

  it('embeds the defaults map so a panel can read original values', () => {
    const out = buildStaticTweaksBridge({ '--color-accent': '#CC785C', '--radius': '8px' });
    expect(out).toContain('--color-accent');
    expect(out).toContain('#CC785C');
    expect(out).toContain('--radius');
  });

  it('listens for the shared codesign:tweaks:update protocol', () => {
    const out = buildStaticTweaksBridge({ '--a': '1' });
    expect(out).toContain("data.type !== 'codesign:tweaks:update'");
    expect(out).toContain('addEventListener');
  });

  it('only applies --custom-property keys (ignores arbitrary style names)', () => {
    const out = buildStaticTweaksBridge({});
    // The guard string is present so a hostile payload can't set inline styles.
    expect(out).toContain("name.indexOf('--') !== 0");
  });

  it('neutralizes a </script> breakout in default values', () => {
    const out = buildStaticTweaksBridge({
      '--x': `a"b</script><script>alert(1)</script>`,
    });
    // The ONLY unescaped closing tag must be our own single trailing </script>.
    // A browser ends a <script> element on `</script>` and nowhere else, so a
    // raw `</script>` inside the embedded value would let agent CSS smuggle
    // markup into the sandbox. After escaping, exactly one real closing tag
    // remains (ours); the smuggled ones are inert `<\/script>` text.
    expect(out.match(/<\/script>/g)?.length).toBe(1);
    expect(out).toContain('<\\/script>'); // the smuggled tags were escaped
    expect(out.trimEnd().endsWith('</script>')).toBe(true);
  });

  it('neutralizes spec-legal script-end variants (space / slash / tab / mixed case)', () => {
    // Per the HTML spec a <script> element's raw text ends at `</script`
    // followed by whitespace, `/`, or `>` — NOT only the literal `</script>`.
    // Every one of these would otherwise break out of our injected element.
    const vectors = [
      '</script ',
      '</script\t',
      '</script\n',
      '</script/',
      '</SCRIPT>',
      '</ScRiPt >',
      '</script\f',
      '</script\r',
    ];
    for (const v of vectors) {
      const out = buildStaticTweaksBridge({ '--x': `val${v}<img onerror=alert(1)>` });
      // Strip our own trailing closer; nothing that can end a <script> may remain.
      const body = out.replace(/<\/script>$/, '');
      expect(body).not.toMatch(/<\/script[\s/>]/i);
    }
  });
});
