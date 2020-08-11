export function escapeKey(s: string): string {
  return s.replace(/[.$[\]#/]/g, "_");
}
