export interface ISimulationValue {
  description?: string;
  value: any;
}

export interface ISimulationData {
  description?: string;
  values: Record<string, ISimulationValue>;
}
