import { FunctionComponent } from "react";
import { VariableSnapshot, VariableType } from "@concord-consortium/diagram-view";
import { SharedDataSetType } from "../../../models/shared/shared-data-set";

export interface ISimulationProps {
  frame: number;
  variables: VariableType[];
  dataSet?: SharedDataSetType;
}

export interface ISimulation {
  component?: FunctionComponent<ISimulationProps>,
  delay: number,
  step?: (props: ISimulationProps) => void,
  variables: VariableSnapshot[],
  values: Record<string, number[]>
}
