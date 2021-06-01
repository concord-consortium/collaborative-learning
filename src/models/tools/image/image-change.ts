export interface ImageToolChange {
  operation: "update";
  url: string;
  filename?: string
}

export function createChange(url: string, filename?: string) {
  return JSON.stringify({ operation: "update", url, filename });
}
