import { describe, expect, it } from 'vitest';

import {
  GTADB_ATTRIBUTION,
  GTADB_LICENSE_URL,
  GTADB_LICENSE,
  GTADB_PREFERRED_SOURCE,
  GTADB_PRESENTATION_NOTICE,
  GTADB_REVISION,
  GTADB_SOURCE,
} from '@features/street-leonida/gtadb';
import {
  createWalkMapController,
  describeWalkMapPose,
  dispatchWalkMapTravel,
  getGtadbLayerToggleLabel,
  getGtadbSearchResultPresentation,
  GTADB_MAP_ASSET_URL,
  initializeWalkMap,
  loadGtadbLandmarkLayer,
  renderCompleteLeonidaMap,
  renderGtadbLandmarkLayer,
  searchGtadbLandmarks,
  type GtadbMapSnapshot,
  type WalkMapElements,
} from '@features/street-leonida/walk-map';
import type { GtadbLandmark } from '@features/street-leonida/gtadb';

function landmark(
  id: string,
  inGameAddress: string,
  inGameCoordinates: readonly [number, number] | null,
  confidence: 'SUPPORTED' | 'UNKNOWN',
  overrides: Partial<GtadbLandmark> = {},
): GtadbLandmark {
  return {
    id,
    inGameAddress,
    inGameCoordinates,
    inGamePhotoSize: null,
    realWorldAddress: '',
    realWorldCoordinates: null,
    realWorldPhotoSize: null,
    tags: [],
    color: '',
    editedAt: [0, 0, 0],
    confidence,
    evidence: {
      name: confidence === 'UNKNOWN' ? 'UNKNOWN' : 'KNOWN',
      placement: inGameCoordinates === null ? 'UNPOSITIONED' : 'APPROXIMATE',
      tagSignals: { levelTags: [], unconfirmed: false, demolished: false },
    },
    ...overrides,
  };
}

function snapshot(landmarks: readonly GtadbLandmark[]): GtadbMapSnapshot {
  const positionedCount = landmarks.filter(({ inGameCoordinates }) => inGameCoordinates).length;
  return {
    source: {
      repository: GTADB_SOURCE,
      revision: GTADB_REVISION,
      path: 'map/data/6/landmarks.json',
      rawUrl: `https://raw.githubusercontent.com/rolux/gtadb.org/${GTADB_REVISION}/map/data/6/landmarks.json`,
      license: GTADB_LICENSE,
      preferredSource: GTADB_PREFERRED_SOURCE,
      licenseUrl: GTADB_LICENSE_URL,
      sha256: 'dd70b15592ee1ef6c3bbd0ccfea0fe8eef3cb033284f89670be419172e26ab65',
      presentation: GTADB_PRESENTATION_NOTICE,
      attribution: GTADB_ATTRIBUTION,
    },
    counts: {
      recordCount: landmarks.length,
      positionedCount,
      unpositionedCount: landmarks.length - positionedCount,
      knownNameCount: landmarks.filter(({ evidence }) => evidence.name === 'KNOWN').length,
      unknownNameCount: landmarks.filter(({ evidence }) => evidence.name === 'UNKNOWN').length,
    },
    landmarks,
  };
}

function createLayerHarness(): {
  layer: SVGGraphicsElement;
  attributes: Map<string, string>;
} {
  const attributes = new Map<string, string>();
  const layer = {
    innerHTML: '',
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
  } as unknown as SVGGraphicsElement;
  return { layer, attributes };
}

function createSvgHarness(): {
  svg: SVGSVGElement;
  attributes: Map<string, string>;
} {
  const attributes = new Map<string, string>();
  const svg = {
    innerHTML: '',
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    getAttribute(name: string) {
      return attributes.get(name) ?? null;
    },
  } as unknown as SVGSVGElement;
  return { svg, attributes };
}

