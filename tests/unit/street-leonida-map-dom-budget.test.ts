import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  GTADB_MAP_MARKER_DOM_BUDGET,
  renderGtadbLandmarkLayer,
  type GtadbMapSnapshot,
} from '../../src/features/street-leonida/walk-map';

const root = process.cwd();

describe('Street Leonida atlas DOM budget', () => {
  it('keeps the complete searchable catalogue while windowing visible SVG markers', async () => {
    const snapshot = JSON.parse(
      await readFile(
        `${root}/public/assets/street-leonida/maps/gtadb-landmarks-7c3f8c2.json`,
        'utf8',
      ),
    ) as GtadbMapSnapshot;
    const attributes = new Map<string, string>();
    const layer = {
      innerHTML: '',
      setAttribute(name: string, value: string) {
        attributes.set(name, value);
      },
    } as unknown as SVGGraphicsElement;

    const result = renderGtadbLandmarkLayer(layer, snapshot);
    const domMarkers = layer.innerHTML.match(/data-gtadb-id="/g)?.length ?? 0;

    expect(result.catalogueCount).toBe(2_198);
    expect(result.renderedCount).toBe(2_091);
    expect(domMarkers).toBeGreaterThan(40);
    expect(domMarkers).toBeLessThanOrEqual(GTADB_MAP_MARKER_DOM_BUDGET);
    expect(attributes.get('data-gtadb-dom-marker-count')).toBe(String(domMarkers));
    expect(layer.innerHTML).toContain('data-density-source-count="398"');
  });
});
