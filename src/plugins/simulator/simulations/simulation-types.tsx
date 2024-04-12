import { FunctionComponent } from "react";
import { VariableSnapshot, VariableType } from "@concord-consortium/diagram-view";
import { SharedProgramDataType } from "../../dataflow/model/shared-program-data";

export interface ISimulationProps {
  frame: number;
  variables: VariableType[];
  programData?: SharedProgramDataType;
}

export interface ISimulation {
  component?: FunctionComponent<ISimulationProps>,
  delay: number,
  step?: (props: ISimulationProps) => void,
  variables: VariableSnapshot[],
  values: Record<string, number[]>
}
