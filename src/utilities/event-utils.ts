// create a global keylistener so that we know what modifier keys are in use between key events
let selectionModiferKeyDown = false;
const updateModifierKeys = (e: KeyboardEvent) => selectionModiferKeyDown = hasSelectionModifier(e);
window.addEventListener("keydown", updateModifierKeys);
window.addEventListener("keyup", updateModifierKeys);

export function isSelectionModifierKeyDown() {
  return selectionModiferKeyDown;
}

export function hasSelectionModifier(e: MouseEvent | KeyboardEvent | React.MouseEvent) {
  return e.ctrlKey || e.metaKey || e.shiftKey;
}

export function hasContiguousModifier(e: MouseEvent | KeyboardEvent | React.MouseEvent) {
  return e.shiftKey;
}

export function hasDiscontiguousModifier(e: MouseEvent | KeyboardEvent | React.MouseEvent) {
  return e.ctrlKey || e.metaKey;
}
