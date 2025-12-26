export function heading(level: number, headingText: string): string {
  if (!level) {
    return "";
  }
  return "#".repeat(level) + ` ${headingText}\n\n`;
}
