import { VariableType } from "@concord-consortium/diagram-view";
import { LogEventName } from "../../lib/logger-types";
import { logTileChangeEvent } from "../../models/tiles/log/log-tile-change-event";

// Snapshot of every variable's current value, keyed by name. Captured at the
// moment a student changes a control so the logged event carries the resulting
// output/derived values as answer context — without the simulation loop
// (step(), which never calls this) ever emitting an event.
function variablesSnapshot(variables: VariableType[]): Record<string, number | undefined> {
  const snapshot: Record<string, number | undefined> = {};
  for (const variable of variables) {
    if (variable.name != null) snapshot[variable.name] = variable.currentValue;
  }
  return snapshot;
}

// Emit a SIMULATOR_TOOL_CHANGE for a single student-initiated variable change.
// Routes through logTileChangeEvent, so a Simulator tile inside a Question also
// fires QUESTION_ANSWERS_CHANGE (which the Student Answers report reads) with no
// extra wiring. Call ONLY from student control handlers (buttons, slider
// release) — never from step()/the simulation loop.
//
// `valueLabel` is an optional human-readable name for the new value, passed for
// discrete controls whose numeric value is an opaque enum (e.g. a mode button:
// 0 -> "Pressure"). Continuous controls (sliders) omit it — the number is the
// meaning.
export function logSimulatorVariableChange(
  tileId: string,
  variable: VariableType,
  value: number | undefined,
  variables: VariableType[],
  valueLabel?: string
) {
  logTileChangeEvent(LogEventName.SIMULATOR_TOOL_CHANGE, {
    tileId,
    operation: "setValue",
    change: {
      name: variable.name,
      value,
      ...(valueLabel != null ? { valueLabel } : {}),
      variables: variablesSnapshot(variables),
    },
  });
}
