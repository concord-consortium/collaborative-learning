import { DateTime } from "luxon";
import { observer } from "mobx-react-lite";
import React, { useEffect } from "react";
import { isValidDateTime } from "../../../utilities/luxon-utils";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { EventOverlay } from "./event-overlay";
import { TimelineScrollbar } from "./timeline-scrollbar";

import "./timeline.scss";

export const Timeline = observer(function Timeline() {
  const content = useTimelineContent();

  const { sharedSeismogram, dataStartTime, dataEndTime, viewStartTime, viewEndTime } = content;

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

  return (
    <div className="timeline-area">
      {sharedSeismogram && isValidDateTime(viewStartTime) && isValidDateTime(viewEndTime) ? (
        <>
          <div className="waveform-wrapper">
            <WaveformPanel
              mode="timeline"
              sharedSeismogram={sharedSeismogram}
              startTime={viewStartTime}
              endTime={viewEndTime}
            />
            <EventOverlay />
          </div>
          <div className="timeline-range-row">
            <div className="range-date range-start">
              <div>{viewStartTime.toUTC().toLocaleString()}</div>
              <div>{viewStartTime.toUTC().toLocaleString(DateTime.TIME_WITH_SECONDS)}</div>
            </div>
            <div className="range-duration">{content.viewRangeDurationText ?? ""}</div>
            <div className="range-date range-end">
              <div>{viewEndTime.toUTC().toLocaleString()}</div>
              <div>{viewEndTime.toUTC().toLocaleString(DateTime.TIME_WITH_SECONDS)}</div>
            </div>
          </div>
          <TimelineScrollbar />
        </>
      ) : <div className="waveform" />}
    </div>
  );
});
