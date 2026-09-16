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
