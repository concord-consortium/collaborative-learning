/**
 * Get the next indexed name based on existing names. Given base "MyBase" and existing names
 * "MyBase 1" and "MyBase 3", returns "MyBase 4" (one past the highest existing index).
 * @param existingNames names already in use (undefined entries are ignored)
 * @param baseName the name stem to index
 * @returns the next available indexed name
 */
export function getNewIndexedName(existingNames: Array<string | undefined>, baseName: string) {
  // Escape the stem: several node display names contain regex metacharacters — "Timer (on/off)"
  // turned `(on/off)` into a capture group, so match[1] was "on/off" rather than the index, every
  // parse produced NaN, and every new Timer was named "Timer (on/off) 1".
  const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matchTypeAndNum = new RegExp(`^${escapedBaseName} *(\\d+(\\.\\d+)?)$`);
  const namedNums: number[] = existingNames
    .map(name => {
      const match = name?.match(matchTypeAndNum);
      return match ? parseInt(match[1], 10) : 0;
    })
    .map(n => isNaN(n) ? 0 : Math.round(n));

  const nextNum = namedNums.length > 0 ? Math.max(...namedNums) + 1 : 1;
  return `${baseName} ${nextNum}`;
}
