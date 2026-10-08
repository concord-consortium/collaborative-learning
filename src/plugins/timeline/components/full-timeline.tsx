import classNames from "classnames";
import { DateTime } from "luxon";
import { observer } from "mobx-react-lite";
import React, { useRef } from "react";
import { useReadOnlyContext } from "../../../components/document/read-only-context";
import { DynamicScrollbar } from "../../../components/ui/dynamic-scrollbar";
import { useScrub } from "../../../components/ui/use-scrub";
import { useLiveAnnouncer } from "../../../hooks/use-live-announcer";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { kMinViewRangeSeconds } from "../models/timeline-content";
import { getEventColorClass } from "../timeline-types";
import { describeView } from "./describe-view";
import { EventShape } from "./event-shape";

import "./full-timeline.scss";

/**
 * The whole record in a strip below the graph, with an overlay marking the part the graph shows,
 * and the scrollbar beneath it. Dragging the overlay or the scrollbar thumb moves the view, and a
 * press elsewhere on either centers the view there. Read-only, both only display the view.
 */
export const FullTimeline = observer(function FullTimeline() {
  const content = useTimelineContent();
  const readOnly = useReadOnlyContext();
  const stripRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const { announcerRef, announce } = useLiveAnnouncer();

  const { sharedSeismogram, dataStartTime, dataEndTime, viewStartTime, viewEndTime } = content;
  const totalStart = dataStartTime?.toSeconds() ?? 0;
  const totalEnd = dataEndTime?.toSeconds() ?? 0;
  const viewStart = viewStartTime?.toSeconds() ?? 0;
  const viewEnd = viewEndTime?.toSeconds() ?? 0;

  const handleViewChange = (start: number, end: number) => {
    content.setViewRange(DateTime.fromSeconds(start), DateTime.fromSeconds(end));
  };
  // Each scrub is saved, and undone, as a single change.
  const handleScrubStart = () => content.beginViewPreview();
  const handleScrubEnd = () => {
    content.endViewPreview();
    announce(describeView(content));
  };

  const { isScrubbing, trackHandlers } = useScrub({
    trackRef: stripRef, handleRef: overlayRef, totalStart, totalEnd, viewStart, viewEnd, disabled: readOnly,
    onViewChange: handleViewChange, onScrubStart: handleScrubStart, onScrubEnd: handleScrubEnd
  });

  if (!sharedSeismogram || !dataStartTime || !dataEndTime || !viewStartTime || !viewEndTime) return null;
  const totalRange = totalEnd - totalStart;
  if (totalRange <= 0) return null;

  const toPct = (seconds: number) => (seconds - totalStart) / totalRange * 100;
  const colorWords = content.eventTypeColorWords;

  return (
    <div className="full-timeline-area">
      {/* The scrollbar thumb conveys the same position to assistive technology. */}
      <div
        aria-hidden="true"
        ref={stripRef}
        className={classNames("full-timeline", { "read-only": readOnly, "is-scrubbing": isScrubbing })}
        {...trackHandlers}
      >
        <WaveformPanel
          mode="overview"
          sharedSeismogram={sharedSeismogram}
          startTime={dataStartTime}
          endTime={dataEndTime}
        />
        {content.events.map(event => {
          const left = toPct(event.windowStart.toSeconds());
          const width = toPct(event.windowEnd.toSeconds()) - left;
          const colorWord = colorWords.get(event.eventType);
          return (
            <React.Fragment key={event.index}>
              <div
                className={classNames("full-timeline-event", getEventColorClass(colorWord))}
                style={{ left: `${left}%`, width: `${width}%` }}
              />
              <div className="full-timeline-shape" style={{ left: `${left + width / 2}%` }}>
                <EventShape colorWord={colorWord} size={6} />
              </div>
            </React.Fragment>
          );
        })}
        <div
          ref={overlayRef}
          className="full-timeline-overlay"
          style={{ left: `${toPct(viewStart)}%`, width: `${toPct(viewEnd) - toPct(viewStart)}%` }}
        />
        <div className="full-timeline-label">Full Timeline</div>
      </div>
      <DynamicScrollbar
        thumbAriaLabel="Timeline scroll position"
        totalStart={totalStart}
        totalEnd={totalEnd}
        viewStart={viewStart}
        viewEnd={viewEnd}
        minViewRange={kMinViewRangeSeconds}
        disabled={readOnly}
        onViewChange={handleViewChange}
        onScrubStart={handleScrubStart}
        onScrubEnd={handleScrubEnd}
      />
      <div ref={announcerRef} className="visually-hidden" aria-live="polite" />
    </div>
  );
});
