export interface NoteDraft {
  text: string;
  revision: string | null;
  dirty: boolean;
  conflict: boolean;
}
export function reconcileNoteDraft(
  draft: NoteDraft,
  text: string,
  revision: string | null,
): NoteDraft {
  if (draft.revision === revision) return draft;
  return draft.dirty
    ? { ...draft, conflict: true }
    : { text, revision, dirty: false, conflict: false };
}
/** A concurrent write may land between our commit and the repository reload. */
export function finishNoteSave(
  current: NoteDraft,
  captured: NoteDraft,
  persisted: { text: string; revision: string | null },
): NoteDraft {
  const savedText = captured.text.trim() ? captured.text : '';
  if (persisted.text !== savedText) return { ...current, dirty: true, conflict: true };
  return {
    text: current.text === captured.text ? savedText : current.text,
    revision: persisted.revision,
    dirty: current.text !== captured.text,
    conflict: false,
  };
}
