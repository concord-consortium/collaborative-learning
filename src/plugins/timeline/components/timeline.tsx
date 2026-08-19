import { observer } from "mobx-react-lite";
import React, { useEffect, useState } from "react";
import { useStores } from "../../../hooks/use-stores";
import { isValidDateTime } from "../../../utilities/luxon-utils";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { EventOverlay } from "./event-overlay";
import { TimeLabel } from "./time-label";
import { TimeMarkerOverlay } from "./time-marker-overlay";
import { TimelineScrollbar } from "./timeline-scrollbar";

import "./timeline.scss";

export const Timeline = observer(function Timeline() {
  const { seismicQueryService } = useStores();
  const content = useTimelineContent();
  const [scaleUnits, setScaleUnits] = useState("");

  const { sharedSeismogram, dataStartTime, dataEndTime, viewStartTime, viewEndTime } = content;
  const stationData = sharedSeismogram?.station;
  const viewStartSeconds = (viewStartTime?.toSeconds() ?? 0);

  // Initialize view range when data becomes available,
  // and clamp view to stay within bounds if data range changes.
  useEffect(() => {
    if (!dataStartTime || !dataEndTime) return;
    if (!content.viewStartTime || !content.viewEndTime) {
      // First load: set view to full data range
      content.fitToData();
    } else {
      // Data range changed: clamp view to stay within bounds
      const viewStart = content.viewStartTime;
      const viewEnd = content.viewEndTime;
      const newStart = viewStart < dataStartTime ? dataStartTime : viewStart;
      const newEnd = viewEnd > dataEndTime ? dataEndTime : viewEnd;
      if (newStart >= newEnd) {
        content.fitToData();
      } else if (newStart !== viewStart || newEnd !== viewEnd) {
        content.setViewRange(newStart, newEnd);
      }
    }
  }, [content, dataStartTime, dataEndTime]);

  // Find scale units from station metadata
  useEffect(() => {
    if (!stationData) return;

    seismicQueryService.getMetadata(stationData, viewStartSeconds).then(metadata => {
      setScaleUnits(metadata?.scaleUnits ?? "");
    });
  }, [seismicQueryService, stationData, viewStartSeconds]);

  const timeFromMouseEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!viewStartTime || !viewEndTime) return undefined;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return undefined;
    const fraction = (e.clientX - rect.left) / rect.width;
    const rangeMs = viewEndTime.toMillis() - viewStartTime.toMillis();
    return viewStartTime.plus({ milliseconds: fraction * rangeMs });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const time = timeFromMouseEvent(e);
    if (time) content.setHoverTime(time);
  };

  const handleMouseLeave = () => content.clearHoverTime();

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const time = timeFromMouseEvent(e);
    if (time) content.setPinnedTime(time);
  };

  return (
    <div className="timeline-area">
      {sharedSeismogram && isValidDateTime(viewStartTime) && isValidDateTime(viewEndTime) ? (
        <>
          <div className="waveform-wrapper">
            <div className="scale-unit">{scaleUnits}</div>
            <WaveformPanel
              mode="timeline"
              sharedSeismogram={sharedSeismogram}
              startTime={viewStartTime}
              endTime={viewEndTime}
              onClick={handleClick}
              onMouseLeave={handleMouseLeave}
              onMouseMove={handleMouseMove}
            />
            <EventOverlay />
            <TimeMarkerOverlay />
          </div>
          <div className="timeline-range-row">
            <div className="range-date range-start">
              <TimeLabel time={viewStartTime} />
            </div>
            <div className="range-duration">{content.viewRangeDurationText ?? ""}</div>
            <div className="range-date range-end">
              <TimeLabel time={viewEndTime} />
            </div>
          </div>
          <TimelineScrollbar />
        </>
      ) : <div className="waveform" />}
    </div>
  );
});
