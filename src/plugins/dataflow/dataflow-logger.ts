
export interface DataflowProgramChange extends Record<string ,any> {
  targetType: string,
  nodeTypes?: string[],
  nodeIds?: string[],
}
