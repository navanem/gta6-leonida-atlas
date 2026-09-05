import type { WalkableWorldController } from '../street-leonida/walk-world';
import type { WalkWorldOverlayController } from '../street-leonida/walk-overlays';

interface ExplorerModules {
  initializeOverlays(root: HTMLElement): WalkWorldOverlayController;
  initializeWorld(
    root: HTMLElement,
    overlays: WalkWorldOverlayController,
  ): WalkableWorldController | undefined;
}

/** The heavy renderer is requested only after the optional view has mounted. */
export async function loadExplorerModules(): Promise<ExplorerModules> {
  const [world, overlays] = await Promise.all([
    import('../street-leonida/walk-world'),
    import('../street-leonida/walk-overlays'),
  ]);
  return {
    initializeWorld: world.initializeWalkableWorld,
    initializeOverlays: overlays.initializeWalkWorldOverlays,
  };
}

/** Owns the imperative engine lifetime, including an unmount during a chunk download. */
export function mountExplorer(root: HTMLElement, load = loadExplorerModules): () => void {
  let disposed = false;
  let world: WalkableWorldController | undefined;
  let overlays: WalkWorldOverlayController | undefined;
  root.dataset.walkRuntime = 'loading';
  void load()
    .then((modules) => {
      if (disposed) return;
      overlays = modules.initializeOverlays(root);
      world = modules.initializeWorld(root, overlays);
      root.dataset.walkRuntime =
        root.dataset.walkMode === 'atlas-only' || !world ? 'unavailable' : 'ready';
      if (!world) overlays.showWebglFallback();
    })
    .catch(() => {
      if (disposed) return;
      root.dataset.walkRuntime = 'unavailable';
      overlays?.showWebglFallback();
      root.querySelector('[data-walk-loading]')?.setAttribute('hidden', '');
      root.querySelector('[data-walk-unsupported]')?.removeAttribute('hidden');
    });
  return () => {
    if (disposed) return;
    disposed = true;
    world?.dispose();
    overlays?.dispose();
  };
}
