import React, { useContext } from "react";
import { observer } from "mobx-react-lite";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { DynamicScrollbar } from "../../../components/ui/dynamic-scrollbar";
import { isTimelineContentModel } from "../models/timeline-content";

export const TimelineScrollbar = observer(function TimelineScrollbar() {
  const rawContent = useContext(TileModelContext)?.content;
  const model = isTimelineContentModel(rawContent) ? rawContent : undefined;
  if (!model) return null;

  const { dataStartTime, dataEndTime, viewStartTime, viewEndTime, setViewRange } = model;
  if (dataStartTime == null || dataEndTime == null || viewStartTime == null || viewEndTime == null) return null;

  return (
    <DynamicScrollbar
      thumbAriaLabel="Timeline scroll position"
      totalStartTime={dataStartTime}
      totalEndTime={dataEndTime}
      viewStartTime={viewStartTime}
      viewEndTime={viewEndTime}
      onViewChange={setViewRange}
    />
  );
});
