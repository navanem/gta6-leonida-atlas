import { describe, it, expect } from 'vitest';
import { resolveRoute } from '../../src/app/routes';
import { validAnalyticsId } from '../../src/app/analytics';
import { finishNoteSave, reconcileNoteDraft } from '../../src/features/library/note-draft';

describe('standalone routes and optional analytics', () => {
  it('preserves legacy place/viewpoint links and query project routes', () => {
    expect(resolveRoute('/gta6-leonida-atlas/app/place/vice-city', '').placeId).toBe(
      'region:vice-city',
    );
    expect(
      resolveRoute('/gta6-leonida-atlas/app/viewpoint/grassrivers-regional-entry', '').placeId,
    ).toBe('region:grassrivers');
    expect(resolveRoute('/atlas/', '?page=credits').view).toBe('project');
    expect(resolveRoute('/atlas/', '?view=3d').view).toBe('explorer');
    expect(resolveRoute('/', '?place=custom%3Aone').placeId).toBe('custom:one');
  });
  it('rejects unset, malformed or executable measurement IDs', () => {
    expect(validAnalyticsId('')).toBe(false);
    expect(validAnalyticsId(undefined)).toBe(false);
    expect(validAnalyticsId('G-EXAMPLE123')).toBe(true);
    expect(validAnalyticsId('G-EXAMPLE<script>')).toBe(false);
  });
});
describe('local note drafts and remote tab/import changes', () => {
  it('adopts newer saved text when the draft is clean', () => {
    expect(
      reconcileNoteDraft(
        { text: 'old', revision: 'v1', dirty: false, conflict: false },
        'new',
        'v2',
      ),
    ).toEqual({ text: 'new', revision: 'v2', dirty: false, conflict: false });
  });
  it('keeps typed work and marks a conflict instead of silently overwriting a newer note', () => {
    expect(
      reconcileNoteDraft(
        { text: 'my work', revision: 'v1', dirty: true, conflict: false },
        'their work',
        'v2',
      ),
    ).toEqual({ text: 'my work', revision: 'v1', dirty: true, conflict: true });
  });
  it('never pairs another tabs saved revision with our older draft text', () => {
    const draft = { text: 'my work', revision: 'v1', dirty: true, conflict: false };
    expect(finishNoteSave(draft, draft, { text: 'their newer work', revision: 'v3' })).toEqual({
      ...draft,
      conflict: true,
    });
    expect(
      finishNoteSave({ ...draft, text: 'typing next' }, draft, { text: 'my work', revision: 'v2' }),
    ).toEqual({ text: 'typing next', revision: 'v2', dirty: true, conflict: false });
  });
});
