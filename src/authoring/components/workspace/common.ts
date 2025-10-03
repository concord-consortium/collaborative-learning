import { SaveState } from "src/authoring/hooks/use-curriculum";
import { IUnit } from "src/authoring/types";
import { Updater } from "use-immer";

export interface IWorkspaceConfigComponentProps {
  unitConfig: IUnit;
  setUnitConfig: Updater<IUnit | undefined>
  saveState: SaveState;
}

export interface IWorkspaceComponentProps<T> {
  path: string;
  content: T;
}
