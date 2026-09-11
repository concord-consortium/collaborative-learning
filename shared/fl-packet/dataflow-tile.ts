// Projects a CLUE Dataflow tile into the shape ForeverLearning's context packet expects:
// a flat node list and a flat edge list, in clue-catalog-proj-v1 terms.
//
// Two things deliberately do NOT come along. Node coordinates say nothing about the program's
// logic. And tickEntries — the per-node record of every run, which is roughly 60% of a raw tile
// and near-identical from tick to tick — collapse to a single current value that belongs in
// run_state, not on the node. See dataflowRunValues below.
//
// The tile carries BOTH forms. `nodes`/`edges` is what their live schema specifies. `rendering` is
// our summarizer's Graphviz form, which states the program's logic rather than its structure and
// which ForeverLearning have agreed in principle to take as the payload — but they have not
// switched, wanting to validate their answer-protection against it first. A probe confirmed the
// extra key is accepted today, so sending both lets them evaluate it on live turns instead of from
// an emailed sample, and costs roughly a doubling of a packet we are using a quarter of.
//
// When they do switch, `nodes`/`edges` goes and this becomes a one-line change here rather than a
// rewrite — which is why the renderer is reached through a single call site.

import { programToGraphviz } from "../ai-summarizer/tile-summarizers/dataflow-to-graphviz";

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

export interface ProjectedDataflowTile {
  tile_id: string;
  type: "Dataflow";
  title?: string;
  content: {
    program_id: string;
    nodes: DataflowNode[];
    edges: DataflowEdge[];
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

interface RawProgram {
  id?: string;
  nodes?: Record<string, RawNode>;
  connections?: Record<string, Record<string, any>>;
  recentTicks?: string[];
}

function programOf(content: any): RawProgram {
  return (content?.program ?? {}) as RawProgram;
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
      type: String(data.type ?? raw.name ?? ""),
      orderedDisplayName: String(data.orderedDisplayName ?? raw.name ?? ""),
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
      rendering: programToGraphviz(program as any),
    },
  };
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
