export enum EPanelId {
  controlPanel = "control-panels",
  dashboard = "dashboard",
  workspace = "workspace"
}

export interface IPanelSpec {
  panelId: EPanelId;
  label: string;
  content: JSX.Element;
}
export type IPanelGroupSpec = IPanelSpec[];
