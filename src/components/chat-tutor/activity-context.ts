import { ActivityContext, readActivityContext } from "../../../shared/fl-packet/activity-context";
import { slateToMarkdown } from "../../../shared/slate-to-markdown";
import { ProblemModelType } from "../../models/curriculum/problem";
import { UnitModelType } from "../../models/curriculum/unit";
import { RowListType } from "../../models/document/row-list";
import { ITileMapLookup } from "../../models/tiles/tile-model";
import { isQuestionModel } from "../../models/tiles/question/question-content";
import { TextContentModelType } from "../../models/tiles/text/text-content";
import { htmlToSlate, slateToText } from "@concord-consortium/slate-editor";
import { kHighlightChipIdAttr, kSlateChipTypeAttr } from "../tiles/text/plugins/chip-serialization";
import { currentProblemOrdinal } from "./unit-context";

function highlightText(content: TextContentModelType, id: string | null): string {
  const entry = content.highlightedText.find(h => h.id === id);
  if (!entry) throw new Error("Unresolved task highlight");
  return entry.text;
}

function resolveSlateHighlights(value: unknown, content: TextContentModelType): unknown {
  if (Array.isArray(value)) return value.map(v => resolveSlateHighlights(v, content));
  if (!value || typeof value !== "object") return value;
  const node = value as Record<string, unknown>;
  if (node.type === "highlight" && typeof node.highlightId === "string") {
    return { text: highlightText(content, node.highlightId) };
  }
  return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, resolveSlateHighlights(v, content)]));
}

function htmlTaskText(content: TextContentModelType): string {
  // Highlight chips serialize only an id; asPlainText alone loses the words displayed on screen.
  // Resolve only referenced chips, on an inert copy, without changing the curriculum or editor.
  const document = new DOMParser().parseFromString(content.joinHtml, "text/html");
  document.querySelectorAll(`[${kSlateChipTypeAttr}="highlight"]`).forEach(chip => {
    chip.replaceWith(document.createTextNode(highlightText(content, chip.getAttribute(kHighlightChipIdAttr))));
  });
  return slateToText(htmlToSlate(document.body.innerHTML));
}

// Walk only authored student-visible text, in the displayed document's reading order.
// Question containers retain their children's display restrictions. Never traverse supports,
// arbitrary metadata, teacher-guide documents, shared models or workspace answers.
function studentText(rows: RowListType, tiles: ITileMapLookup, ancestors = new Set<string>()): string[] {
  return rows.rowOrder.flatMap(rowId => (rows.getRow(rowId)?.tiles ?? []).flatMap(layout => {
    const tile = tiles.get(layout.tileId);
    // Same visibility test as TileRow for a learner, even if a teacher has enabled solutions.
    if (!tile || tile.display || ancestors.has(tile.id)) return [];
    if (isQuestionModel(tile.content)) {
      return studentText(tile.content, tiles, new Set([...ancestors, tile.id]));
    }
    if (tile.content.type !== "Text") return [];
    const content = tile.content as TextContentModelType;
    let result: string;
    if (content.format === "slate") {
      result = slateToMarkdown(JSON.stringify(resolveSlateHighlights(JSON.parse(content.joinText), content)));
    } else if (!content.format || ["markdown", "plain"].includes(content.format)) {
      result = content.joinText;
    } else if (content.format === "html") {
      result = htmlTaskText(content);
    } else {
      throw new Error("Unsupported task text format");
    }
    return result.trim() ? [result.trim()] : [];
  }));
}

export function buildActivityContext(
  unit: UnitModelType, problem: ProblemModelType, selectedSection?: string
): ActivityContext | undefined {
  // Match ProblemTabContent's first-section fallback, including a stale saved tab after a lesson change.
  const section = problem.sections.find(s => s.type === selectedSection) ?? problem.sections[0];
  if (!section?.content) return undefined;
  let task: string;
  try {
    task = studentText(section.content, section.content.tileMap).join("\n\n");
  } catch {
    console.warn("[chat-tutor] Activity context omitted: selected task text could not be read.");
    return undefined;
  }
  if (!task) return undefined;
  const activity: ActivityContext = { task_prompt: task };
  // A detached/unknown problem can still supply task text, but cannot claim a lesson selector.
  if (unit.investigations.some(i => i.problems.some(p => p === problem))) {
    const ordinal = currentProblemOrdinal(problem);
    if (/^[1-9]\d*\.[1-9]\d*$/.test(ordinal) && unit.code.trim()) {
      activity.source = { system: "CLUE", lesson_id: ordinal, unit: unit.code, section: section.type };
    }
  }
  const result = readActivityContext(activity);
  if (!result) console.warn("[chat-tutor] Activity context omitted: selected task exceeds the context limits.");
  return result;
}
