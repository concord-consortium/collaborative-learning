import { NormalizedAttribute, NormalizedVariable } from "./ai-summarizer-types";

export function heading(level: number, headingText: string): string {
  if (!level) {
    return "";
  }
  return "#".repeat(level) + ` ${headingText}\n\n`;
}

export function pluralize(length: number, singular: string, plural: string): string {
  return length === 1 ? singular : plural;
}

export function generateMarkdownTable(headers: string[], rows: string[][]): string {
  if (headers.length === 0) {
    return "";
  }

  // A newline ends the row, so an unescaped one splits a cell in two and every column after it is
  // misaligned — the same damage an unescaped pipe does, and just as easy to arrive from a value a
  // student typed. Escaped rather than stripped so the reader can still tell the text was
  // multi-line.
  const escapeCell = (stringOrNumber: string | number) =>
    String(stringOrNumber).replace(/\|/g, "\\|").replace(/\r\n?|\n/g, "\\n");
  const headerRow = `| ${headers.map(escapeCell).join(" | ")} |`;
  const separatorRow = `| ${headers.map(() => "---").join(" | ")} |`;

  const dataRows = rows.map(row => {
    const paddedRow = [...row];
    while (paddedRow.length < headers.length) {
      paddedRow.push("");
    }
    return `| ${paddedRow.map(escapeCell).join(" | ")} |`;
  });

  return [headerRow, separatorRow, ...dataRows].join("\n");
}

const variableHeaders = ["id", "Name", "Display Name", "Description", "Expression", "Value", "Unit"];
export function generateVariablesMarkdownTable(variables: NormalizedVariable[]) {
  return generateMarkdownTable(variableHeaders, variables.map(variable => [
    variable.id || "",
    variable.name || "",
    variable.displayName || "",
    variable.description || "",
    variable.expression || "",
    variable.value !== undefined ? `${variable.value}` : "",
    variable.unit || ""
  ]));
}

const attributeHeaders = ["id", "Name", "Formula"];
export function generateAttributesMarkdownTable(attributes: NormalizedAttribute[]) {
  return generateMarkdownTable(attributeHeaders, attributes.map(attr => [
    attr.id || "",
    attr.name || "",
    attr.formula || ""
  ]));
}
