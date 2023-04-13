export function defaultTitle(titleBase: string, titleNumber: number) {
  return `${titleBase} ${titleNumber}`;
}

export function titleMatchesDefault(title?: string, titleBase?: string) {
  return title?.match(new RegExp(`${titleBase} (\\d+)`));
}
