import { describe, expect, it } from 'vitest';

import {
  createWalkMapController,
  fitLeonidaAtlasViewBox,
  isWalkMapFreePointTap,
  projectWalkMapClientPoint,
  walkMapPlayerHorizontalEdge,
  walkMapUnitsPerCssPixel,
  type WalkMapClientRect,
  type WalkMapElements,
} from '../../src/features/street-leonida/walk-map';

const OVERVIEW = Object.freeze({ x: -32000, y: -24000, width: 40000, height: 40000 });
const LETTERBOXED_RECT = Object.freeze({ left: 100, top: 50, width: 1000, height: 500 });

interface ControllerHarness {
  readonly controller: ReturnType<typeof createWalkMapController>;
  readonly dialog: HTMLDialogElement;
  readonly documentListeners: Map<string, Set<EventListenerOrEventListenerObject>>;
  readonly listeners: Map<string, Set<EventListenerOrEventListenerObject>>;
  readonly playerLabelAttributes: Map<string, string>;
  readonly playerAttributes: Map<string, string>;
  readonly pointerCaptures: number[];
  readonly root: HTMLElement;
  readonly setRect: (rect: WalkMapClientRect) => void;
}

function createControllerHarness(
  initialRect: WalkMapClientRect = LETTERBOXED_RECT,
): ControllerHarness {
  const attributes = new Map<string, string>([['viewBox', '-32000 -24000 40000 40000']]);
  const documentListeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const playerLabelAttributes = new Map<string, string>();
  const playerAttributes = new Map<string, string>();
  const pointerCaptures: number[] = [];
  let rect = initialRect;
  const dialog = new EventTarget() as HTMLDialogElement;
  const ownerDocument = {
    activeElement: null,
    addEventListener(name: string, listener: EventListenerOrEventListenerObject) {
      const registered = documentListeners.get(name) ?? new Set();
      registered.add(listener);
      documentListeners.set(name, registered);
    },
    removeEventListener(name: string, listener: EventListenerOrEventListenerObject) {
      documentListeners.get(name)?.delete(listener);
    },
  } as unknown as Document;
  const svg = {
    ownerDocument,
    style: { touchAction: '' },
    getAttribute(name: string) {
      return attributes.get(name) ?? null;
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    hasAttribute(name: string) {
      return attributes.has(name);
    },
    removeAttribute(name: string) {
      attributes.delete(name);
    },
    addEventListener(name: string, listener: EventListenerOrEventListenerObject) {
      const registered = listeners.get(name) ?? new Set();
      registered.add(listener);
      listeners.set(name, registered);
    },
    removeEventListener(name: string, listener: EventListenerOrEventListenerObject) {
      listeners.get(name)?.delete(listener);
    },
    getBoundingClientRect() {
      return rect;
    },
    setPointerCapture(pointerId: number) {
      pointerCaptures.push(pointerId);
    },
    hasPointerCapture() {
      return false;
    },
    releasePointerCapture() {},
    closest(selector: string) {
      return selector === '[data-walk-map]' ? dialog : null;
    },
  } as unknown as SVGSVGElement;
  const root = {
    dataset: {} as DOMStringMap,
    closest() {
      return null;
    },
  } as unknown as HTMLElement;
  const elements: WalkMapElements = {
    root,
    svg,
    viewport: null,
    world: null,
    player: {
      setAttribute(name: string, value: string) {
        playerAttributes.set(name, value);
      },
      querySelector(selector: string) {
        if (selector !== '.atlas-player-label') return null;
        return {
          setAttribute(name: string, value: string) {
            playerLabelAttributes.set(name, value);
          },
          removeAttribute(name: string) {
            playerLabelAttributes.delete(name);
          },
        };
      },
    } as unknown as SVGGraphicsElement,
    heading: null,
    playerTitle: null,
    zoomIn: null,
    zoomOut: null,
    zoomReset: null,
    centerPlayer: null,
    zoomValue: null,
  };
  return {
    controller: createWalkMapController(elements),
    dialog,
    documentListeners,
    listeners,
    playerLabelAttributes,
    playerAttributes,
    pointerCaptures,
    root,
    setRect(next) {
      rect = next;
    },
  };
}

function emitPointer(
  listeners: ControllerHarness['listeners'],
  name: string,
  values: Partial<PointerEvent>,
): void {
  const event = {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    clientX: 600,
    clientY: 300,
    target: null,
    preventDefault() {},
    composedPath() {
      return [];
    },
    ...values,
  } as unknown as PointerEvent;
  for (const listener of listeners.get(name) ?? []) {
    if (typeof listener === 'function') listener(event);
    else listener.handleEvent(event);
  }
}

describe('Street Leonida free-point map navigation', () => {
  it('fits source coverage into responsive safe areas without SVG letterboxing', () => {
    const mobile = fitLeonidaAtlasViewBox({ left: 0, top: 0, width: 390, height: 844 });
    expect(mobile).toMatchObject({ x: -22000, width: 30000 });
    expect(mobile!.y).toBeCloseTo(-33931.07692307692, 8);
    expect(mobile!.height).toBeCloseTo(64923.07692307693, 8);
    expect(mobile!.width / mobile!.height).toBeCloseTo(390 / 844, 12);

    const desktop = fitLeonidaAtlasViewBox({ left: 0, top: 0, width: 1440, height: 960 });
    expect(desktop!.x).toBeCloseTo(-35512, 8);
    expect(desktop!.y).toBeCloseTo(-22016, 8);
    expect(desktop!.width).toBeCloseTo(57024, 8);
    expect(desktop!.height).toBeCloseTo(38016, 8);
    expect(desktop!.width / desktop!.height).toBeCloseTo(1440 / 960, 12);
  });

  it('inverts preserveAspectRatio letterboxing into the original world/GTADB frame', () => {
    const world = projectWalkMapClientPoint({ x: 600, y: 300 }, LETTERBOXED_RECT, OVERVIEW);

    expect(world).toEqual({ x: -12000, z: -4000 });
    expect({ x: world!.x / 2, y: world!.z / -2 }).toEqual({ x: -6000, y: 2000 });
    expect(projectWalkMapClientPoint({ x: 349.99, y: 300 }, LETTERBOXED_RECT, OVERVIEW)).toBeNull();
    expect(projectWalkMapClientPoint({ x: 850.01, y: 300 }, LETTERBOXED_RECT, OVERVIEW)).toBeNull();
  });

  it('rejects projected points outside the canonical bounds and unusable geometry', () => {
    expect(
      projectWalkMapClientPoint(
        { x: 100, y: 100 },
        { left: 0, top: 0, width: 1000, height: 1000 },
        { x: -40000, y: -40000, width: 40000, height: 40000 },
      ),
    ).toBeNull();
    expect(
      projectWalkMapClientPoint(
        { x: 0, y: 0 },
        { left: 0, top: 0, width: 0, height: 100 },
        OVERVIEW,
      ),
    ).toBeNull();
  });

  it('accepts only a short, uncancelled, single-pointer gesture away from a marker', () => {
    expect(
      isWalkMapFreePointTap({
        maxTravel: 5.99,
        cancelled: false,
        hadMultiplePointers: false,
        startedOnTravelTarget: false,
        endedOnTravelTarget: false,
      }),
    ).toBe(true);

    for (const rejected of [
      { maxTravel: 6.01 },
      { cancelled: true },
      { hadMultiplePointers: true },
      { startedOnTravelTarget: true },
      { endedOnTravelTarget: true },
    ]) {
      expect(
        isWalkMapFreePointTap({
          maxTravel: 0,
          cancelled: false,
          hadMultiplePointers: false,
          startedOnTravelTarget: false,
          endedOnTravelTarget: false,
          ...rejected,
        }),
      ).toBe(false);
    }
  });

  it('dispatches one full-precision map travel for a direct tap', () => {
    const harness = createControllerHarness();
    const received: CustomEvent[] = [];
    harness.dialog.addEventListener('street-leonida:map-travel', (event) => {
      received.push(event as CustomEvent);
    });

    emitPointer(harness.listeners, 'pointerdown', { pointerId: 17 });
    emitPointer(harness.listeners, 'pointerup', { pointerId: 17 });

    expect(received.map(({ detail }) => detail)).toEqual([
      {
        x: -7000,
        z: -3008,
        label: 'Selected map point',
        id: 'map-point:-7000:-3008',
        source: 'map',
      },
    ]);
    expect(harness.pointerCaptures).toEqual([17]);
    harness.controller.dispose();
  });

  it('does not travel after a pan, pinch, cancelled gesture, or marker press', () => {
    const harness = createControllerHarness();
    const received: CustomEvent[] = [];
    harness.dialog.addEventListener('street-leonida:map-travel', (event) => {
      received.push(event as CustomEvent);
    });

    emitPointer(harness.listeners, 'pointerdown', { pointerId: 1 });
    emitPointer(harness.listeners, 'pointermove', { pointerId: 1, clientX: 620 });
    emitPointer(harness.listeners, 'pointerup', { pointerId: 1, clientX: 620 });

    emitPointer(harness.listeners, 'pointerdown', { pointerId: 2 });
    emitPointer(harness.listeners, 'pointerdown', {
      pointerId: 3,
      pointerType: 'touch',
      clientX: 700,
    });
    emitPointer(harness.listeners, 'pointerup', { pointerId: 3, pointerType: 'touch' });
    emitPointer(harness.listeners, 'pointerup', { pointerId: 2 });

    emitPointer(harness.listeners, 'pointerdown', { pointerId: 4 });
    emitPointer(harness.listeners, 'pointercancel', { pointerId: 4 });

    const markerCaptures: number[] = [];
    const marker = {
      closest(selector: string) {
        return selector === '[data-map-travel]' ? this : null;
      },
      setPointerCapture(pointerId: number) {
        markerCaptures.push(pointerId);
      },
      hasPointerCapture() {
        return false;
      },
      releasePointerCapture() {},
    } as unknown as EventTarget;
    emitPointer(harness.listeners, 'pointerdown', {
      pointerId: 5,
      target: marker,
      composedPath: () => [marker],
    });
    emitPointer(harness.listeners, 'pointerup', {
      pointerId: 5,
      target: marker,
      composedPath: () => [marker],
    });

    expect(received).toHaveLength(0);
    expect(harness.pointerCaptures).not.toContain(5);
    expect(markerCaptures).toEqual([5]);
    harness.controller.dispose();
  });

  it('can pan from the mobile coverage Fit into the canonical unmapped strip', () => {
    const harness = createControllerHarness({ left: 0, top: 0, width: 390, height: 844 });
    const fitted = harness.controller.getViewBox();
    expect(fitted.x).toBeCloseTo(-22000, 8);

    emitPointer(harness.listeners, 'pointerdown', {
      pointerId: 8,
      clientX: 200,
      clientY: 400,
    });
    emitPointer(harness.listeners, 'pointermove', {
      pointerId: 8,
      clientX: 300,
      clientY: 400,
      buttons: 1,
    });
    emitPointer(harness.listeners, 'pointerup', {
      pointerId: 8,
      clientX: 300,
      clientY: 400,
    });

    expect(harness.controller.getViewBox().x).toBeLessThan(fitted.x);
    expect(harness.root.dataset.walkMapPanned).toBe('true');
    harness.controller.dispose();
  });

  it('moves a qualifying marker drag onto stable SVG capture and ends it from document release', () => {
    const harness = createControllerHarness();
    harness.controller.setZoom(4);
    const marker = {
      closest(selector: string) {
        return selector === '[data-map-travel]' ? this : null;
      },
      setPointerCapture() {},
      hasPointerCapture() {
        return false;
      },
      releasePointerCapture() {},
    } as unknown as EventTarget;
    const toolbar = { closest: () => null } as unknown as EventTarget;

    emitPointer(harness.listeners, 'pointerdown', {
      pointerId: 9,
      target: marker,
      composedPath: () => [marker],
    });
    emitPointer(harness.listeners, 'pointermove', {
      pointerId: 9,
      clientX: 620,
      buttons: 1,
      target: marker,
      composedPath: () => [marker],
    });
    expect(harness.pointerCaptures).toContain(9);

    emitPointer(harness.documentListeners, 'pointerup', {
      pointerId: 9,
      clientX: 620,
      target: toolbar,
      composedPath: () => [toolbar],
    });
    const releasedView = harness.controller.getViewBox();
    emitPointer(harness.listeners, 'pointermove', {
      pointerId: 9,
      clientX: 660,
      buttons: 0,
    });

    expect(harness.controller.getViewBox()).toEqual(releasedView);
    harness.controller.dispose();
  });

  it('keeps the current-position artwork CSS-pixel-sized and recenters at local zoom 4', () => {
    const harness = createControllerHarness();
    harness.controller.updatePlayer({ x: -12000, z: -4000, yaw: 0 });

    expect(walkMapUnitsPerCssPixel(OVERVIEW, LETTERBOXED_RECT)).toBe(80);
    expect(harness.playerAttributes.get('transform')).toContain(
      'translate(-12000 -4000) scale(76.032',
    );
    expect(harness.controller.getZoom()).toBeCloseTo(0.5260942760942761, 12);
    expect(harness.controller.getViewBox().width / harness.controller.getViewBox().height).toBe(2);

    harness.controller.centerOnPlayer();

    expect(harness.controller.getZoom()).toBe(4);
    expect(harness.controller.getViewBox().width / harness.controller.getViewBox().height).toBe(2);
    expect(harness.playerAttributes.get('transform')).toBe('translate(-12000 -4000) scale(10)');
    harness.controller.dispose();
  });

  it('recomputes the CSS-pixel-sized player transform when the viewport changes', () => {
    const previousResizeObserver = globalThis.ResizeObserver;
    let notifyResize: ResizeObserverCallback = () => undefined;
    class TestResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = callback;
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    globalThis.ResizeObserver = TestResizeObserver;

    try {
      const harness = createControllerHarness();
      harness.controller.updatePlayer({ x: -12000, z: -4000, yaw: 0 });
      expect(harness.playerAttributes.get('transform')).toContain('scale(76.032');

      harness.setRect({ left: 100, top: 50, width: 1000, height: 1000 });
      notifyResize([], {} as ResizeObserver);

      expect(harness.playerAttributes.get('transform')).toContain(
        'translate(-12000 -4000) scale(38.016',
      );
      harness.controller.dispose();
    } finally {
      globalThis.ResizeObserver = previousResizeObserver;
    }
  });

  it('defers initial Fit until visible, then preserves user center and zoom across resize', () => {
    const previousResizeObserver = globalThis.ResizeObserver;
    let notifyResize: ResizeObserverCallback = () => undefined;
    class TestResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = callback;
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    globalThis.ResizeObserver = TestResizeObserver;

    try {
      const harness = createControllerHarness({ left: 0, top: 0, width: 0, height: 0 });
      expect(harness.controller.getViewBox()).toEqual(OVERVIEW);

      harness.setRect({ left: 0, top: 0, width: 390, height: 844 });
      notifyResize([], {} as ResizeObserver);
      const fitted = harness.controller.getViewBox();
      expect(fitted.width / fitted.height).toBeCloseTo(390 / 844, 12);
      expect(fitted.x).toBeCloseTo(-22000, 8);

      harness.controller.setZoom(2);
      const userView = harness.controller.getViewBox();
      const userCenter = {
        x: userView.x + userView.width / 2,
        y: userView.y + userView.height / 2,
      };
      harness.setRect({ left: 0, top: 0, width: 1440, height: 960 });
      notifyResize([], {} as ResizeObserver);
      const resized = harness.controller.getViewBox();
      expect(harness.controller.getZoom()).toBeCloseTo(2, 12);
      expect(resized.width / resized.height).toBeCloseTo(1440 / 960, 12);
      expect(resized.x + resized.width / 2).toBeCloseTo(userCenter.x, 8);
      expect(resized.y + resized.height / 2).toBeCloseTo(userCenter.y, 8);

      harness.controller.resetView();
      expect(harness.controller.getViewBox().width).toBeCloseTo(57024, 8);
      harness.controller.dispose();
    } finally {
      globalThis.ResizeObserver = previousResizeObserver;
    }
  });

  it('flips the player label left when its rendered position approaches the right edge', () => {
    expect(
      walkMapPlayerHorizontalEdge(
        { x: 7000, z: 0 },
        { x: -32000, y: -10000, width: 40000, height: 20000 },
        { left: 0, top: 0, width: 1000, height: 500 },
      ),
    ).toBe('right');
    expect(
      walkMapPlayerHorizontalEdge(
        { x: 0, z: 0 },
        { x: -32000, y: -10000, width: 40000, height: 20000 },
        { left: 0, top: 0, width: 1000, height: 500 },
      ),
    ).toBe('none');

    const harness = createControllerHarness({ left: 0, top: 0, width: 1000, height: 500 });
    harness.controller.centerOnPlayer();
    harness.controller.updatePlayer({ x: 7000, z: -3008, yaw: 0 });
    expect(harness.root.dataset.atlasPlayerEdge).toMatch(/right|none/);
    harness.controller.dispose();
  });
});