function createReinitializableMapHarness(): {
  readonly root: HTMLElement;
  readonly svg: SVGSVGElement;
  readonly caveat: { textContent: string };
} {
  const svgAttributes = new Map<string, string>([
    ['viewBox', '-32000 -24000 40000 40000'],
    ['data-walk-map-coordinate-system', 'gtadb-derived-xz'],
  ]);
  const makeInteractiveLayer = () => {
    const attributes = new Map<string, string>();
    return {
      setAttribute(name: string, value: string) {
        attributes.set(name, value);
      },
      removeAttribute(name: string) {
        attributes.delete(name);
      },
      querySelectorAll() {
        return [];
      },
    };
  };
  const gtadbLayer = {
    ...makeInteractiveLayer(),
    innerHTML: '',
  };
  const supportedLayer = makeInteractiveLayer();
  const uncertainLayer = makeInteractiveLayer();
  const player = makeInteractiveLayer();
  const caveat = { textContent: 'Linked GTADB / Map GTA attribution remains intact' };
  const harness: { dialog?: HTMLElement } = {};
  const svg = Object.assign(new EventTarget(), {
    namespaceURI: 'http://www.w3.org/2000/svg',
    tagName: 'svg',
    style: { touchAction: '' },
    getAttribute(name: string) {
      return svgAttributes.get(name) ?? null;
    },
    setAttribute(name: string, value: string) {
      svgAttributes.set(name, value);
    },
    hasAttribute(name: string) {
      return svgAttributes.has(name);
    },
    removeAttribute(name: string) {
      svgAttributes.delete(name);
    },
    querySelector(selector: string) {
      if (selector === '[data-walk-map-world]') return {};
      if (selector === '[data-walk-map-player]') return player;
      if (selector === '[data-walk-map-gtadb-locations]') return gtadbLayer;
      if (selector === '[data-walk-map-gtadb-supported]') return supportedLayer;
      if (selector === '[data-walk-map-gtadb-uncertain]') return uncertainLayer;
      return null;
    },
    querySelectorAll() {
      return [];
    },
    closest(selector: string) {
      return selector === '[data-walk-map]' ? (harness.dialog ?? null) : null;
    },
  }) as unknown as SVGSVGElement;
  const dialog = Object.assign(new EventTarget(), {
    dataset: {} as DOMStringMap,
    querySelector(selector: string) {
      if (selector === '[data-walk-map-svg], .street-walk-map__drawing svg') return svg;
      if (selector === '[data-walk-map-caveat]') return caveat;
      return null;
    },
    querySelectorAll() {
      return [];
    },
    closest() {
      return null;
    },
  }) as unknown as HTMLElement;
  harness.dialog = dialog;
  return { root: dialog, svg, caveat };
}

const representativeCatalogue = snapshot([
  landmark('L32', 'Hotel Dixon, Shore Dr, Vice Beach', [1973.5, 737], 'SUPPORTED', {
    tags: ['hotel'],
    color: '887524',
  }),
  landmark(
    'L399',
    'Allied Crystal Sugar Mill, Ambrosia',
    [-3016.5107043822245, 3346.662355484881],
    'SUPPORTED',
    { tags: ['industrial'], color: '6d1e79' },
  ),
  landmark('L1', '?, Vice Beach', [1409.40126306379, 2803.2135475894142], 'UNKNOWN', {
    realWorldAddress: 'The Ritz-Carlton Bal Harbour, Miami Beach',
    tags: ['hotel'],
    color: '166624',
  }),
  landmark('L91', '?, Vice Beach', null, 'UNKNOWN', {
    realWorldAddress: 'Mount Sinai Comprehensive Cancer Center, Miami Beach',
    tags: ['public'],
  }),
]);

