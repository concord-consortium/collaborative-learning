import { NormalizedVariable } from "./ai-summarizer-types";

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

  const escapePipe = (stringOrNumber: string | number) => String(stringOrNumber).replace(/\|/g, "\\|");
  const headerRow = `| ${headers.map(escapePipe).join(" | ")} |`;
  const separatorRow = `| ${headers.map(() => "---").join(" | ")} |`;

  const dataRows = rows.map(row => {
    const paddedRow = [...row];
    while (paddedRow.length < headers.length) {
      paddedRow.push("");
    }
    return `| ${paddedRow.map(escapePipe).join(" | ")} |`;
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
    variable.value ? `${variable.value}` : "",
    variable.unit || ""
  ]));
}
