import { slateToMarkdown } from "../../slate-to-markdown";
import { AnnotationDescriberParams, TileHandlerParams } from "../ai-summarizer-types";

export function handleTextTile({ tile, options }: TileHandlerParams): string|undefined {
  const content: any = tile.model.content;
  if (content.type !== "Text") { return undefined; }
  let textFormat = "Markdown";
  let result: string;
  switch (content.format) {
    case "slate":
      try {
        result = slateToMarkdown(content.text);
      } catch (error) {
        console.error("Error deserializing slate content:", error);
        result = content.text;
      }
      break;

    case "markdown":
      result = content.text;
      break;

    default:
      textFormat = content.format || "plain";
      result = content.text;
      break;
  }

  return options.minimal ? `\`\`\`text\n${result || ""}\n\`\`\``
    : `This tile contains the following ${textFormat} text content delimited below by a text code fence:` +
      `\n\n\`\`\`text\n${result || ""}\n\`\`\``;
}

// The two kinds of thing a text tile lets a sparrow point at. Both strings are the client's: the
// highlights plugin's format and the shared-variables plugin's chip format.
const kHighlightType = "highlight";
const kVariableChipType = "m2s-variable";

export function describeTextObject(
  { tile, objectId, objectType, variables }: AnnotationDescriberParams
): string | undefined {
  if (objectType === kHighlightType) {
    const highlights: any[] = tile?.content?.highlightedText ?? [];
    const highlight = highlights.find(candidate => candidate?.id === objectId);
    return highlight ? `the highlighted text "${highlight.text}"` : undefined;
  }

  if (objectType === kVariableChipType) {
    const variable = variables.find(candidate => candidate.id === objectId);
    if (!variable) { return undefined; }
    const name = variable.displayName || variable.name || objectId;
    const value = variable.value !== undefined
      ? ` (${variable.value}${variable.unit ? ` ${variable.unit}` : ""})`
      : "";
    return `the variable chip for ${name}${value}`;
  }

  return undefined;
}
