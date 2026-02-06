/**
 * Shared focus management utilities.
 * Extracted to avoid circular dependencies between hot-keys.ts and focus hooks.
 */

/**
 * CSS selector for standard focusable elements.
 * Used by roving tabindex and focus trap implementations.
 */
export const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

/**
 * Determines if an element is an editable context where arrow keys
 * should control cursor/selection rather than navigation.
 *
 * PRINCIPLE: When in doubt, don't intercept. It's better to have tile
 * navigation fail (user can still Tab) than to break text editing.
 */
export function isEditableElement(el: HTMLElement): boolean {
  const tagName = el.tagName.toLowerCase();

  // Standard form elements
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }

  // ContentEditable
  if (el.isContentEditable) return true;
  if (el.closest('[contenteditable="true"]')) return true;

  // Rich text editors (CodeMirror, Monaco, Slate, ProseMirror, etc.)
  if (el.closest('.cm-editor, .monaco-editor, .slate-editor, .ProseMirror')) {
    return true;
  }

  // Iframes may contain editors
  if (el.closest('iframe')) return true;

  // ARIA roles that handle their own arrow keys
  const role = el.getAttribute('role');
  if (role && ['textbox', 'combobox', 'searchbox', 'spinbutton', 'slider'].includes(role)) {
    return true;
  }

  return false;
}

/**
 * Determines if arrow keys should be intercepted for navigation.
 * Returns false if the event should be handled by the browser/element.
 */
export function shouldInterceptArrows(event: KeyboardEvent): boolean {
  // Never intercept modified arrow keys (Ctrl+Arrow for word nav, Shift+Arrow for selection, etc.)
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
    return false;
  }

  const target = event.target as HTMLElement;
  if (!target) return false;

  // Never intercept in editable contexts
  if (isEditableElement(target)) return false;

  // Only intercept when focus is inside a composite widget
  return target.closest('[role="grid"], [role="tablist"], .tile-canvas') !== null;
}
