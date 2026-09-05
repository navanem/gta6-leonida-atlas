import { describe, expect, it, vi } from 'vitest';
import { mountExplorer } from '../../src/features/explorer/mount-explorer';
import { publicPath } from '../../src/features/explorer/public-path';
import type { WalkWorldOverlayController } from '../../src/features/street-leonida/walk-overlays';

function fixture() {
  const loading = { setAttribute: vi.fn() };
  const unavailable = { removeAttribute: vi.fn() };
  const root = {
    dataset: {},
    querySelector: (selector: string) =>
      selector === '[data-walk-loading]' ? loading : unavailable,
  } as unknown as HTMLElement;
  const overlays: WalkWorldOverlayController = {
    openMap: vi.fn(),
    closeMap: vi.fn(),
    openEvidence: vi.fn(),
    closeEvidence: vi.fn(),
    updatePlayer: vi.fn(),
    setBeforeOpen: vi.fn(),
    showWebglFallback: vi.fn(),
    markThreeDimensionalReady: vi.fn(),
    dispose: vi.fn(),
  };
  const world = { openEvidence: vi.fn(), dispose: vi.fn() };
  const modules = {
    initializeOverlays: vi.fn(() => overlays),
    initializeWorld: vi.fn(() => world),
  };
  return { root, loading, unavailable, overlays, world, modules };
}

describe('optional explorer lifetime', () => {
  it('does not initialize a renderer after unmount during its download', async () => {
    const { root, modules } = fixture();
    let resolve!: (value: typeof modules) => void;
    const promise = new Promise<typeof modules>((done) => {
      resolve = done;
    });
    const dispose = mountExplorer(root, () => promise);
    dispose();
    resolve(modules);
    await promise;
    expect(modules.initializeWorld).not.toHaveBeenCalled();
    expect(modules.initializeOverlays).not.toHaveBeenCalled();
  });

  it('disposes a mounted renderer and its overlays once when cleanup repeats', async () => {
    const { root, modules, world, overlays } = fixture();
    const promise = Promise.resolve(modules);
    const dispose = mountExplorer(root, () => promise);
    await promise;
    expect(root.dataset.walkRuntime).toBe('ready');
    expect(modules.initializeWorld).toHaveBeenCalledWith(root, overlays);
    dispose();
    dispose();
    expect(world.dispose).toHaveBeenCalledTimes(1);
    expect(overlays.dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps an unavailable renderer explicit instead of marking WebGL fallback ready', async () => {
    const { root, modules, overlays } = fixture();
    modules.initializeWorld.mockImplementation(() => {
      root.dataset.walkMode = 'atlas-only';
      return { openEvidence: vi.fn(), dispose: vi.fn() };
    });
    const promise = Promise.resolve(modules);
    const dispose = mountExplorer(root, () => promise);
    await promise;
    expect(root.dataset.walkRuntime).toBe('unavailable');
    dispose();
    expect(overlays.dispose).toHaveBeenCalled();
  });

  it('makes a failed chunk download recoverable through the fallback controls', async () => {
    const { root, loading, unavailable } = fixture();
    const dispose = mountExplorer(root, () => Promise.reject(new Error('Network unavailable')));
    await vi.waitFor(() => expect(root.dataset.walkRuntime).toBe('unavailable'));
    expect(loading.setAttribute).toHaveBeenCalledWith('hidden', '');
    expect(unavailable.removeAttribute).toHaveBeenCalledWith('hidden');
    dispose();
  });
});

describe('optional explorer public paths', () => {
  it.each([
    ['/', '/assets/map.svg'],
    ['/fork/', '/fork/assets/map.svg'],
    ['/fork', '/fork/assets/map.svg'],
    ['fork/nested/', '/fork/nested/assets/map.svg'],
  ])('keeps assets under host base %s', (base, expected) => {
    expect(publicPath('/assets/map.svg', base)).toBe(expected);
  });
});
