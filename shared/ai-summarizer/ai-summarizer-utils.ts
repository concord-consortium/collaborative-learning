export function heading(level: number, headingText: string): string {
  if (!level) {
    return "";
  }
  return "#".repeat(level) + ` ${headingText}\n\n`;
}

export function pluralize(length: number, singular: string, plural: string): string {
  return length === 1 ? singular : plural;
}
