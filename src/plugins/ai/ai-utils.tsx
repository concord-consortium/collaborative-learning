// Utility function for the AI tile type

import { SnapshotIn } from "mobx-state-tree";
import Markdown from "markdown-to-jsx";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { kTextTileType, TextContentModel } from "../../models/tiles/text/text-content";

/**
 * Convert the AI tile content model to a Text tile content model.
 * The content of the Text tile will be the AI-generated content, converted to HTML for Slate.
 * @param content - The AI tile content model
 * @returns The Text tile content model
 */
export function switchToTextContent(content: any) {
  const jsxElement = <Markdown>{content.text}</Markdown>;
  const html = ReactDOMServer.renderToStaticMarkup(jsxElement);

  const textTileContent: SnapshotIn<typeof TextContentModel> = {
    type: kTextTileType,
    text: html,
    format: "html",
  };
  return textTileContent;
}
