import { parseTweakSchema } from '@open-codesign/shared';
import { describe, expect, it } from 'vitest';
import { makeDeclareTweakSchemaTool } from './declare-tweak-schema.js';
import type { TextEditorFsCallbacks } from './text-editor.js';

function makeFs(initial: Record<string, string> = {}): TextEditorFsCallbacks {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    view(path) {
      const c = map.get(path);
      return c === undefined ? null : { content: c, numLines: c.split('\n').length };
    },
    create(path, content) {
      map.set(path, content);
      return { path };
    },
    strReplace(path, oldStr, newStr) {
      const cur = map.get(path);
      if (cur === undefined) throw new Error('not found');
      if (!cur.includes(oldStr)) throw new Error('no match');
      map.set(path, cur.replace(oldStr, newStr));
      return { path };
    },
    insert(path) {
      return { path };
    },
    listDir() {
      return [];
    },
  };
}

const seed = (extra = '') =>
  `const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{"accent":"#CC785C","radius":8}/*EDITMODE-END*/;\n${extra}function App(){return null}`;

describe('declare_tweak_schema tool', () => {
  it('injects a TWEAK_SCHEMA block after TWEAK_DEFAULTS', async () => {
    const fs = makeFs({ 'index.html': seed() });
    const tool = makeDeclareTweakSchemaTool(fs);
    const res = await tool.execute('id1', {
      schema: {
        accent: { kind: 'color' },
        radius: { kind: 'number', min: 0, max: 32, step: 2, unit: 'px' },
      },
    });
    expect(res.details.status).toBe('ok');
    expect(res.details.errors).toEqual([]);
    const after = fs.view('index.html');
    if (!after) throw new Error('expected index.html to exist');
    expect(parseTweakSchema(after.content)).toEqual({
      accent: { kind: 'color' },
      radius: { kind: 'number', min: 0, max: 32, step: 2, unit: 'px' },
    });
  });

  it('replaces an existing schema block instead of duplicating it', async () => {
    const initial =
      `const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{"accent":"#CC785C"}/*EDITMODE-END*/;\n` +
      `const TWEAK_SCHEMA = /*TWEAK-SCHEMA-BEGIN*/{"accent":{"kind":"color"}}/*TWEAK-SCHEMA-END*/;\n`;
    const fs = makeFs({ 'index.html': initial });
    const tool = makeDeclareTweakSchemaTool(fs);
    const res = await tool.execute('id2', {
      schema: { accent: { kind: 'string', placeholder: 'hex' } },
    });
    expect(res.details.status).toBe('ok');
    const view = fs.view('index.html');
    if (!view) throw new Error('expected index.html to exist');
    const content = view.content;
    expect(content.match(/TWEAK-SCHEMA-BEGIN/g)?.length).toBe(1);
    expect(parseTweakSchema(content)).toEqual({
      accent: { kind: 'string', placeholder: 'hex' },
    });
  });

  it('returns error and reports invalid entries', async () => {
    const fs = makeFs({ 'index.html': seed() });
    const tool = makeDeclareTweakSchemaTool(fs);
    const res = await tool.execute('id3', {
      schema: {
        good: { kind: 'color' },
        // enum without options is invalid
        bad: { kind: 'enum' } as never,
      },
    });
    expect(res.details.status).toBe('error');
    expect(res.details.errors.some((e) => e.message.includes('"bad"'))).toBe(true);
    // The good entry still landed in the file.
    const view = fs.view('index.html');
    if (!view) throw new Error('expected index.html to exist');
    expect(parseTweakSchema(view.content)).toEqual({
      good: { kind: 'color' },
    });
  });

  it('returns error when target file does not exist', async () => {
    const fs = makeFs();
    const tool = makeDeclareTweakSchemaTool(fs);
    const res = await tool.execute('id4', { schema: { a: { kind: 'color' } } });
    expect(res.details.status).toBe('error');
    expect(res.details.errors[0]?.message).toMatch(/File not found/);
  });

  it('returns error when artifact has no TWEAK_DEFAULTS anchor', async () => {
    const fs = makeFs({ 'index.html': '<html></html>' });
    const tool = makeDeclareTweakSchemaTool(fs);
    const res = await tool.execute('id5', { schema: { a: { kind: 'color' } } });
    expect(res.details.status).toBe('error');
    expect(res.details.errors[0]?.message).toMatch(/No anchor/);
  });
});
