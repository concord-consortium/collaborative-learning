// Utility function for the AI tile type

import { SnapshotIn } from "@concord-consortium/mobx-state-tree";
import { kTextTileType, TextContentModel } from "../../models/tiles/text/text-content";

// Convert the tile content model to a Text tile content model
export function switchToTextContent(content: any, acrossDocuments: boolean) {
  console.log("switchToTextContent", content, acrossDocuments);
  const textTileContent: SnapshotIn<typeof TextContentModel> = {
    type: kTextTileType,
    text: content.text,
    format: "plain",
  };
  console.log("textTileContent", textTileContent);
  return textTileContent;
}
