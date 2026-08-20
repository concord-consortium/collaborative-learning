import { Editor, Range, ReactEditor } from "@concord-consortium/slate-editor";
import { Element, Node } from "slate";

/**
 * Extended editor interface that includes blurSelection for preserving
 * selection state across blur/focus cycles.
 *
 * When the Slate editor blurs, it clears the DOM selection (on Webkit) to work
 * around a Safari bug. This can cause toolbar buttons that depend on the selection
 * to lose track of what was selected. By saving the selection on blur and restoring
 * it on focus, we preserve the user's selection across toolbar interactions.
 */
export interface EditorWithBlurSelection extends Editor {
  /** The selection that was active when the editor lost focus */
  blurSelection?: Range | null;
}

/**
 * Returns the "effective" selection for the editor - either the current selection
 * if the editor is focused, or the saved blurSelection if the editor is blurred.
 *
 * This allows toolbar buttons to access the selection that was active when the
 * user clicked on them, even though clicking the toolbar causes the editor to blur.
 */
export function getEffectiveSelection(editor: Editor): Range | null {
  const editorWithBlur = editor as EditorWithBlurSelection;

  // If the editor is focused, use the current selection
  if (ReactEditor.isFocused(editor)) {
    return editor.selection;
  }

  // If we have a saved blur selection, use that
  if (editorWithBlur.blurSelection !== undefined) {
    return editorWithBlur.blurSelection;
  }

  // Fall back to current selection (may be null or stale)
  return editor.selection;
}

/**
 * Saves the current selection to blurSelection. Call this in the onBlur handler
 * before Slate clears the DOM selection.
 */
export function saveSelectionOnBlur(editor: Editor): void {
  const editorWithBlur = editor as EditorWithBlurSelection;
  editorWithBlur.blurSelection = editor.selection ? { ...editor.selection } : null;
}

/**
 * Clears the saved blurSelection. Call this in the onFocus handler after
 * restoring the selection.
 */
export function clearBlurSelection(editor: Editor): void {
  const editorWithBlur = editor as EditorWithBlurSelection;
  editorWithBlur.blurSelection = undefined;
}

/**
 * Checks if a selection is still valid for the current document structure.
 * A selection can become invalid if the document was modified (e.g., by a
 * toolbar action) and the paths in the selection no longer exist.
 */
export function isSelectionValid(editor: Editor, selection: Range | null): boolean {
  if (!selection) return false;

  try {
    // Check if both anchor and focus paths exist in the document
    const anchorExists = Node.has(editor, selection.anchor.path);
    const focusExists = Node.has(editor, selection.focus.path);

    if (!anchorExists || !focusExists) return false;

    // Also check that the offsets are within bounds
    const anchorNode = Node.get(editor, selection.anchor.path);
    const focusNode = Node.get(editor, selection.focus.path);

    // For text nodes, check offset is within text length
    if ('text' in anchorNode && selection.anchor.offset > anchorNode.text.length) return false;
    if ('text' in focusNode && selection.focus.offset > focusNode.text.length) return false;

    return true;
  } catch {
    // If any error occurs during validation, the selection is invalid
    return false;
  }
}

/**
 * Returns selected elements using the effective selection.
 * This is equivalent to editor.selectedElements() but uses getEffectiveSelection()
 * to handle the blur case.
 */
export function getEffectiveSelectedElements(editor: Editor): any[] {
  const selection = getEffectiveSelection(editor);
  if (!selection || !isSelectionValid(editor, selection)) return [];

  return Array.from(Editor.nodes(editor, {
    at: Editor.unhangRange(editor, selection),
    match: n => !Editor.isEditor(n) && Element.isElement(n)
  }));
}

/**
 * Checks if an element type is active using the effective selection.
 * This is equivalent to editor.isElementActive() but uses getEffectiveSelection()
 * to handle the blur case.
 */
export function isEffectiveElementActive(editor: Editor, format: string): boolean {
  const selection = getEffectiveSelection(editor);
  if (!selection || !isSelectionValid(editor, selection)) return false;

  const [match] = Array.from(Editor.nodes(editor, {
    at: Editor.unhangRange(editor, selection),
    match: n => !Editor.isEditor(n) && Element.isElement(n) && (n as any).type === format
  }));

  return !!match;
}
