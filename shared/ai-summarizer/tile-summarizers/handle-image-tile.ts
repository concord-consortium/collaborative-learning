import { TileHandlerParams } from "../ai-summarizer-types";

export function handleImageTile({ tile, options }: TileHandlerParams): string|undefined {
  const content: any = tile.model.content;
  if (content.type !== "Image") { return undefined; }
  if (!options.minimal) {
    return "This tile contains a static image. No additional information is available.";
  }
  if (options.imageFilenames) {
    const filename = imageFilename(content);
    return filename ? `(image: ${filename})` : "";
  }
  return "";
}

function imageFilename(content: { url?: string; filename?: string }): string | undefined {
  const source = content.filename || content.url;
  if (!source) { return undefined; }
  const withoutQuery = source.split(/[?#]/)[0];
  const parts = withoutQuery.split("/");
  return parts[parts.length - 1] || undefined;
}
