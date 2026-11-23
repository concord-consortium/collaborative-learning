/**
 * Renders a document's arrow annotations -- sparrows -- as a GraphViz digraph.
 *
 * A sparrow states a relation between two things a student picked out, and often states it in the
 * student's own words ("+10", "x2"). Prose loses the part that matters: three rows joined by two
 * "+10" arrows are one strategy, not two arrows, and only a graph makes the chain visible. The
 * document's Dataflow tiles already serialize to DOT for the same reason.
 *
 * Node ids are `tileId:objectId`, so the same anchor in two sparrows is the same node and the path
 * through them survives.
 */
import {
  AiSummarizerOptions, AnnotationDescriber, AnnotationDescriberParams, NormalizedAnnotation,
  NormalizedDataSet, NormalizedVariable, TileMap
} from "./ai-summarizer-types";
import { heading, pluralize } from "./ai-summarizer-utils";
import { escapeDotString } from "./tile-summarizers/dataflow-to-graphviz";
import { describeDrawingObject } from "./tile-summarizers/handle-drawing-tile";
import { describeGraphObject } from "./tile-summarizers/handle-graph-tile";
import { describeNumberlineObject } from "./tile-summarizers/handle-numberline-tile";
import { describeGeometryObject } from "./tile-summarizers/handle-geometry-tile";
import { describeTableObject } from "./tile-summarizers/handle-table-tile";
import { describeTextObject } from "./tile-summarizers/handle-text-tile";

// Keyed on tile content type, so `undefined` from a describer means one thing: no such object any
// more. A tile type with no entry here falls to the generic backstop below.
const describersByType: Record<string, AnnotationDescriber> = {
  Drawing: describeDrawingObject,
  Geometry: describeGeometryObject,
  Graph: describeGraphObject,
  Numberline: describeNumberlineObject,
  Table: describeTableObject,
  Text: describeTextObject,
};

/**
 * The backstop for a tile type with no describer. It finds the object in the raw tile JSON so the
 * label says what kind of thing it is, and names the id either way. The result is clumsy on
 * purpose: a tile type added later reads awkwardly in the summary rather than vanishing from it.
 */
export function describeObjectGenerically({ tile, objectId, objectType }: AnnotationDescriberParams) {
  const found = findObjectById(tile?.content, objectId);
  const kind = (typeof found?.type === "string" && found.type) || objectType || "object";
  return `${kind} ${objectId}`;
}

function findObjectById(node: any, objectId: string): any {
  if (!node || typeof node !== "object") { return undefined; }
  if (node.id === objectId) { return node; }
  for (const value of Object.values(node)) {
    const found = findObjectById(value, objectId);
    if (found) { return found; }
  }
  return undefined;
}

export function describeObject(params: AnnotationDescriberParams): string | undefined {
  const describer = describersByType[params.tile?.content?.type] ?? describeObjectGenerically;
  return describer(params);
}

interface AnnotationsSummaryParams {
  annotations: NormalizedAnnotation[];
  dataSets: NormalizedDataSet[];
  variables: NormalizedVariable[];
  tileMap?: TileMap;
  options: AiSummarizerOptions;
  headingLevel: number;
}

const kPreamble =
  "A sparrow is an arrow a student drew on top of the document. Each node below is something a " +
  "sparrow is anchored to; each edge is one sparrow, labelled with the student's own text. An " +
  "edge runs the way the arrow points.";

export function annotationsSummary({
  annotations, dataSets, variables, tileMap, options, headingLevel
}: AnnotationsSummaryParams): string {
  if (annotations.length === 0) { return ""; }

  const nodeLines = new Map<string, string>();
  const edgeLines: string[] = [];
  let freeCount = 0;
  let skipped = 0;

  for (const annotation of annotations) {
    const source = resolveEnd(annotation.sourceObject, { dataSets, variables, tileMap });
    const target = resolveEnd(annotation.targetObject, { dataSets, variables, tileMap });
    // An end that carries an object the document no longer holds takes the sparrow with it: the
    // arrow renders nothing on screen either, so describing it would report something no one sees.
    if (source === "missing" || target === "missing") {
      skipped++;
      continue;
    }

    const ends = [source, target].map(end => {
      if (end === "free") {
        freeCount++;
        const id = `free${freeCount}`;
        nodeLines.set(id, `  "${id}" [label="empty space", shape=point];`);
        return id;
      }
      nodeLines.set(end.id, `  "${end.id}" [label="${end.label}"];`);
      return end.id;
    });

    const text = annotation.text?.trim();
    const label = text ? ` [label="${escapeDotString(text)}"]` : "";
    edgeLines.push(`  "${ends[0]}" -> "${ends[1]}"${label};`);
  }

  const graph = [
    "```dot",
    "digraph sparrows {",
    ...nodeLines.values(),
    "",
    ...edgeLines,
    "}",
    "```"
  ].join("\n");

  const preamble = options.minimal ? "" : `${kPreamble}\n\n`;
  return `\n${heading(headingLevel + 1, "Sparrows")}${preamble}${graph}\n\n${countLine(annotations.length, skipped)}\n`;
}

type ResolvedEnd = "free" | "missing" | { id: string; label: string };

function resolveEnd(
  object: NormalizedAnnotation["sourceObject"],
  context: Pick<AnnotationDescriberParams, "dataSets" | "variables" | "tileMap">
): ResolvedEnd {
  if (!object) { return "free"; }
  const tile = context.tileMap?.[object.tileId];
  if (!tile) { return "missing"; }
  const phrase = describeObject({
    tile, objectId: object.objectId, objectType: object.objectType, ...context
  });
  if (!phrase) { return "missing"; }
  return {
    id: `${object.tileId}:${object.objectId}`,
    label: escapeDotString(`${phrase} — ${tileLabel(tile)}`)
  };
}

// The tile as the reader already met it: the summary heads each tile with its title, so a label
// that named only the tile's id would send them looking for something the summary never printed.
function tileLabel(tile: any): string {
  const type = tile?.content?.type ?? "tile";
  return tile?.title ? `${type} "${tile.title}"` : `${type}`;
}

// Counts every sparrow the document stores, so the total never shrinks silently when one of them
// cannot be described.
function countLine(total: number, skipped: number): string {
  const sentence = `This document has ${total} ${pluralize(total, "sparrow", "sparrows")}.`;
  if (skipped === 0) { return sentence; }
  const subject = skipped === 1 ? "One is" : skipped === total ? "Both are" : `${skipped} are`;
  const they = skipped === 1 ? "it is" : "they are";
  const appear = skipped === 1 ? "it no longer appears" : "they no longer appear";
  return `${sentence} ${subject} not shown: ${they} anchored to something that has since been ` +
    `deleted, so ${appear} on screen.`;
}
