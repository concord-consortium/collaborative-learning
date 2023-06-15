
export function isLinkableValue(value: number | string | null | undefined) {
  return true;
}

export function canonicalizeValue(value: number | string | undefined) {
  if (value == null || value === "") return undefined;
  const num = Number(value);
  return isFinite(num) ? num : undefined;
}
