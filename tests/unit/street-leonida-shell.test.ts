import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  GTADB_LICENSE_URL,
  GTADB_PINNED_DATA_URL,
  GTADB_PREFERRED_SOURCE,
} from '../../src/features/street-leonida/gtadb';

const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (relativePath: string) => readFile(`${root}/${relativePath}`, 'utf8');

describe('Street Leonida evidence-first explorer shell', () => {
  it('ships one accessible walk-world runtime without the legacy documented scene', async () => {
    const [shell, world] = await Promise.all([
      read('src/components/tools/street-leonida/ExplorerShell.astro'),
      read('src/components/tools/street-leonida/WalkableWorld.astro'),
    ]);

    expect(shell.match(/<WalkableWorld\b/g)).toHaveLength(1);
    expect(shell).not.toContain('DocumentedScene');
    expect(shell).not.toContain('data-explorer-stage');
    expect(world).toContain('data-walk-canvas');
    expect(world).not.toContain('initializeWalkMap(world');
    expect(world).toContain('initializeWalkWorldOverlays(world)');
    expect(world).toContain("import('@features/street-leonida/walk-world')");
    expect(world).toContain('requestIdleCallback');
    expect(world).toContain("typeof window.requestIdleCallback === 'function'");
    expect(world).toContain("startButton?.addEventListener('pointerenter', requestRuntimeLoad");
    expect(world).toContain("startButton?.addEventListener('focus', requestRuntimeLoad");
    expect(world).toContain('initializeWalkableWorld(world, overlays)');
    expect(world).toContain('controller?.dispose()');
    expect(world).toContain('overlays.dispose()');
    expect(world).toMatch(/document\.addEventListener\(\s*['"]astro:before-swap['"]/);
  });

  it('makes provenance, uncertainty, map, evidence, and touch controls public and operable', async () => {
    const [shell, world] = await Promise.all([
      read('src/components/tools/street-leonida/ExplorerShell.astro'),
      read('src/components/tools/street-leonida/WalkableWorld.astro'),
    ]);

    expect(world).toContain('GTADB / Map GTA');
    expect(world).toContain('Official visual identity or existence');
    expect(world).toContain('Community-estimated placement');
    expect(world).toContain('Uncertain entries');
    expect(world).toContain('transformed presentation');
    expect(world).toContain('pinned revision');
    expect(world).toMatch(/Source-derived coastlines, roads and land cover are\s+APPROXIMATE/);
    expect(world).toContain('href={GTADB_PREFERRED_SOURCE}');
    expect(world).toContain('href={GTADB_LICENSE_URL}');
    expect(world).toContain('href={GTADB_PINNED_DATA_URL}');
    expect(GTADB_PREFERRED_SOURCE).toBe('https://map.gtadb.org');
    expect(GTADB_LICENSE_URL).toBe('https://creativecommons.org/licenses/by/4.0/');
    expect(GTADB_PINNED_DATA_URL).toContain('/blob/7c3f8c295d64254e6b6d269b77c6f84fc4339f9c/');
    expect(`${shell}\n${world}`).toContain('Rockstar visual evidence');
    expect(`${shell}\n${world}`).toContain('APPROXIMATE');
    expect(`${shell}\n${world}`).toContain('UNKNOWN');
    expect(world).not.toMatch(/exact (?:raster|GTADB points?|shared world coordinates|tiles?)/i);
    expect(world).not.toMatch(/\b2 m\b/i);
    expect(world).toContain('data-open-walk-map');
    expect(world).toContain('data-walk-map');
    expect(world).toContain('data-walk-map-layer-toggle="supported"');
    expect(world).toContain('data-walk-map-layer-toggle="uncertain"');
    expect(world).toContain('aria-label="Hide GTADB entries without uncertainty signals"');
    expect(world).toContain('aria-label="Show uncertain GTADB entries"');
    expect(world).toContain('<strong>Named evidence</strong>');
    expect(world).toContain('<strong>Uncertain entries</strong>');
    expect(world).not.toContain('data-walk-map-layer-toggle="canonical"');
    expect(world).not.toContain('data-walk-map-layer-toggle="community"');
    expect(world).not.toContain('State of Leonida v15');
    expect(world).not.toContain('leonida-world-map.jpg');
    expect(world).not.toContain('data-player-position="-104.0,42.0"');
    expect(world).not.toContain('Vice City Beach');
    expect(world).toContain('PLACE_ENTRY_VIEWS');
    expect(world).not.toContain('gtadb.net/gta-6-map/interactive');
    expect(world).not.toContain('/blob/main/');
    expect(world).toContain('Forest, rock cuts and winding roads');
    expect(world).not.toMatch(/quarry/i);
    expect(world).toContain('data-walk-scene-dialog');
    expect(world).toContain('data-walk-scene-image');
    expect(world).toContain('data-walk-scene-evidence-label');
    expect(world).toContain('data-walk-scene-provenance');
    expect(world).toContain('DOCUMENTED SOURCE EVIDENCE');
    expect(world).not.toContain('Open official source');
    expect(world).toContain('data-walk-mobile-controls');
    expect(world).toContain('data-walk-joystick');
    expect(world).toContain('data-walk-look-pad');
    expect(world.match(/data-walk-move-button=/g)).toHaveLength(4);
    expect(world.match(/data-walk-look-button=/g)).toHaveLength(4);
    expect(world).toContain('aria-label="Move forward"');
    expect(world).toContain('aria-label="Look right"');
    expect(world).not.toContain('data-walk-map-svg role="img"');
  });

  it('makes the visible desktop M legend an actual map trigger', async () => {
    const [world, overlays] = await Promise.all([
      read('src/components/tools/street-leonida/WalkableWorld.astro'),
      read('src/features/street-leonida/walk-overlays.ts'),
    ]);

    expect(world).toContain('data-walk-map-shortcut');
    expect(world.match(/data-open-walk-map/g)).toHaveLength(3);
    expect(overlays).toContain("root.querySelectorAll<HTMLButtonElement>('[data-open-walk-map]')");
  });
});
