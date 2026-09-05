import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ProjectPage from '../../src/features/project/ProjectPage';
import {
  LEONIDA_ATLAS_RELEASES,
  latestLeonidaAtlasRelease,
} from '../../src/features/street-leonida/releases';

describe('Leonida Atlas current release', () => {
  it('publishes only v0.6.0 across the registry, visible changelog and release documentation', async () => {
    expect(LEONIDA_ATLAS_RELEASES).toHaveLength(1);
    expect(latestLeonidaAtlasRelease).toMatchObject({
      version: 'v0.6.0',
      date: '2026-09-05',
      status: 'public',
    });
    const markup = renderToStaticMarkup(
      createElement(ProjectPage, { page: 'changelog', onClose: () => undefined }),
    );
    const documentation = await readFile(new URL('../../RELEASES.md', import.meta.url), 'utf8');
    for (const output of [markup, documentation]) {
      expect(output).toContain('v0.6.0');
      expect(output).toContain('Released');
      expect(output).not.toMatch(/\bv0\.[1-5]\.\d+\b/);
      expect(output).not.toContain('local candidate; not pushed');
    }
    expect(markup).toContain(latestLeonidaAtlasRelease.title);
  });

  it('retains source uncertainty and the limits of the executed browser verification', () => {
    const notes = latestLeonidaAtlasRelease.highlights.join(' ');
    expect(notes).toContain('APPROXIMATE');
    expect(notes).toContain('UNKNOWN');
    expect(notes).toContain('GTADB');
    expect(notes).toContain('CC BY 4.0');
    expect(notes).toContain('107 unpositioned');
    const verification = latestLeonidaAtlasRelease.verification.join(' ');
    expect(verification).toContain('Chromium');
    expect(verification).toContain('WebKit');
    expect(verification).toContain('explicitly skipped');
  });
});
