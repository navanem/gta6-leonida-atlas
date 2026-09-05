import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('Street Leonida premium viewport polish', () => {
  it('finishes with a full-bleed, glass-layered explorer override', async () => {
    const css = await readFile(`${root}/src/styles/street-leonida.css`, 'utf8');
    const finalMarker = '/* Street Leonida final viewport polish */';
    const finalMarkerIndex = css.lastIndexOf(finalMarker);
    const levelUp = css.slice(finalMarkerIndex);

    expect(finalMarkerIndex).toBeGreaterThan(-1);
    expect(levelUp).toContain('--street-glass:');
    expect(levelUp).toMatch(/\.street-shell\s*\{[^}]*margin:\s*0;/s);
    expect(levelUp).toMatch(/\.street-shell\s*\{[^}]*max-width:\s*none;/s);
    expect(levelUp).toMatch(/\.street-shell\s*\{[^}]*width:\s*100%;/s);
    expect(levelUp).toMatch(/backdrop-filter:\s*blur\(/);
    expect(levelUp).toMatch(/\.street-walk__credit\s*\{[^}]*flex-direction:\s*row;/s);
    expect(levelUp).toContain("data-walk-expanded='true'");
  });

  it('keeps compact mobile controls clear of safe-area insets', async () => {
    const css = await readFile(`${root}/src/styles/street-leonida.css`, 'utf8');
    const levelUp = css.slice(css.indexOf('/* Street Leonida level-up visual system */'));

    expect(levelUp).toContain('@media (max-width: 767px), (pointer: coarse)');
    expect(levelUp).toContain('env(safe-area-inset-bottom)');
    expect(levelUp).toMatch(/\.street-walk__joystick[\s\S]*?width:\s*4\.85rem;/);
    expect(levelUp).toMatch(/\.street-walk__look-pad[\s\S]*?width:\s*4\.85rem;/);
  });

  it('keeps critical map copy readable and directional controls and Evidence close at least 44px', async () => {
    const css = await readFile(`${root}/src/styles/street-leonida.css`, 'utf8');
    const accessibility = css.slice(css.indexOf('/* Street Leonida accessibility finish */'));

    expect(accessibility).toMatch(/\.street-walk-map__live span[\s\S]*?font-size:\s*0\.68rem;/);
    expect(accessibility).toMatch(/\.street-walk-map__live strong[\s\S]*?font-size:\s*0\.68rem;/);
    expect(accessibility).toMatch(/\.street-walk-map__live > small[\s\S]*?font-size:\s*0\.68rem;/);
    expect(accessibility).toMatch(/\.street-walk-map__legend span[\s\S]*?font-size:\s*0\.68rem;/);
    expect(accessibility).toMatch(
      /\.street-walk-map__caveat[\s\S]*?font-size:\s*0\.68rem !important;/,
    );
    expect(accessibility).toMatch(/\.street-walk__pad-button[\s\S]*?height:\s*2\.75rem;/);
    expect(accessibility).toMatch(/\.street-walk__pad-button[\s\S]*?width:\s*2\.75rem;/);
    expect(accessibility).toMatch(
      /\.street-walk-evidence header button[\s\S]*?min-height:\s*2\.75rem;/,
    );
    expect(accessibility).toMatch(
      /\.street-walk-evidence header button[\s\S]*?min-width:\s*2\.75rem;/,
    );
    expect(accessibility).toMatch(/\.street-walk-map__result-status[\s\S]*?max-width:\s*8\.5rem;/);
    expect(accessibility).toMatch(/\.street-walk-map__result\s*\{[^}]*min-height:\s*4rem;/);
    expect(accessibility).toMatch(
      /\.street-walk__credit span,[\s\S]*?\.street-walk__credit a[\s\S]*?font-size:\s*0\.68rem;/,
    );
    expect(accessibility).toMatch(/\.street-walk__minimap::after[\s\S]*?font-size:\s*0\.68rem;/);
    expect(accessibility).toMatch(
      /\.street-walk__exit-button[\s\S]*?min-height:\s*2\.75rem;[\s\S]*?min-width:\s*2\.75rem;/,
    );
    expect(accessibility).toMatch(
      /\.street-walk__zoom-controls button[\s\S]*?min-height:\s*2\.75rem;[\s\S]*?min-width:\s*2\.75rem;/,
    );
    expect(accessibility).toMatch(
      /\.street-walk-map__toolbar button\s*\{[^}]*min-height:\s*2\.75rem;[^}]*min-width:\s*2\.75rem;[^}]*\}/,
    );
    expect(accessibility).toMatch(/\.street-walk-map__search input[\s\S]*?min-height:\s*2\.75rem;/);
    expect(accessibility).toMatch(
      /\.street-walk-map__results-header button[\s\S]*?min-height:\s*2\.75rem;[\s\S]*?min-width:\s*2\.75rem;/,
    );
  });

  it('keeps the short desktop atlas aside scrollable and mobile credit visible', async () => {
    const css = await readFile(`${root}/src/styles/street-leonida.css`, 'utf8');
    const accessibility = css.slice(css.indexOf('/* Street Leonida accessibility finish */'));

    expect(accessibility).toMatch(/\.street-walk-map__destinations[\s\S]*?overflow-y:\s*auto;/);
    expect(accessibility).toMatch(
      /@media \(max-width: 767px\), \(pointer: coarse\)[\s\S]*?\.street-walk__credit\s*\{[^}]*display:\s*flex !important;/,
    );
    expect(accessibility).toMatch(
      /@media \(max-width: 767px\), \(pointer: coarse\)[\s\S]*?\.street-walk__credit span,[\s\S]*?\.street-walk__credit a\s*\{[^}]*flex:\s*0 1 auto;/,
    );
    expect(accessibility).toMatch(
      /@media \(max-width: 767px\), \(pointer: coarse\)[\s\S]*?\.street-walk__credit span,[\s\S]*?\.street-walk__credit a\s*\{[^}]*min-width:\s*0;/,
    );
    expect(accessibility).toMatch(
      /@media \(max-width: 767px\), \(pointer: coarse\)[\s\S]*?\.street-walk__credit span,[\s\S]*?\.street-walk__credit a\s*\{[^}]*max-width:\s*100%;/,
    );
    expect(accessibility).toMatch(
      /@media \(max-width: 767px\), \(pointer: coarse\)[\s\S]*?\.street-walk__credit span,[\s\S]*?\.street-walk__credit a\s*\{[^}]*overflow-wrap:\s*anywhere;/,
    );
  });

  it('discloses original generated visual studies in the public credit', async () => {
    const component = await readFile(
      `${root}/src/components/tools/street-leonida/WalkableWorld.astro`,
      'utf8',
    );

    expect(component).toMatch(/original generated material \/ vegetation studies/i);
  });
});
