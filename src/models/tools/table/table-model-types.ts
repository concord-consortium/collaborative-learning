
export function isLinkableValue(value: number | string | null | undefined) {
  return value == null || Number.isNaN(value as any) || isFinite(Number(value));
}

export function canonicalizeValue(value: number | string | undefined) {
  if (value == null || value === "") return undefined;
  const num = Number(value);
  return isFinite(num) ? num : undefined;
}
