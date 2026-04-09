import { useContext } from "react";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { isTimelineContentModel, TimelineContentModelType } from "../models/timeline-content";

/**
 * Returns the typed TimelineContentModel from TileModelContext.
 * Throws if used outside a TileModelContext provider or if the content
 * is not a TimelineContentModel.
 */
export function useTimelineContent(): TimelineContentModelType {
  const model = useContext(TileModelContext);
  const content = model?.content;
  if (!isTimelineContentModel(content)) {
    throw new Error("useTimelineContent must be used inside a Timeline tile");
  }
  return content;
}
