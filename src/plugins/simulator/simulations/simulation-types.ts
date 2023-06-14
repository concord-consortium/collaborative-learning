// TODO: VariableSnapshotType
export interface ISimulation {
  delay: number,
  variables: any[],
  values: Record<string, number[]>
}
