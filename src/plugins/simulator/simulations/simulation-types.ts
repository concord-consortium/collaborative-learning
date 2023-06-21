import { VariableSnapshot } from "@concord-consortium/diagram-view";

export interface ISimulation {
  delay: number,
  variables: VariableSnapshot[],
  values: Record<string, number[]>
}
