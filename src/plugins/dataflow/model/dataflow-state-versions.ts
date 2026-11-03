export const STATE_VERSION_RETE_V1 = "dataflow@0.1.0";

export const STATE_VERSION_CURRENT = "dataflow@1";


/**
 * The format version of a stored DataFlow program. Legacy programs normally carry the legacy id,
 * but some were saved without one. Those still have the legacy `values` map, which the current
 * format doesn't have. A program with neither an id nor `values` is current.
 */
export function getDataflowProgramVersion(program: any): string {
  return program?.id ?? (program?.values !== undefined ? STATE_VERSION_RETE_V1 : STATE_VERSION_CURRENT);
}
