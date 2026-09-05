import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ExplorerView from '../../src/features/explorer/ExplorerView';
import {
  GTADB_LICENSE_URL,
  GTADB_PINNED_DATA_URL,
  GTADB_PREFERRED_SOURCE,
} from '../../src/features/street-leonida/gtadb';
import { PLACE_ENTRY_VIEWS } from '../../src/features/street-leonida/walk-geography';

// Test the rendered DOM contract consumed by the retained imperative engine. The retired
// idle preloader and astro:before-swap assertions are superseded by atlas-explorer-lifecycle.
const markup = renderToStaticMarkup(createElement(ExplorerView, { onClose: () => undefined }));

describe('Leonida optional React explorer shell', () => {
  it('renders one accessible world at its documented regional entry', () => {
    expect(markup.match(/<canvas\b/g)).toHaveLength(1);
    expect(markup).toContain('data-walk-canvas=""');
    expect(markup).toContain('aria-label="Three-dimensional community reconstruction of Leonida"');
    expect(markup).toContain('data-initial-place="vice-city"');
    const { position } = PLACE_ENTRY_VIEWS['vice-city']!;
    expect(markup).toContain(`data-player-position="${position.x},${position.z}"`);
    expect(markup).toContain('Back to atlas');
    // The wrapper owns route exit; the retained engine must not bind its old site redirect.
    expect(markup).not.toContain('data-stop-walking');
    expect(markup).not.toContain('data-walk-scene-page');
  });

  it('preserves evidence attribution, regional travel, and accessible touch controls', () => {
    expect(markup).toContain(`href="${GTADB_PREFERRED_SOURCE}"`);
    expect(markup).toContain(`href="${GTADB_LICENSE_URL}"`);
    expect(markup).toContain(`href="${GTADB_PINNED_DATA_URL}"`);
    expect(markup).toContain('Official visual identity or existence');
    expect(markup).toContain('Community-estimated placement');
    expect(markup).toContain('APPROXIMATE');
    expect(markup).toContain('UNKNOWN');
    expect(markup).toContain('data-walk-map-layer-toggle="supported"');
    expect(markup).toContain('data-walk-map-layer-toggle="uncertain"');
    expect(markup.match(/data-walk-region=/g)).toHaveLength(6);
    expect(markup).toContain('data-walk-region="mount-kalaga-national-park"');
    expect(markup).toContain('data-walk-scene-dialog=""');
    expect(markup).toContain('data-walk-scene-image=""');
    expect(markup).toContain('data-walk-scene-evidence-label=""');
    expect(markup).toContain('DOCUMENTED SOURCE EVIDENCE');
    expect(markup).toContain('data-walk-joystick=""');
    expect(markup).toContain('data-walk-look-pad=""');
    expect(markup.match(/data-walk-move-button=/g)).toHaveLength(4);
    expect(markup.match(/data-walk-look-button=/g)).toHaveLength(4);
    expect(markup).toContain('aria-label="Move forward"');
    expect(markup).toContain('aria-label="Look right"');
    expect(markup).toContain('data-walk-map-svg="" role="group"');
  });

  it('renders the visible M shortcut inside a real map-trigger button', () => {
    const triggers = [
      ...markup.matchAll(/<button\b[^>]*data-open-walk-map=""[^>]*>([\s\S]*?)<\/button>/g),
    ];
    expect(triggers).toHaveLength(1);
    expect(triggers[0]![1]).toContain('Travel map');
    expect(triggers[0]![1]).toContain('<kbd>M</kbd>');
  });
});
