import { DateTime } from "luxon";
import React from "react";

interface ITimeLabelProps {
  time: DateTime;
}

export function TimeLabel({ time }: ITimeLabelProps) {
  return (
    <>
      <div>{time.toUTC().toLocaleString()}</div>
      <div>{time.toUTC().toLocaleString(DateTime.TIME_WITH_SECONDS)}</div>
    </>
  );
}
