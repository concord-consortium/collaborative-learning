import classNames from "classnames";
import { DateTime } from "luxon";
import { observer } from "mobx-react-lite";
import React, { useRef } from "react";
import { useReadOnlyContext } from "../../../components/document/read-only-context";
import { DynamicScrollbar } from "../../../components/ui/dynamic-scrollbar";
import { useScrub } from "../../../components/ui/use-scrub";
import { useLiveAnnouncer } from "../../../hooks/use-live-announcer";
import { SharedSeismogramType } from "../../shared-seismogram/shared-seismogram";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { kMinViewRangeSeconds, TimelineContentModelType } from "../models/timeline-content";
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
  const { sharedSeismogram, dataStartTime, dataEndTime, viewStartTime, viewEndTime } = content;
  if (!sharedSeismogram || !dataStartTime || !dataEndTime || !viewStartTime || !viewEndTime) return null;
  if (dataEndTime <= dataStartTime) return null;
  // A separate component, so that a scrub still in progress ends when the strip goes away
  return (
    <FullTimelineStrip
      content={content}
      sharedSeismogram={sharedSeismogram}
      dataStartTime={dataStartTime}
      dataEndTime={dataEndTime}
    />
  );
});

interface IFullTimelineStripProps {
  content: TimelineContentModelType;
  sharedSeismogram: SharedSeismogramType;
  dataStartTime: DateTime;
  dataEndTime: DateTime;
}

const FullTimelineStrip = observer(function FullTimelineStrip({
  content, sharedSeismogram, dataStartTime, dataEndTime
}: IFullTimelineStripProps) {
  const readOnly = useReadOnlyContext();
  const stripRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  // The strip and the scrollbar can each be scrubbing at once; the view as the first one began
  const scrubCountRef = useRef(0);
  const scrubStartViewRef = useRef({ start: 0, end: 0 });
  const { announcerRef, announce } = useLiveAnnouncer();

  const totalStart = dataStartTime.toMillis();
  const totalEnd = dataEndTime.toMillis();
  const viewStart = content.viewStartMs ?? totalStart;
  const viewEnd = content.viewEndMs ?? totalEnd;
  const toPct = (ms: number) => (ms - totalStart) / (totalEnd - totalStart) * 100;

  const handleViewChange = (start: number, end: number) => {
    // Whole milliseconds, so that rounding can't change the width of the view as it moves
    const startMs = Math.round(start);
    content.setViewRange(DateTime.fromMillis(startMs), DateTime.fromMillis(startMs + Math.round(end - start)));
  };
  // Each scrub is saved, and undone, as a single change.
  const handleScrubStart = () => {
    if (scrubCountRef.current++ === 0) {
      scrubStartViewRef.current = { start: content.viewStartMs ?? 0, end: content.viewEndMs ?? 0 };
    }
    content.beginViewPreview();
  };
  const handleScrubEnd = () => {
    content.endViewPreview();
    if (--scrubCountRef.current > 0) return;
    const { start, end } = scrubStartViewRef.current;
    if (content.viewStartMs !== start || content.viewEndMs !== end) announce(describeView(content));
  };

  const { isScrubbing, trackHandlers } = useScrub({
    trackRef: stripRef, handleRef: overlayRef, totalStart, totalEnd, viewStart, viewEnd, disabled: readOnly,
    onViewChange: handleViewChange, onScrubStart: handleScrubStart, onScrubEnd: handleScrubEnd
  });

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
        <FullTimelineEvents content={content} totalStart={totalStart} totalEnd={totalEnd} />
        <div
          ref={overlayRef}
          className="full-timeline-overlay"
          style={{ "--overlay-left": `${toPct(viewStart)}%`, width: `${toPct(viewEnd) - toPct(viewStart)}%` } as
            React.CSSProperties}
        />
        <div className="full-timeline-label">Full Timeline</div>
      </div>
      <DynamicScrollbar
        thumbAriaLabel="Timeline scroll position"
        thumbValueText={describeView(content)}
        totalStart={totalStart}
        totalEnd={totalEnd}
        viewStart={viewStart}
        viewEnd={viewEnd}
        minViewRange={kMinViewRangeSeconds * 1000}
        disabled={readOnly}
        onViewChange={handleViewChange}
        onScrubStart={handleScrubStart}
        onScrubEnd={handleScrubEnd}
      />
      <div ref={announcerRef} className="visually-hidden" aria-live="polite" />
    </div>
  );
});

interface IFullTimelineEventsProps {
  content: TimelineContentModelType;
  totalStart: number;
  totalEnd: number;
}

// Doesn't read the view, so that moving the view doesn't redraw the events
const FullTimelineEvents = observer(function FullTimelineEvents(
  { content, totalStart, totalEnd }: IFullTimelineEventsProps
) {
  const toPct = (ms: number) => Math.max(0, Math.min(100, (ms - totalStart) / (totalEnd - totalStart) * 100));
  const colorWords = content.eventTypeColorWords;
  return (
    <>
      {content.events.map(event => {
        const windowStart = event.windowStart.toMillis();
        const windowEnd = event.windowEnd.toMillis();
        if (windowEnd <= totalStart || windowStart >= totalEnd) return null;
        const left = toPct(windowStart);
        const width = toPct(windowEnd) - left;
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
    </>
  );
});
