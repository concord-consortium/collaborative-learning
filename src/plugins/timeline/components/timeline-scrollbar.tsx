import React, { useCallback, useContext } from "react";
import { DateTime } from "luxon";
import { observer } from "mobx-react-lite";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { DynamicScrollbar } from "../../../components/ui/dynamic-scrollbar";
import { isTimelineContentModel, kMinViewRangeSeconds } from "../models/timeline-content";

export const TimelineScrollbar = observer(function TimelineScrollbar() {
  const rawContent = useContext(TileModelContext)?.content;
  const model = isTimelineContentModel(rawContent) ? rawContent : undefined;

  const setViewRange = model?.setViewRange;
  const handleViewChange = useCallback((start: number, end: number) => {
    setViewRange?.(DateTime.fromSeconds(start), DateTime.fromSeconds(end));
  }, [setViewRange]);

  if (!model) return null;

  const { dataStartTime, dataEndTime, viewStartTime, viewEndTime } = model;
  if (dataStartTime == null || dataEndTime == null || viewStartTime == null || viewEndTime == null) return null;

  return (
    <DynamicScrollbar
      thumbAriaLabel="Timeline scroll position"
      totalStart={dataStartTime.toSeconds()}
      totalEnd={dataEndTime.toSeconds()}
      viewStart={viewStartTime.toSeconds()}
      viewEnd={viewEndTime.toSeconds()}
      minViewRange={kMinViewRangeSeconds}
      onViewChange={handleViewChange}
    />
  );
});
