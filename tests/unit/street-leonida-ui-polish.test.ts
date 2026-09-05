import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ExplorerView from '../../src/features/explorer/ExplorerView';

const stylesheet = new URL('../../src/features/explorer/explorer.css', import.meta.url);

// The old "premium glass" cascade snapshot was aesthetic implementation detail and is retired.
// Keep the practical access, viewport and attribution invariants in the standalone shell.
describe('Leonida explorer accessibility and viewport', () => {
  it('accounts for mobile safe areas around movement controls and attribution', async () => {
    const css = await readFile(stylesheet, 'utf8');
    expect(css).toContain('(pointer: coarse)');
    expect(css).toContain('env(safe-area-inset-bottom');
    expect(css).toMatch(/\.explorer-touch\s*\{[^}]*env\(safe-area-inset-bottom/s);
    expect(css).toMatch(/\.explorer-footer\s*\{[^}]*env\(safe-area-inset-bottom/s);
  });

  it('keeps directional, map and evidence targets at least 44px without smaller mobile overrides', async () => {
    const css = await readFile(stylesheet, 'utf8');
    const buttonRule = /\.explorer-view button\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(buttonRule).toMatch(/min-height:\s*44px;/);
    expect(buttonRule).toMatch(/min-width:\s*44px;/);
    const overrideRules = [
      ...css.matchAll(/\.explorer-(?:toolbar|map-tools) button\s*\{([^}]*)\}/g),
    ];
    for (const [, rule] of overrideRules) {
      const explicitMinimum = /min-height:\s*(\d+)px/.exec(rule!);
      if (explicitMinimum) expect(Number(explicitMinimum[1])).toBeGreaterThanOrEqual(44);
    }
    expect(css).toMatch(/\.explorer-view\s+:is\([^}]*:focus-visible\s*\{[^}]*outline:/s);
  });

  it('keeps the fullscreen travel map contained and its destinations independently scrollable', async () => {
    const css = await readFile(stylesheet, 'utf8');
    expect(css).toMatch(/\.explorer-world\s*\{[^}]*height:\s*100dvh;/s);
    expect(css).toMatch(/\.explorer-map-body\s*\{[^}]*min-height:\s*0;/s);
    expect(css).toMatch(/\.explorer-destinations\s*\{[^}]*overflow-y:\s*auto;/s);
    expect(css).toMatch(/\.explorer-map-viewport\s*\{[^}]*overflow:\s*hidden;/s);
  });

  it('discloses generated visual studies as reconstruction assets in the rendered evidence panel', () => {
    const markup = renderToStaticMarkup(createElement(ExplorerView, { onClose: () => undefined }));
    expect(markup).toMatch(/generated material or vegetation studies are reconstruction assets/i);
    expect(markup).toContain('not extracted GTA VI game assets');
    expect(markup).toContain('aria-labelledby="explorer-evidence-title"');
  });
});
