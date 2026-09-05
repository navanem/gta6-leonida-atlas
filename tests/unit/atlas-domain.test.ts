import { describe, expect, it, vi } from 'vitest';
import { filterPlaces } from '../../src/domain/filter';
import { createRegistry } from '../../src/plugins/registry';
import { createGuestCapabilities, resolveCapabilities } from '../../src/capabilities/providers';
import type { Filters, Place } from '../../src/domain/types';

const filters: Filters = {
  query: '',
  category: 'all',
  favoritesOnly: false,
  personalOnly: false,
  evidence: 'all',
  collectionId: null,
};
const place: Place = {
  id: 'L1',
  title: 'Café Beach',
  description: '',
  category: 'business',
  position: { x: 0, y: 0 },
  layerId: 'community',
  tags: ['food'],
  region: 'Vice City',
  source: { title: 'GTADB', url: 'https://map.gtadb.org' },
  evidence: 'approximate',
};
describe('composable catalogue filters', () => {
  it('normalizes accents and finds regions/tags and personal notes', () => {
    expect(filterPlaces([place], { ...filters, query: 'cafe' }, [], [], [])).toEqual([place]);
    expect(filterPlaces([place], { ...filters, query: 'vice food' }, [], [], [])).toEqual([place]);
    expect(
      filterPlaces(
        [place],
        { ...filters, query: 'sunset' },
        [],
        [{ placeId: 'L1', text: 'sunset spot', updatedAt: '' }],
        [],
      ),
    ).toEqual([place]);
  });
  it('intersects category favorites and collection membership', () => {
    const collection = {
      id: 'collection:1',
      name: 'Trip',
      placeIds: ['L1'],
      createdAt: '',
      updatedAt: '',
    };
    expect(
      filterPlaces(
        [place],
        { ...filters, favoritesOnly: true, collectionId: collection.id },
        ['L1'],
        [],
        [collection],
      ),
    ).toHaveLength(1);
    expect(
      filterPlaces(
        [place],
        { ...filters, favoritesOnly: true, collectionId: collection.id },
        [],
        [],
        [collection],
      ),
    ).toHaveLength(0);
    expect(
      filterPlaces([place], { ...filters, category: 'nature' }, ['L1'], [], [collection]),
    ).toHaveLength(0);
  });
});
describe('internal module registry', () => {
  it('rejects duplicate registration and unregisters without disturbing other modules', () => {
    const registry = createRegistry();
    const action = { id: 'test', title: 'Test', run: vi.fn() };
    const dispose = registry.registerAction(action);
    expect(() => registry.registerAction(action)).toThrow(/duplicate/i);
    registry.actions.get('test')?.run();
    expect(action.run).toHaveBeenCalledOnce();
    dispose();
    expect(registry.actions.size).toBe(0);
  });
  it('isolates event listener failures and supports unsubscribe', () => {
    const registry = createRegistry();
    const seen = vi.fn();
    registry.on('selection', () => {
      throw new Error('plugin failed');
    });
    const dispose = registry.on('selection', seen);
    expect(() => registry.emit('selection', 'L1')).not.toThrow();
    expect(seen).toHaveBeenCalledWith('L1');
    dispose();
    registry.emit('selection', 'L2');
    expect(seen).toHaveBeenCalledOnce();
  });
});
describe('fork-safe optional capabilities', () => {
  it('has no account or sync by default and performs no network work', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const guest = createGuestCapabilities();
    expect(guest.auth.enabled).toBe(false);
    expect(await guest.auth.getSession()).toBeNull();
    expect(guest.sync.enabled).toBe(false);
    expect(await guest.sync.sync()).toEqual({ status: 'disabled' });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
  it('falls back to guest when a private capability factory fails', async () => {
    expect(
      (
        await resolveCapabilities(async () => {
          throw Error('offline');
        })
      ).auth.enabled,
    ).toBe(false);
  });
});
