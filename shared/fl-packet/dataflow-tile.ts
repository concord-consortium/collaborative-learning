// Projects a CLUE Dataflow tile into the shape ForeverLearning's context packet expects:
// a flat node list and a flat edge list, in clue-catalog-proj-v1 terms.
//
// Two things deliberately do NOT come along. Node coordinates say nothing about the program's
// logic. And tickEntries — the per-node record of every run, which is roughly 60% of a raw tile
// and near-identical from tick to tick — collapse to a single current value that belongs in
// run_state, not on the node. See dataflowRunValues below.
//
// The tile carries BOTH forms for now. `nodes`/`edges` is what ForeverLearning's schema specifies
// and what every evidence reference and highlight target resolves against; `rendering` is the
// summarizer's Graphviz form, which no rule on their side reads. The drawing goes once their
// grouping release is live for us — it is roughly a third of a real packet, and grouping, the one
// thing it carried that the schema form could not, now has a home in `groups` below. The renderer
// is reached through a single call site so that dropping it is a one-line change.

import { programToGraphviz } from "../ai-summarizer/tile-summarizers/dataflow-to-graphviz";
import { displayNameForType } from "../dataflow-node-types";

export interface DataflowNode {
  id: string;
  type: string;
  orderedDisplayName: string;
  plot?: boolean;
  options?: Record<string, unknown>;
}

export interface DataflowEdge {
  from: string;
  to: string;
  to_input: string;
}

export interface DataflowGroup {
  id: string;
  label?: string;
  node_ids: string[];
  /**
   * Always empty: CLUE groups hold nodes, never other groups.
   *
   * Sent rather than omitted so the flatness reads as a fact about our model rather than as
   * missing data — their shape allows nesting and ours cannot express it.
   */
  group_ids: string[];
}

export interface ProjectedDataflowTile {
  tile_id: string;
  type: "Dataflow";
  title?: string;
  content: {
    program_id: string;
    nodes: DataflowNode[];
    edges: DataflowEdge[];
    groups?: DataflowGroup[];
    rendering: string;
  };
}

export interface RunValue {
  node_id: string;
  value: unknown;
}

// The fields of a node's `data` that are structural rather than options. Everything else a node
// carries is specific to its type (logicOperator, sensorType, outputType…) and is worth sending
// as-is, because we cannot know which of them the diagnostic reasons over.
const kStructuralNodeFields = new Set(["type", "plot", "orderedDisplayName", "tickEntries"]);

interface RawNode {
  id?: string;
  name?: string;
  data?: Record<string, any>;
}

interface RawGroup {
  id?: string;
  label?: string;
  nodeIds?: Record<string, string>;
  collapsed?: boolean;
}

interface RawProgram {
  id?: string;
  nodes?: Record<string, RawNode>;
  connections?: Record<string, Record<string, any>>;
  groups?: Record<string, RawGroup>;
  recentTicks?: string[];
}

// Their label is capped at 60 characters; ours is not, so an over-long one would make the packet
// invalid on the wire. Truncating keeps the group addressable, where dropping the label would
// leave the diagnostic with a group it cannot name.
const kMaxGroupLabel = 60;

// `collapsed` does not travel: it is whether the group is folded away in the editor, which says
// nothing about the program and has no home in their shape.
function projectGroups(program: RawProgram): DataflowGroup[] {
  return Object.values(program.groups ?? {}).map(raw => {
    const group: DataflowGroup = {
      id: String(raw.id ?? ""),
      node_ids: Object.keys(raw.nodeIds ?? {}),
      group_ids: [],
    };
    if (raw.label) group.label = raw.label.slice(0, kMaxGroupLabel);
    return group;
  });
}

function programOf(content: any): RawProgram {
  return (content?.program ?? {}) as RawProgram;
}

// The renderer walks the program unguarded — Object.values on the nodes map, node.data.type on
// each node — while everything around it here defends its own reads. Handing it a snapshot this
// module has already accepted therefore turned a malformed program into a thrown error out of
// packet assembly, costing the whole turn rather than one tile's rendering. Same reasoning, and
// the same shape, as the Drawing projection's guard.
function renderProgram(program: RawProgram): string {
  try {
    return programToGraphviz(program as any);
  } catch {
    return "This program was malformed and could not be rendered.";
  }
}

export function projectDataflowTile(
  content: any, tileId: string, title?: string
): ProjectedDataflowTile {
  const program = programOf(content);
  const nodes: DataflowNode[] = Object.values(program.nodes ?? {}).map(raw => {
    const data = raw.data ?? {};
    const options: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (!kStructuralNodeFields.has(key)) options[key] = value;
    }
    const node: DataflowNode = {
      id: String(raw.id ?? ""),
      // `type` stays the internal string: it is the stable machine-readable key the schema is
      // written against. `orderedDisplayName` is the opposite — its whole contract is the word the
      // student reads — and a node saved before that field existed has none, falling back to the
      // node's own `name`, which is the raw internal type (createAndAddNode stamps both from the
      // same value). So the fallback maps, while `type` does not.
      type: String(data.type ?? raw.name ?? ""),
      orderedDisplayName: String(data.orderedDisplayName ?? displayNameForType(String(raw.name ?? ""))),
    };
    if (data.plot !== undefined) node.plot = !!data.plot;
    if (Object.keys(options).length) node.options = options;
    return node;
  });

  const edges: DataflowEdge[] = Object.values(program.connections ?? {}).map(c => ({
    from: String(c.source ?? ""),
    to: String(c.target ?? ""),
    to_input: String(c.targetInput ?? ""),
  }));

  const tile: ProjectedDataflowTile = {
    tile_id: tileId,
    type: "Dataflow",
    content: {
      program_id: String(program.id ?? ""), nodes, edges,
      rendering: renderProgram(program),
    },
  };
  // Omitted rather than empty, so an ungrouped program is not described as one with no groups.
  const groups = projectGroups(program);
  if (groups.length) tile.content.groups = groups;
  if (title !== undefined) tile.title = title;
  return tile;
}

// The current value of each node, taken from the last recorded tick. A program that has never run
// has no values to report — which is different from reporting zeros, and the distinction matters
// because "not run yet" and "ran and produced 0" are different evidence.
export function dataflowRunValues(content: any): RunValue[] {
  const program = programOf(content);
  const ticks = program.recentTicks ?? [];
  const lastTick = ticks[ticks.length - 1];
  if (!lastTick) return [];
  const values: RunValue[] = [];
  for (const raw of Object.values(program.nodes ?? {})) {
    const entry = raw.data?.tickEntries?.[lastTick];
    if (entry && entry.nodeValue !== undefined) {
      values.push({ node_id: String(raw.id ?? ""), value: entry.nodeValue });
    }
  }
  return values;
}
