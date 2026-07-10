import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React from "react";
import { coverageSegments } from "../utils/seismic-admin-utils";
import "./raw-timeline.scss";

interface Props {
  highlightedDays: Set<number>;
  firstDay: number;
  lastDay: number;
}

/** A proportional bar of highlighted (filled) / normal (empty) day spans over [firstDay, lastDay]. */
export const RawTimeline = observer(function RawTimeline({ highlightedDays, firstDay, lastDay }: Props) {
  const totalDays = lastDay - firstDay + 1;
  const segments = coverageSegments(highlightedDays, firstDay, lastDay);
  return (
    <div className="raw-timeline" role="img" aria-label="raw data coverage">
      {segments.map(seg => {
        const days = seg.endDay - seg.startDay + 1;
        const pct = (days / totalDays) * 100;
        return (
          <div
            key={seg.startDay}
            className={classNames("segment", seg.highlighted ? "filled" : "empty")}
            style={{ width: `${pct}%` }}
          />
        );
      })}
    </div>
  );
});
