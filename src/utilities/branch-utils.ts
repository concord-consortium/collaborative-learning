// stripPTNumberFromBranch
// Returns the given branch without a PT number at its beginning or end.
export function stripPTNumberFromBranch(branch: string) {
  const prefixStripMatch = branch.match(/^#?[0-9]{8,}-(.+)$/);
  const suffixStripMatch = branch.match(/^(.+)-#?[0-9]{8,}$/);
  if (prefixStripMatch) {
    return prefixStripMatch[1];
  } else if (suffixStripMatch) {
    return suffixStripMatch[1];
  }
  return branch;
}
