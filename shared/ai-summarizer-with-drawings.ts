/**
Builds on ai-text-summarizer.ts, adding support for drawing tiles.

This uses the React renderer, which is not available in Firebase functions.
*/

import ReactDOMServer from "react-dom/server";
import React from "react";
import { renderDrawingObject } from "../src/plugins/drawing/components/drawing-object-manager";
import { DrawingContentModel } from "../src/plugins/drawing/model/drawing-content";
import { documentSummarizer, AiSummarizerOptions, defaultTileHandlers,
  TileHandler, TileHandlerParams } from "./ai-summarizer";

const enhancedTileHandlers: TileHandler[] = [
  handleDrawingTileWithSVG,
  ...defaultTileHandlers
];

/** Return the markdown summary of the given Document content. */
export default function documentSummarizerWithDrawings(content: any, options: AiSummarizerOptions): string {
  const tileHandlers = options.tileHandlers || enhancedTileHandlers;
  return documentSummarizer(content, { ...options, tileHandlers });
}

function handleDrawingTileWithSVG({ tile }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Drawing") { return undefined; }
  // eslint-disable-next-line max-len
  return `This tile contains a drawing. The drawing is rendered below in an svg code fence:\n\`\`\`svg\n${renderDrawing(tile.model.content)}\n\`\`\``;
}

function renderDrawing(model: any) {
  const elements = DrawingContentModel.create(model).objects.map((o: any) => {
    return renderDrawingObject(o);
  });
  const markup = ReactDOMServer.renderToStaticMarkup(React.createElement(React.Fragment, null, ...elements));
  return `<svg>${markup}</svg>`;
}
