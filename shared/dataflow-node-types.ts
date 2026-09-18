// The dataflow block palette's internal type names and their on-screen display names. Lives in
// shared/ rather than src/plugins/dataflow/model/utilities/node.ts (which re-exports it) because
// the AI workspace summarizer (shared/ai-summarizer/tile-summarizers/dataflow-to-graphviz.ts) also
// needs it to translate a block's internal type into the word a student actually sees, and that
// file cannot import from node.ts — it opens with two dozen SVG imports, which Cloud Functions
// cannot load, and shared/ is loaded by Cloud Functions as well as the browser.
export interface NodeType {
  name: string;
  displayName: string;
}

export const NodeTypes: NodeType[] = [
  {
    name: "Sensor",
    displayName: "Sensor",
  },
  {
    name: "Number",
    displayName: "Number",
  },
  {
    name: "Generator",
    displayName: "Waves",
  },
  // Timer block hidden from the palette. Kept in code (rete-manager registration, node class) so
  // existing programs that already contain a Timer node still load.
  // {
  //   name: "Timer",
  //   displayName: "Timer (on/off)"
  // },
  {
    name: "Math",
    displayName: "Math",
  },
  {
    name: "Logic",
    displayName: "Compare",
  },
  {
    name: "Transform",
    displayName: "Transform",
  },
  {
    name: "Control",
    displayName: "Hold",
  },
  {
    name: "Demo Output",
    displayName: "Demo Device",
  },
  {
    name: "Live Output",
    displayName: "Live Device",
  }
];

const displayNameByType = new Map(NodeTypes.map(nt => [nt.name, nt.displayName]));

/**
 * The word a student sees for a block of the given internal type. The palette has been renamed
 * since these internal type strings were chosen (e.g. "Generator" displays as "Waves"), so anything
 * that names a block to a person — or to an AI that will name it to a person — has to go through
 * here. Unmapped types (the hidden Timer, and anything a future program carries that the palette no
 * longer offers) fall back to the internal string, which is better than naming nothing at all.
 */
export function displayNameForType(type: string): string {
  return displayNameByType.get(type) ?? type;
}
