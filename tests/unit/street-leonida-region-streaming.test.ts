import { describe, expect, it, vi } from 'vitest';

import { gtadbToWorld } from '../../src/features/street-leonida/leonida-coordinates';
import { REVIEWED_GTADB_ANCHORS } from '../../src/features/street-leonida/leonida-evidence';
import {
  AMBROSIA_WORLD,
  MOUNT_KALAGA_WORLD,
  REGION_WORLD,
} from '../../src/features/street-leonida/walk-geography';
import {
  createWalkRegionStreamManager,
  getWalkRegionStates,
  WALK_REGION_LOAD_RADIUS,
  WALK_REGION_UNLOAD_RADIUS,
} from '../../src/features/street-leonida/walk-region-streaming';

describe('Street Leonida metre-scale regional streaming', () => {
  it('does not collapse geographically separated Ambrosia and Mount Kalaga into one render cell', () => {
    const states = getWalkRegionStates(MOUNT_KALAGA_WORLD.centre);

    expect(states).toContainEqual(
      expect.objectContaining({ region: 'mount-kalaga', state: 'active' }),
    );
    expect(states.some(({ region }) => region === 'ambrosia')).toBe(false);
    expect(
      Math.hypot(
        MOUNT_KALAGA_WORLD.centre.x - AMBROSIA_WORLD.town.x,
        MOUNT_KALAGA_WORLD.centre.z - AMBROSIA_WORLD.town.z,
      ),
    ).toBeGreaterThan(4_000);
  });

  it('keeps the closest region active when the player is outside every load radius', () => {
    const states = getWalkRegionStates({ x: 0, z: 0 });

    expect(states.filter(({ state }) => state === 'active')).toHaveLength(1);
    expect(states[0]?.distance).toBeLessThanOrEqual(
      Math.min(...Object.values(REGION_WORLD).map((anchor) => Math.hypot(anchor.x, anchor.z))),
    );
  });

  it.each([
    ['L406', AMBROSIA_WORLD.xeroStation],
    ['L594', AMBROSIA_WORLD.unknownUtilityL594],
    ['L888', AMBROSIA_WORLD.radioTower],
    ['L1065', AMBROSIA_WORLD.sugarFields],
  ] as const)('keeps Ambrosia active when travelling to its remote %s anchor', (_id, anchor) => {
    expect(getWalkRegionStates(anchor)[0]).toMatchObject({
      region: 'ambrosia',
      state: 'active',
    });
  });

  it('keeps the Leonida Keys cell active at the remote L325 Rusty Anchor', () => {
    const rustyAnchor = gtadbToWorld(REVIEWED_GTADB_ANCHORS.L325.gtadb);

    expect(getWalkRegionStates(rustyAnchor)[0]).toMatchObject({
      region: 'leonida-keys',
      state: 'active',
      distance: 0,
    });
  });

  it('uses a larger unload radius to prevent boundary thrashing', () => {
    expect(WALK_REGION_UNLOAD_RADIUS).toBeGreaterThan(WALK_REGION_LOAD_RADIUS);
    const anchor = REGION_WORLD.grassrivers;
    const neighbour = REGION_WORLD.leonidaKeys;
    const span = Math.hypot(neighbour.x - anchor.x, neighbour.z - anchor.z);
    const distanceFromAnchor = WALK_REGION_LOAD_RADIUS + 40;
    const position = {
      x: anchor.x + ((neighbour.x - anchor.x) / span) * distanceFromAnchor,
      z: anchor.z + ((neighbour.z - anchor.z) / span) * distanceFromAnchor,
    };
    const retained = getWalkRegionStates(position, ['grassrivers']);
    const cold = getWalkRegionStates(position, []);

    expect(retained.some(({ region }) => region === 'grassrivers')).toBe(true);
    expect(cold.some(({ region }) => region === 'grassrivers')).toBe(false);
  });

  it('creates each streamed resource once and disposes it after leaving the unload radius', () => {
    const create = vi.fn((region: string) => ({ region }));
    const setVisible = vi.fn();
    const dispose = vi.fn();
    const manager = createWalkRegionStreamManager({ create, setVisible, dispose });

    manager.sync(REGION_WORLD.viceCity);
    manager.sync({ x: REGION_WORLD.viceCity.x + 2, z: REGION_WORLD.viceCity.z + 2 });
    expect(create.mock.calls.filter(([region]) => region === 'vice-city')).toHaveLength(1);

    manager.sync(REGION_WORLD.mountKalaga);
    expect(dispose).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'vice-city' }),
      'vice-city',
    );

    manager.dispose();
    expect(manager.loadedRegions()).toEqual([]);
  });
});
