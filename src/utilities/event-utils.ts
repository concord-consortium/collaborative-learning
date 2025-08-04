// create a global keylistener so that we know what modifier keys are in use between key events
let selectionModiferKeyDown = false;
const updateModifierKeys = (e: KeyboardEvent | MouseEvent) => selectionModiferKeyDown = hasSelectionModifier(e);
if (typeof window !== "undefined") {
  window.addEventListener("keydown", updateModifierKeys, true);
  window.addEventListener("keyup", updateModifierKeys, true);
  window.addEventListener("mousedown", updateModifierKeys, true);
  window.addEventListener("mouseup", updateModifierKeys, true);
}

export function isSelectionModifierKeyDown() {
  return selectionModiferKeyDown;
}

export function hasSelectionModifier(e: MouseEvent | TouchEvent | KeyboardEvent | React.MouseEvent | React.TouchEvent) {
  return e.ctrlKey || e.metaKey || e.shiftKey;
}

export function hasContiguousModifier(
    e: MouseEvent | TouchEvent | KeyboardEvent | React.MouseEvent | React.TouchEvent) {
  return e.shiftKey;
}

export function hasDiscontiguousModifier(
    e: MouseEvent | TouchEvent | KeyboardEvent | React.MouseEvent | React.TouchEvent) {
  return e.ctrlKey || e.metaKey;
}

export function hasCopyModifier(
    e: MouseEvent | TouchEvent | KeyboardEvent | React.MouseEvent | React.TouchEvent) {
  return e.altKey;
}
