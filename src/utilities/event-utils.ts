export function hasSelectionModifier(e: MouseEvent | KeyboardEvent | React.MouseEvent) {
  return e.ctrlKey || e.metaKey || e.shiftKey;
}

export function hasContiguousModifier(e: MouseEvent | KeyboardEvent | React.MouseEvent) {
  return e.shiftKey;
}

export function hasDiscontiguousModifier(e: MouseEvent | KeyboardEvent | React.MouseEvent) {
  return e.ctrlKey || e.metaKey;
}
