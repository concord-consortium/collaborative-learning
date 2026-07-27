import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React from "react";
import { timelineSegments } from "../utils/seismic-admin-utils";
import "./raw-timeline.scss";

interface Props {
  ariaLabel?: string;
  highlightedDays: Set<number>;
  partialDays?: Set<number>;
  firstDay: number;
  lastDay: number;
}

/** A proportional bar of highlighted (filled) / partial / normal (empty) day spans over [firstDay, lastDay]. */
export const RawTimeline = observer(function RawTimeline({
  ariaLabel, highlightedDays, partialDays, firstDay, lastDay
}: Props) {
  const totalDays = lastDay - firstDay + 1;
  const segments = timelineSegments(highlightedDays, partialDays ?? new Set(), firstDay, lastDay);
  return (
    <div className="raw-timeline" role="img" aria-label={ariaLabel ?? "coverage timeline"}>
      {segments.map(seg => {
        const days = seg.endDay - seg.startDay + 1;
        const pct = (days / totalDays) * 100;
        return (
          <div
            key={seg.startDay}
            className={classNames("segment", seg.state)}
            style={{ width: `${pct}%` }}
          />
        );
      })}
    </div>
  );
});
