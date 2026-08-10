import { FunctionComponent } from "react";
import { VariableSnapshot, VariableType } from "@concord-consortium/diagram-view";
import { SharedProgramDataType } from "../../shared-program-data/shared-program-data";

export interface ISimulationProps {
  tileElt?: HTMLElement|null;
  simRef?: React.RefObject<HTMLDivElement>;
  frame: number;
  variables: VariableType[];
  programData?: SharedProgramDataType;
  // The Simulator tile's id, threaded so student control handlers can attribute
  // a SIMULATOR_TOOL_CHANGE to this tile. Optional because the step()-only
  // callers (ISimulation.step) don't need it.
  tileId?: string;
}

export interface ISimulation {
  component?: FunctionComponent<ISimulationProps>,
  delay: number,
  step?: (props: ISimulationProps) => void,
  variables: VariableSnapshot[],
  values: Record<string, number[]>
}
