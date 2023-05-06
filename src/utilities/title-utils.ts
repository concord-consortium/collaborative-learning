export function defaultTitle(titleBase: string, titleNumber: number) {
  const addParens = titleBase === "Eq.";
  return addParens ? `(${titleBase} ${titleNumber})` : `${titleBase} ${titleNumber}`;
}

export function titleMatchesDefault(title?: string, titleBase?: string) {
  return title?.match(new RegExp(`${titleBase} (\\d+)`));
}
