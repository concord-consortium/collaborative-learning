import { FunctionComponent } from "react";
import { VariableSnapshot, VariableType } from "@concord-consortium/diagram-view";

export interface ISimulationProps {
  frame: number,
  variables: VariableType[]
}

export interface ISimulation {
  component?: FunctionComponent<ISimulationProps>,
  delay: number,
  variables: VariableSnapshot[],
  values: Record<string, number[]>
}
