export const kEventColorWords = ["blue", "orange", "red", "yellow", "magenta", "purple"] as const;

export type EventColorWord = typeof kEventColorWords[number];

export interface ColorGroup {
  default: string;
}

export const kEventColorMap: Record<EventColorWord, ColorGroup> = {
  blue:    { default: "#aad7ff" },
  orange:  { default: "#ffd097" },
  red:     { default: "#ff9494" },
  yellow:  { default: "#e8ea95" },
  magenta: { default: "#eea3ff" },
  purple:  { default: "#cbb1ff" },
};

export const defaultEventColorGroup: ColorGroup = {
  default: "#dfdfdf"
};

export function getEventColorGroup(colorWord: string): ColorGroup {
  return kEventColorMap[colorWord as EventColorWord] ?? defaultEventColorGroup;
}
