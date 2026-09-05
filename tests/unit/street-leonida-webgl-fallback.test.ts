import { afterEach, describe, expect, it, vi } from 'vitest';

import { initializeWalkableWorld } from '@features/street-leonida/walk-world';

function dialogHarness(): HTMLDialogElement & { open: boolean } {
  const dialog = new EventTarget() as unknown as HTMLDialogElement & { open: boolean };
  dialog.open = false;
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    if (!dialog.open) return;
    dialog.open = false;
    dialog.dispatchEvent(new Event('close'));
  };
  return dialog;
}

describe('Street Leonida WebGL fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns an owned evidence controller when the WebGL renderer cannot be created', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
      devicePixelRatio: 1,
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const evidenceButton = new EventTarget();
    const evidenceDialog = dialogHarness();
    const unsupportedAttributes = new Set(['hidden']);
    const loadingAttributes = new Set<string>();
    const unsupported = {
      removeAttribute: (name: string) => unsupportedAttributes.delete(name),
      setAttribute: (name: string) => unsupportedAttributes.add(name),
    };
    const loading = {
      removeAttribute: (name: string) => loadingAttributes.delete(name),
      setAttribute: (name: string) => loadingAttributes.add(name),
    };
    const canvas = Object.assign(new EventTarget(), {
      style: {},
      getContext: () => null,
      setAttribute: () => undefined,
    });
    const root = {
      dataset: {} as DOMStringMap,
      ownerDocument: new EventTarget(),
      querySelector(selector: string) {
        if (selector === '[data-walk-canvas]') return canvas;
        if (selector === '[data-walk-loading]') return loading;
        if (selector === '[data-walk-unsupported]') return unsupported;
        if (selector === '[data-walk-evidence-dialog]') return evidenceDialog;
        return null;
      },
      querySelectorAll(selector: string) {
        if (selector === '[data-open-walk-evidence]') return [evidenceButton];
        return [];
      },
      closest() {
        return null;
      },
    } as unknown as HTMLElement;

    const controller = initializeWalkableWorld(root);

    expect(controller).toBeDefined();
    expect(root.dataset.walkMode).toBe('atlas-only');
    expect(unsupportedAttributes.has('hidden')).toBe(false);
    expect(loadingAttributes.has('hidden')).toBe(true);
    evidenceButton.dispatchEvent(new Event('click'));
    expect(evidenceDialog.open).toBe(true);

    controller?.dispose();
    evidenceDialog.close();
    evidenceButton.dispatchEvent(new Event('click'));
    expect(evidenceDialog.open).toBe(false);
    expect(root.dataset.walkInitialized).toBe('false');
  });
});
