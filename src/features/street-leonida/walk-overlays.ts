import { initializeWalkMap, type WalkMapController, type WalkMapPlayerPose } from './walk-map';

type WalkOverlayKind = 'map' | 'evidence';
type BeforeOverlayOpen = (kind: WalkOverlayKind) => void;

interface WalkOverlayElements {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement | null;
  readonly loading: HTMLElement | null;
  readonly unsupported: HTMLElement | null;
  readonly mapDialog: HTMLDialogElement | null;
  readonly evidenceDialog: HTMLDialogElement | null;
  readonly sceneDialog: HTMLDialogElement | null;
  readonly mapButtons: readonly HTMLButtonElement[];
  readonly evidenceButtons: readonly HTMLButtonElement[];
  readonly closeMap: HTMLButtonElement | null;
  readonly closeEvidence: HTMLButtonElement | null;
  readonly fallbackNote: HTMLElement | null;
  readonly keyboardTarget: EventTarget | null;
}

export interface WalkWorldOverlayController {
  openMap(): void;
  closeMap(): void;
  openEvidence(): void;
  closeEvidence(): void;
  updatePlayer(pose: WalkMapPlayerPose): void;
  setBeforeOpen(handler: BeforeOverlayOpen | null): void;
  showWebglFallback(): void;
  markThreeDimensionalReady(): void;
  dispose(): void;
}

const overlayInstances = new WeakMap<HTMLElement, WalkWorldOverlayController>();

function datasetPlayerPose(root: HTMLElement): WalkMapPlayerPose | null {
  const x = Number.parseFloat(root.dataset.playerX ?? '');
  const z = Number.parseFloat(root.dataset.playerZ ?? '');
  const yaw = Number.parseFloat(root.dataset.playerYaw ?? '');
  if (Number.isFinite(x) && Number.isFinite(z)) {
    return { x, z, yaw: Number.isFinite(yaw) ? yaw : 0 };
  }

  const [fallbackX, fallbackZ] = (root.dataset.playerPosition ?? '').split(',').map(Number);
  return Number.isFinite(fallbackX) && Number.isFinite(fallbackZ)
    ? { x: fallbackX!, z: fallbackZ!, yaw: 0 }
    : null;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const candidate = target as { isContentEditable?: boolean; tagName?: string };
  return Boolean(
    candidate.isContentEditable ||
    (candidate.tagName && ['INPUT', 'TEXTAREA', 'SELECT'].includes(candidate.tagName)),
  );
}