const fragileCatalogue = snapshot([
  landmark('L900', 'Clean named entry, Leonida', [1, 1], 'SUPPORTED'),
  landmark('L162', 'Water Tower, Waning Sands', [10, 20], 'SUPPORTED', {
    tags: ['may-not-exist', 'unconfirmed'],
  }),
  landmark('L609', 'Named alias spelling, Leonida', [11, 21], 'SUPPORTED', {
    tags: ['maynot exist'],
  }),
  landmark('L1503', 'Cancelled proposal, Leonida', [12, 22], 'SUPPORTED', {
    tags: ['cancelled'],
  }),
  landmark('L456', 'Vice City Sign, Vice City International Airport', [13, 23], 'SUPPORTED', {
    tags: ['fictional'],
  }),
  landmark('L435', 'Duplicate named entry, Vice Beach', [14, 24], 'SUPPORTED', {
    tags: ['duplicate-of-1142'],
  }),
  landmark('L172', 'Jack of Hearts, Crosstown, Vice City', [15, 25], 'SUPPORTED', {
    tags: ['demolished'],
  }),
  landmark('L130', 'Unconfirmed named entry, Vice City', [16, 26], 'SUPPORTED', {
    tags: ['uncomfirmed'],
  }),
  landmark('L1', '?, Vice Beach', [17, 27], 'UNKNOWN'),
]);

