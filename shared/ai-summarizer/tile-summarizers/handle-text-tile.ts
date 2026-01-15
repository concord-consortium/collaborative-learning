import { slateToMarkdown } from "../../slate-to-markdown";
import { TileHandlerParams } from "../ai-summarizer-types";

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
