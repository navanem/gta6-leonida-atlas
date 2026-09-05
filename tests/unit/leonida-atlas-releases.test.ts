import { describe, expect, it } from 'vitest';

import { LEONIDA_ATLAS_RELEASES, latestLeonidaAtlasRelease } from '../../src/features/street-leonida/releases';

describe('Leonida Atlas release registry', () => {
  it('publishes the first public releases in newest-first order', () => {
    expect(LEONIDA_ATLAS_RELEASES.map((release) => release.version)).toEqual([
      'v0.3.1',
      'v0.3.0',
      'v0.2.0',
      'v0.1.0',
    ]);
    expect(latestLeonidaAtlasRelease.version).toBe('v0.3.1');
    expect(LEONIDA_ATLAS_RELEASES.every((release) => release.date === '2026-09-05')).toBe(true);
  });

  it('keeps early release notes honest about uncertainty and source status', () => {
    const notes = LEONIDA_ATLAS_RELEASES.flatMap((release) => release.highlights).join(' ');
    expect(notes).toContain('APPROXIMATE');
    expect(notes).toContain('UNKNOWN');
    expect(notes).toContain('GTADB');
    expect(notes).not.toContain('official Rockstar map');
    expect(notes).not.toContain('public GitHub release');
  });
});