export function createWalkWorldOverlayController(
  elements: WalkOverlayElements,
  mapController: WalkMapController | null,
): WalkWorldOverlayController {
  const {
    root,
    canvas,
    loading,
    unsupported,
    mapDialog,
    evidenceDialog,
    sceneDialog,
    mapButtons,
    evidenceButtons,
    closeMap,
    closeEvidence,
    fallbackNote,
    keyboardTarget,
  } = elements;
  const events = new AbortController();
  const eventOptions = { signal: events.signal } as const;
  let beforeOpen: BeforeOverlayOpen | null = null;
  let atlasOnlyObserver: MutationObserver | null = null;
  let disposed = false;

  function disableAtlasOnlyTravelControls(): void {
    if (root.dataset.walkMode !== 'atlas-only' || !mapDialog) return;
    const title = mapDialog.querySelector<HTMLElement>('.street-walk-map__destination-title');
    if (title && title.textContent !== 'Browse evidence') title.textContent = 'Browse evidence';
    mapDialog.querySelectorAll<Element>('[data-map-travel]').forEach((target) => {
      if (target instanceof HTMLButtonElement) {
        target.disabled = true;
        target.setAttribute('aria-disabled', 'true');
        target.title = '3D travel is unavailable in this browser';
        return;
      }
      target.setAttribute('aria-disabled', 'true');
      target.setAttribute('role', 'img');
      target.setAttribute('tabindex', '-1');
      const label = target.getAttribute('aria-label');
      if (label?.startsWith('Travel to ')) {
        target.setAttribute('aria-label', `Evidence point: ${label.slice('Travel to '.length)}`);
      }
    });
  }

  function updatePlayer(pose: WalkMapPlayerPose): void {
    mapController?.updatePlayer(pose);
  }

  function openMap(): void {
    if (disposed || mapDialog?.open || evidenceDialog?.open || sceneDialog?.open) return;
    beforeOpen?.('map');
    const pose = datasetPlayerPose(root);
    if (pose) updatePlayer(pose);
    mapDialog?.showModal();
    mapController?.resetView();
    void mapController?.loadCatalogue();
  }

  function closeMapDialog(): void {
    if (mapDialog?.open) mapDialog.close();
  }

  function openEvidence(): void {
    if (disposed || evidenceDialog?.open || mapDialog?.open || sceneDialog?.open) return;
    beforeOpen?.('evidence');
    evidenceDialog?.showModal();
  }

  function closeEvidenceDialog(): void {
    if (evidenceDialog?.open) evidenceDialog.close();
  }

  function handleKeyboardShortcut(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (isTypingTarget(keyboardEvent.target) || keyboardEvent.key?.toLowerCase() !== 'm') return;
    if (sceneDialog?.open) return;
    keyboardEvent.preventDefault();
    openMap();
  }

  function suppressAtlasOnlyTravel(event: Event): void {
    if (root.dataset.walkMode !== 'atlas-only') return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  mapButtons.forEach((button) => button.addEventListener('click', openMap, eventOptions));
  evidenceButtons.forEach((button) => button.addEventListener('click', openEvidence, eventOptions));
  closeMap?.addEventListener('click', closeMapDialog, eventOptions);
  closeEvidence?.addEventListener('click', closeEvidenceDialog, eventOptions);
  keyboardTarget?.addEventListener('keydown', handleKeyboardShortcut, eventOptions);
  mapDialog?.addEventListener('street-leonida:map-travel', suppressAtlasOnlyTravel, {
    capture: true,
    signal: events.signal,
  });

  const controller: WalkWorldOverlayController = {
    openMap,
    closeMap: closeMapDialog,
    openEvidence,
    closeEvidence: closeEvidenceDialog,
    updatePlayer,
    setBeforeOpen(handler) {
      beforeOpen = handler;
    },
    showWebglFallback() {
      root.dataset.walkReady = 'false';
      root.dataset.walkMode = 'atlas-only';
      mapDialog?.setAttribute('data-walk-map-mode', 'atlas-only');
      fallbackNote?.removeAttribute('hidden');
      unsupported?.removeAttribute('hidden');
      loading?.setAttribute('hidden', '');
      canvas?.setAttribute('aria-hidden', 'true');
      disableAtlasOnlyTravelControls();
      if (!atlasOnlyObserver && mapDialog && typeof MutationObserver !== 'undefined') {
        atlasOnlyObserver = new MutationObserver(disableAtlasOnlyTravelControls);
        atlasOnlyObserver.observe(mapDialog, { childList: true, subtree: true });
      }
    },
    markThreeDimensionalReady() {
      root.dataset.walkMode = 'three-dimensional';
      mapDialog?.setAttribute('data-walk-map-mode', 'travel');
      fallbackNote?.setAttribute('hidden', '');
      unsupported?.setAttribute('hidden', '');
      canvas?.removeAttribute('aria-hidden');
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      beforeOpen = null;
      atlasOnlyObserver?.disconnect();
      atlasOnlyObserver = null;
      events.abort();
      mapController?.dispose();
      if (overlayInstances.get(root) === controller) overlayInstances.delete(root);
      root.dataset.walkOverlayInitialized = 'false';
    },
  };
  return controller;
}

/**
 * Boots the Atlas and evidence UI without importing Three.js. This controller intentionally owns
 * only non-3D overlays, so those sources remain usable while WebGL is loading or unavailable.
 */
export function initializeWalkWorldOverlays(root: HTMLElement): WalkWorldOverlayController {
  const existing = overlayInstances.get(root);
  if (existing) return existing;
  const mapDialog = root.querySelector<HTMLDialogElement>('[data-walk-map]');
  const mapController = initializeWalkMap(mapDialog ?? root, {
    renderMap: 'if-missing',
    playerStateHost: root,
    deferCatalogue: true,
  });
  const ownerDocument = root.ownerDocument ?? (typeof document === 'undefined' ? null : document);
  const controller = createWalkWorldOverlayController(
    {
      root,
      canvas: root.querySelector<HTMLCanvasElement>('[data-walk-canvas]'),
      loading: root.querySelector<HTMLElement>('[data-walk-loading]'),
      unsupported: root.querySelector<HTMLElement>('[data-walk-unsupported]'),
      mapDialog,
      evidenceDialog: root.querySelector<HTMLDialogElement>('[data-walk-evidence-dialog]'),
      sceneDialog: root.querySelector<HTMLDialogElement>('[data-walk-scene-dialog]'),
      mapButtons: [...root.querySelectorAll<HTMLButtonElement>('[data-open-walk-map]')],
      evidenceButtons: [...root.querySelectorAll<HTMLButtonElement>('[data-open-walk-evidence]')],
      closeMap: root.querySelector<HTMLButtonElement>('[data-close-walk-map]'),
      closeEvidence: root.querySelector<HTMLButtonElement>('[data-close-walk-evidence]'),
      fallbackNote: root.querySelector<HTMLElement>('[data-walk-map-fallback-note]'),
      keyboardTarget: ownerDocument,
    },
    mapController,
  );
  overlayInstances.set(root, controller);
  root.dataset.walkOverlayInitialized = 'true';
  return controller;
}
