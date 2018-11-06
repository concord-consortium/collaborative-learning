export function hasSelectionModifier(e: MouseEvent | React.MouseEvent) {
  return e.ctrlKey || e.metaKey || e.shiftKey;
}

export function hasContiguousModifier(e: MouseEvent | React.MouseEvent) {
  return e.shiftKey;
}

export function hasDiscontiguousModifier(e: MouseEvent | React.MouseEvent) {
  return e.ctrlKey || e.metaKey;
}
