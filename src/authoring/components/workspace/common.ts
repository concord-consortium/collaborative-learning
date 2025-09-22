import { IUnit } from "src/authoring/types";
import { Updater } from "use-immer";

export interface IWorkspaceConfigComponentProps {
  unitConfig: IUnit;
  setUnitConfig: Updater<IUnit | undefined>
}

export interface IWorkspaceComponentProps<T> {
  path: string;
  content: T;
}