describe('Street Leonida GTADB map layer', () => {
  it('keeps layer-toggle copy scoped to source uncertainty after interaction', () => {
    expect(getGtadbLayerToggleLabel('supported', true)).toBe(
      'Hide GTADB entries without uncertainty signals',
    );
    expect(getGtadbLayerToggleLabel('supported', false)).toBe(
      'Show GTADB entries without uncertainty signals',
    );
    expect(getGtadbLayerToggleLabel('uncertain', true)).toBe('Hide uncertain GTADB entries');
    expect(getGtadbLayerToggleLabel('uncertain', false)).toBe('Show uncertain GTADB entries');
  });

  it('preserves source orientation through the deterministic transform while marking placement approximate', () => {
    const { layer, attributes } = createLayerHarness();

    const result = renderGtadbLandmarkLayer(layer, representativeCatalogue);

    expect(result).toEqual({
      catalogueCount: 4,
      renderedCount: 3,
      supportedRenderedCount: 2,
      uncertainRenderedCount: 1,
      unpositionedCount: 1,
    });
    expect(layer.innerHTML).toContain(
      'data-gtadb-id="L32" data-gtadb-confidence="SUPPORTED" data-gtadb-name="KNOWN" data-gtadb-uncertainty="none" data-gtadb-transform="deterministic-pixel-aligned" data-gtadb-placement="APPROXIMATE" transform="translate(3947 -1474)"',
    );
    expect(layer.innerHTML).toContain('data-map-travel-x="3947" data-map-travel-z="-1474"');
    expect(layer.innerHTML).toContain(
      'data-gtadb-id="L399" data-gtadb-confidence="SUPPORTED" data-gtadb-name="KNOWN" data-gtadb-uncertainty="none" data-gtadb-transform="deterministic-pixel-aligned" data-gtadb-placement="APPROXIMATE" transform="translate(-6033.021408764449 -6693.324710969762)"',
    );
    expect(layer.innerHTML).toContain(
      'data-walk-map-evidence-density data-evidence="APPROXIMATE" data-density-source-count="2"',
    );
    expect(layer.innerHTML).toContain(
      'aria-label="Density of transformed GTADB evidence points without listed uncertainty signals; not coastline geometry"',
    );
    expect(layer.innerHTML).toContain('data-density-cell');
    expect(layer.innerHTML).toContain('aria-label="GTADB entries without uncertainty signals"');
    expect(layer.innerHTML).toContain('aria-label="Uncertain GTADB entries"');
    expect(layer.innerHTML).not.toMatch(/\bexact\b/i);
    expect(attributes.get('data-gtadb-attribution')).toBe(GTADB_ATTRIBUTION);
    expect(attributes.get('data-gtadb-caveat')).toBe(GTADB_PRESENTATION_NOTICE);
    expect(layer.innerHTML).toContain(
      'data-map-travel-x="-6033.021408764449" data-map-travel-z="-6693.324710969762"',
    );
    expect(Math.hypot(-6033.021408764449 - 3947, -6693.324710969762 + 1474)).toBeCloseTo(
      11262.423263131977,
      10,
    );
  });

  it('keeps uncertain markers in a separate hidden and non-focusable group by default', () => {
    const { layer, attributes } = createLayerHarness();

    renderGtadbLandmarkLayer(layer, representativeCatalogue);

    expect(layer.innerHTML).toContain('data-walk-map-gtadb-supported data-layer-visible="true"');
    expect(layer.innerHTML).toContain(
      'data-walk-map-gtadb-uncertain data-layer-visible="false" display="none" hidden aria-hidden="true" pointer-events="none"',
    );
    expect(layer.innerHTML).toMatch(/data-gtadb-id="L32"[^>]+role="button" tabindex="0"/);
    expect(layer.innerHTML).toMatch(/data-gtadb-id="L399"[^>]+role="button" tabindex="-1"/);
    expect(layer.innerHTML).toMatch(/data-gtadb-id="L1"[^>]+role="button" tabindex="-1"/);
    expect(layer.innerHTML.match(/data-gtadb-id="[^"]+"[^>]+tabindex="0"/g)).toHaveLength(1);
    expect(layer.innerHTML).not.toContain('data-gtadb-id="L91"');
    expect(layer.innerHTML).not.toContain('<text');
    expect(attributes.get('data-gtadb-supported-rendered-count')).toBe('2');
    expect(attributes.get('data-gtadb-uncertain-rendered-count')).toBe('1');
    expect(attributes.get('data-gtadb-unpositioned-count')).toBe('1');
  });

  it('keeps every fragile source-tag marker out of the default layer and density', () => {
    const { layer, attributes } = createLayerHarness();

    const result = renderGtadbLandmarkLayer(layer, fragileCatalogue);
    const uncertainLayerStart = layer.innerHTML.indexOf('<g data-walk-map-gtadb-uncertain');
    const defaultLayerMarkup = layer.innerHTML.slice(0, uncertainLayerStart);
    const uncertainLayerMarkup = layer.innerHTML.slice(uncertainLayerStart);

    expect(result).toEqual({
      catalogueCount: 9,
      renderedCount: 9,
      supportedRenderedCount: 1,
      uncertainRenderedCount: 8,
      unpositionedCount: 0,
    });
    expect(defaultLayerMarkup).toContain('data-gtadb-id="L900"');
    for (const id of ['L162', 'L609', 'L1503', 'L456', 'L435', 'L172', 'L130', 'L1']) {
      expect(defaultLayerMarkup).not.toContain(`data-gtadb-id="${id}"`);
      expect(uncertainLayerMarkup).toContain(`data-gtadb-id="${id}"`);
    }
    expect(uncertainLayerMarkup).toMatch(
      /data-gtadb-id="L162" data-gtadb-confidence="SUPPORTED" data-gtadb-name="KNOWN" data-gtadb-uncertainty="unconfirmed may-not-exist"[^>]+data-map-travel-x="20" data-map-travel-z="-40"[^>]+aria-label="Travel to Water Tower, Waning Sands, uncertain GTADB entry: unconfirmed; may not exist, community reconstruction, approximate placement"/,
    );
    expect(layer.innerHTML).toContain(
      'data-walk-map-evidence-density data-evidence="APPROXIMATE" data-density-source-count="1"',
    );
    expect(attributes.get('data-gtadb-supported-rendered-count')).toBe('1');
    expect(attributes.get('data-gtadb-uncertain-rendered-count')).toBe('8');
  });

  it('labels a focusable marker as approximate community reconstruction evidence', () => {
    const { layer } = createLayerHarness();

    renderGtadbLandmarkLayer(layer, representativeCatalogue);

    expect(layer.innerHTML).toMatch(
      /data-gtadb-id="L32"[^>]+aria-label="Travel to Hotel Dixon, Shore Dr, Vice Beach, community reconstruction, approximate placement"/,
    );
  });

  it('searches the complete catalogue, including unpositioned and explicitly uncertain records', () => {
    expect(searchGtadbLandmarks(representativeCatalogue.landmarks, 'L91')).toMatchObject({
      totalMatches: 1,
      items: [{ id: 'L91', inGameCoordinates: null, confidence: 'UNKNOWN' }],
    });
    expect(searchGtadbLandmarks(representativeCatalogue.landmarks, 'INDUSTRIAL')).toMatchObject({
      totalMatches: 1,
      items: [{ id: 'L399' }],
    });
    expect(searchGtadbLandmarks(representativeCatalogue.landmarks, 'unknown')).toMatchObject({
      totalMatches: 2,
      items: [{ id: 'L1' }, { id: 'L91' }],
    });
    expect(searchGtadbLandmarks(representativeCatalogue.landmarks, '', 2)).toMatchObject({
      totalMatches: 4,
      items: [{ id: 'L32' }, { id: 'L399' }],
    });
    expect(searchGtadbLandmarks(representativeCatalogue.landmarks, 'mount sinai')).toMatchObject({
      totalMatches: 0,
      items: [],
    });
    expect(searchGtadbLandmarks(fragileCatalogue.landmarks, 'uncertain')).toMatchObject({
      totalMatches: 8,
    });
    expect(searchGtadbLandmarks(fragileCatalogue.landmarks, '', 20)).toMatchObject({
      totalMatches: 9,
    });
  });

  it('provides an explicit uncertainty badge and accessible search-result label', () => {
    expect(getGtadbSearchResultPresentation(fragileCatalogue.landmarks[1]!, true)).toEqual({
      uncertainty: 'unconfirmed may-not-exist',
      status: 'UNCERTAIN · unconfirmed; may not exist · approximate placement',
      ariaLabel:
        'Water Tower, Waning Sands (L162) · UNCERTAIN · unconfirmed; may not exist · approximate placement',
    });
    expect(getGtadbSearchResultPresentation(fragileCatalogue.landmarks[0]!, true)).toEqual({
      uncertainty: 'none',
      status: 'DEFAULT LAYER · no listed uncertainty signals · approximate placement',
      ariaLabel:
        'Clean named entry, Leonida (L900) · DEFAULT LAYER · no listed uncertainty signals · approximate placement',
    });
  });

  it('escapes catalogue strings and never promotes analogue coordinates into map placement', () => {
    const { layer } = createLayerHarness();
    const dangerous = snapshot([
      landmark('L77', 'Pier <script>& "club"', [1, 2], 'SUPPORTED', {
        realWorldCoordinates: [88, 99],
        tags: ['nightlife <unsafe>'],
      }),
    ]);

    renderGtadbLandmarkLayer(layer, dangerous);

    expect(layer.innerHTML).toContain('transform="translate(2 -4)"');
    expect(layer.innerHTML).toContain('Pier &lt;script&gt;&amp; &quot;club&quot;');
    expect(layer.innerHTML).not.toContain('translate(88 99)');
    expect(layer.innerHTML).not.toContain('<script>');
  });

  it('renders transformed community cartography without claiming an authoritative raster', () => {
    const { svg, attributes } = createSvgHarness();

    renderCompleteLeonidaMap(svg);

    expect(attributes.get('viewBox')).toBe('-32000 -24000 40000 40000');
    expect(attributes.get('data-walk-map-coordinate-system')).toBe('gtadb-derived-xz');
    expect(attributes.get('data-walk-map-transform')).toBe('deterministic-pixel-aligned');
    expect(attributes.get('data-walk-map-placement')).toBe('APPROXIMATE');
    expect(attributes.get('data-walk-map-scale')).toBe('approximate-visualization');
    expect(attributes.get('data-walk-map-attribution')).toBe(GTADB_ATTRIBUTION);
    expect(attributes.get('data-walk-map-attribution')).toContain(GTADB_PREFERRED_SOURCE);
    expect(attributes.get('data-walk-map-attribution')).toContain(GTADB_LICENSE_URL);
    expect(attributes.get('data-walk-map-attribution')).toContain(GTADB_REVISION);
    expect(attributes.get('data-walk-map-cartography')).toBe('source-derived-community-atlas');
    expect(attributes.get('role')).toBe('group');
    expect(attributes.get('aria-label')).toContain('community-estimated placement');
    expect(attributes.get('aria-label')).toContain('approximate visualization scale');
    expect([...attributes.values()].join(' ')).not.toMatch(/\b(?:exact|metres?)\b/i);
    expect(svg.innerHTML).toContain('data-walk-map-original-cartography');
    expect(svg.innerHTML).toContain('data-evidence="APPROXIMATE"');
    expect(svg.innerHTML).toContain('data-walk-map-region="vice-city"');
    expect(svg.innerHTML).toContain('data-walk-map-region="mount-kalaga-national-park"');
    expect(svg.innerHTML).not.toContain('data-walk-map-corridors');
    expect(svg.innerHTML).toContain('data-atlas-basemap');
    expect(svg.innerHTML).toContain('x="-32000" y="-24000" width="40000" height="40000"');
    expect(svg.innerHTML).toContain('data-walk-map-gtadb-locations');
    expect(svg.innerHTML).toContain('href="/assets/gta6-leonida-atlas/basemap.svg"');
    expect(svg.innerHTML).not.toContain('gtadb-yanis-16-z5-overview.webp');
    expect(svg.innerHTML).not.toContain('State of Leonida');
    expect(svg.innerHTML).not.toContain('APPROXIMATE REGIONAL FIELD');
    expect(svg.innerHTML).toContain('coordinate transform is unchanged');
    expect(svg.innerHTML).toContain('Unmapped source areas are UNKNOWN');
    expect(svg.innerHTML).not.toMatch(/\b(?:exact|metres?)\b/i);
  });

  it('describes a live pose in both world and inverse GTADB coordinates without claiming an official location', () => {
    expect(describeWalkMapPose({ x: 3947, z: -1474, yaw: 0 })).toEqual({
      region: 'Vice City',
      heading: 'N · 000°',
      world: 'VISUAL X +3,947 · Z −1,474',
      gtadb: 'GTADB +1,973.5 · +737.0',
      evidence:
        'NEAREST REGION: APPROXIMATE · TRANSFORM: DETERMINISTIC, PIXEL-ALIGNED · PLACEMENT: COMMUNITY ESTIMATE · SCALE: APPROXIMATE VISUALIZATION',
    });

    expect(describeWalkMapPose({ x: -6033.0214, z: -6693.3247, yaw: Math.PI / 2 })).toMatchObject({
      region: 'Ambrosia',
      heading: 'W · 270°',
      gtadb: 'GTADB −3,016.5 · +3,346.7',
    });
  });

  it('dispatches deterministic transformed travel coordinates with bubbling enabled', () => {
    const mapDialog = new EventTarget() as HTMLDialogElement;
    const detail = {
      x: -6033.021408764449,
      z: -6693.324710969762,
      label: 'Allied Crystal Sugar Mill, Ambrosia',
      id: 'L399',
      source: 'gtadb' as const,
    };
    const received: CustomEvent[] = [];
    mapDialog.addEventListener('street-leonida:map-travel', (event) => {
      received.push(event as CustomEvent);
    });

    dispatchWalkMapTravel(mapDialog, detail);

    expect(received).toHaveLength(1);
    expect(received[0]?.detail).toEqual(detail);
    expect(received[0]?.bubbles).toBe(true);
  });

  it('loads the pinned normalized snapshot and exposes provenance plus declared counts', async () => {
    const layerAttributes = new Map<string, string>();
    const svgAttributes = new Map<string, string>();
    const layer = {
      innerHTML: '',
      setAttribute(name: string, value: string) {
        layerAttributes.set(name, value);
      },
    } as unknown as SVGGraphicsElement;
    const svg = {
      setAttribute(name: string, value: string) {
        svgAttributes.set(name, value);
      },
      querySelector(selector: string) {
        return selector === '[data-walk-map-gtadb-locations]' ? layer : null;
      },
      closest() {
        return null;
      },
    } as unknown as SVGSVGElement;
    let requestedUrl = '';
    const fetchSnapshot = (async (input: string | URL | Request) => {
      requestedUrl = String(input);
      return { ok: true, status: 200, json: async () => representativeCatalogue } as Response;
    }) as typeof fetch;

    const loading = loadGtadbLandmarkLayer(svg, fetchSnapshot);

    expect(requestedUrl).toBe(GTADB_MAP_ASSET_URL);
    expect(layerAttributes.get('data-gtadb-state')).toBe('loading');
    await expect(loading).resolves.toMatchObject({ catalogueCount: 4, renderedCount: 3 });
    expect(layerAttributes.get('data-gtadb-state')).toBe('ready');
    expect(svgAttributes.get('data-walk-map-gtadb-count')).toBe('4');
    expect(svgAttributes.get('data-walk-map-gtadb-rendered-count')).toBe('3');
    expect(svgAttributes.get('data-walk-map-gtadb-unpositioned-count')).toBe('1');
    expect(svgAttributes.get('data-walk-map-gtadb-source')).toBe(GTADB_SOURCE);
    expect(svgAttributes.get('data-walk-map-gtadb-revision')).toBe(GTADB_REVISION);
    expect(svgAttributes.get('data-walk-map-gtadb-license')).toBe(GTADB_LICENSE);
  });

  it('does not cache a failed asynchronous load, so the same map can retry', async () => {
    const layerAttributes = new Map<string, string>();
    const layer = {
      innerHTML: '',
      setAttribute(name: string, value: string) {
        layerAttributes.set(name, value);
      },
    } as unknown as SVGGraphicsElement;
    const svg = {
      setAttribute() {},
      querySelector(selector: string) {
        return selector === '[data-walk-map-gtadb-locations]' ? layer : null;
      },
      closest() {
        return null;
      },
    } as unknown as SVGSVGElement;
    let attempts = 0;
    const fetchSnapshot = (async () => {
      attempts += 1;
      return attempts === 1
        ? ({ ok: false, status: 503, json: async () => null } as Response)
        : ({ ok: true, status: 200, json: async () => representativeCatalogue } as Response);
    }) as typeof fetch;

    await expect(loadGtadbLandmarkLayer(svg, fetchSnapshot)).resolves.toMatchObject({
      catalogueCount: 0,
    });
    expect(layerAttributes.get('data-gtadb-state')).toBe('error');
    await expect(loadGtadbLandmarkLayer(svg, fetchSnapshot)).resolves.toMatchObject({
      catalogueCount: 4,
    });
    expect(attempts).toBe(2);
    expect(layerAttributes.get('data-gtadb-state')).toBe('ready');
  });

  it('resynchronizes a new navigation state from a successful cached load', async () => {
    const { root, svg, caveat } = createReinitializableMapHarness();
    let requests = 0;
    const fetchSnapshot = (async () => {
      requests += 1;
      return { ok: true, status: 200, json: async () => representativeCatalogue } as Response;
    }) as typeof fetch;

    await loadGtadbLandmarkLayer(svg, fetchSnapshot);
    expect(caveat.textContent).toBe('Linked GTADB / Map GTA attribution remains intact');

    const controller = initializeWalkMap(root, { renderMap: 'if-missing' });
    await Promise.resolve();

    expect(controller).not.toBeNull();
    expect(requests).toBe(1);
    expect(caveat.textContent).toBe('Linked GTADB / Map GTA attribution remains intact');
    controller?.dispose();
  });

  it('defers the GTADB catalogue until the map explicitly requests it', async () => {
    const { root } = createReinitializableMapHarness();
    const previousFetch = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = (async () => {
      requests += 1;
      return { ok: true, status: 200, json: async () => representativeCatalogue } as Response;
    }) as typeof fetch;

    try {
      const controller = initializeWalkMap(root, {
        renderMap: 'if-missing',
        deferCatalogue: true,
      });
      await Promise.resolve();

      expect(controller).not.toBeNull();
      expect(requests).toBe(0);
      await controller?.loadCatalogue();
      expect(requests).toBe(1);
      controller?.dispose();
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it('aborts an in-flight catalogue request when the map controller is disposed', async () => {
    const { root } = createReinitializableMapHarness();
    const previousFetch = globalThis.fetch;
    const requestState: { signal?: AbortSignal } = {};
    globalThis.fetch = ((_input: string | URL | Request, init?: RequestInit) => {
      requestState.signal = init?.signal instanceof AbortSignal ? init.signal : undefined;
      return new Promise<Response>((_resolve, reject) => {
        requestState.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('The operation was aborted', 'AbortError')),
          { once: true },
        );
      });
    }) as typeof fetch;

    try {
      const controller = initializeWalkMap(root, {
        renderMap: 'if-missing',
        deferCatalogue: true,
      });
      const loading = controller?.loadCatalogue();
      await Promise.resolve();

      expect(requestState.signal?.aborted).toBe(false);
      controller?.dispose();
      expect(requestState.signal?.aborted).toBe(true);
      await expect(loading).resolves.toMatchObject({ catalogueCount: 0 });
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});

describe('Street Leonida map player projection and controller lifecycle', () => {
  it('projects player X/Z directly to map X/Y and removes every owned listener on dispose', () => {
    const attributes = new Map<string, string>([['viewBox', '-32000 -24000 40000 40000']]);
    const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
    const removed: string[] = [];
    const style = { touchAction: 'pan-x' };
    const svg = {
      style,
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
        removed.push(name);
      },
      getBoundingClientRect() {
        return { left: 0, top: 0, width: 800, height: 800 };
      },
    } as unknown as SVGSVGElement;
    const root = {
      dataset: {} as DOMStringMap,
      closest() {
        return null;
      },
    } as unknown as HTMLElement;
    const playerAttributes = new Map<string, string>();
    const headingAttributes = new Map<string, string>();
    const elements: WalkMapElements = {
      root,
      svg,
      viewport: null,
      world: null,
      player: {
        setAttribute(name: string, value: string) {
          playerAttributes.set(name, value);
        },
      } as unknown as SVGGraphicsElement,
      heading: {
        setAttribute(name: string, value: string) {
          headingAttributes.set(name, value);
        },
      } as unknown as SVGGraphicsElement,
      playerTitle: { textContent: '' } as SVGTitleElement,
      zoomIn: null,
      zoomOut: null,
      zoomReset: null,
      centerPlayer: null,
      zoomValue: null,
    };
    const controller = createWalkMapController(elements);

    controller.updatePlayer({ x: -6033.021408764449, z: -6693.324710969762, yaw: Math.PI / 2 });

    expect(playerAttributes.get('transform')).toBe(
      'translate(-6033.021408764449 -6693.324710969762) scale(47.519999999999996)',
    );
    expect(root.dataset.walkMapPlayerX).toBe('-6033.021408764449');
    expect(root.dataset.walkMapPlayerY).toBe('-6693.324710969762');
    expect(headingAttributes.get('transform')).toBe('rotate(-90)');

    controller.dispose();

    expect(style.touchAction).toBe('pan-x');
    expect(attributes.has('tabindex')).toBe(false);
    expect(removed).toEqual([
      'wheel',
      'dblclick',
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
      'lostpointercapture',
      'click',
      'keydown',
    ]);
    expect([...listeners.values()].every((registered) => registered.size === 0)).toBe(true);
  });
});
