// Reserved label marking a variable whose `value` is produced at runtime — by a running simulation
// (sensor inputs, live outputs, and other simulation-driven variables) or a dataflow program. Such a
// value is overwritten every step/tick, so it is runtime state rather than authored content and is
// dropped from the stable export snapshot (see SharedVariables.exportStableSnapshot).
//
// The double-underscore signals that this is an internal/reserved marker, not an author-facing label,
// so it won't collide with a legitimate typed label a simulation might add (e.g. "sensor:temperature").
// Producers (simulation definitions) declare it on each variable they drive; the exporter reads it.
export const kVolatileVariableLabel = "__volatile__";
