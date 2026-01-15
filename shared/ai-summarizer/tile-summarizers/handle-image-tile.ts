import { TileHandlerParams } from "../ai-summarizer-types";

export function handleImageTile({ tile, options }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Image") { return undefined; }
  return options.minimal ? "" : "This tile contains a static image. No additional information is available.";
}
