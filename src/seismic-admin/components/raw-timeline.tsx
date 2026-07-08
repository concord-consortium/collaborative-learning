import classNames from "classnames";
import React from "react";
import { coverageSegments } from "../seismic-admin-utils";
import "./raw-timeline.scss";

interface Props {
  cachedDays: Set<number>;
  firstDay: number;
  lastDay: number;
}

/** A proportional bar of cached (filled) / uncached (empty) day spans over [firstDay, lastDay]. */
export function RawTimeline({ cachedDays, firstDay, lastDay }: Props) {
  const totalDays = lastDay - firstDay + 1;
  const segments = coverageSegments(cachedDays, firstDay, lastDay);
  return (
    <div className="raw-timeline" role="img" aria-label="raw data coverage">
      {segments.map(seg => {
        const days = seg.endDay - seg.startDay + 1;
        const pct = (days / totalDays) * 100;
        return (
          <div
            key={seg.startDay}
            className={classNames("segment", seg.cached ? "filled" : "empty")}
            style={{ width: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}
