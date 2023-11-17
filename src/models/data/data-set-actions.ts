import { ISerializedActionCall } from "mobx-state-tree";
import { ICase } from "./data-set-types";

// TODO: define the types for the rest of the actions

// NOTE: AddCasesAction differs between CLUE and CODAP DataSets
export interface AddCasesAction extends ISerializedActionCall {
  name: "addCasesWithIDs" | "addCanonicalCasesWithIDs"
  args: [cases: ICase[], beforeID: string | string[] | undefined]
}
export const isAddCasesAction = (action: ISerializedActionCall): action is AddCasesAction =>
              ["addCasesWithIDs", "addCanonicalCasesWithIDs"].includes(action.name);

// NOTE: SetCaseValuesAction differs between CLUE and CODAP DataSets
export interface SetCaseValuesAction extends ISerializedActionCall {
  name: "setCaseValues" | "setCanonicalCaseValues"
  args: [ICase[], string[]]
}
export const isSetCaseValuesAction = (action: ISerializedActionCall): action is SetCaseValuesAction =>
              action.name === "setCaseValues" || action.name === "setCanonicalCaseValues";

export interface SetAttributeNameAction extends ISerializedActionCall {
  name: "setAttributeName"
  args: [string /*attributeID*/, string /*newName*/]
}

export const isSetAttributeNameAction = (action: ISerializedActionCall): action is SetAttributeNameAction =>
              action.name === "setAttributeName";

export interface RemoveAttributeAction extends ISerializedActionCall {
  name: "removeAttribute"
  args: [attrID: string]
}
export const isRemoveAttributeAction = (action: ISerializedActionCall): action is SetAttributeNameAction =>
  action.name === "removeAttribute";

export interface RemoveCasesAction extends ISerializedActionCall {
  name: "removeCases"
  args: [string[]]
}

export const isRemoveCasesAction = (action: ISerializedActionCall): action is RemoveCasesAction =>
              action.name === "removeCases";

export interface SelectAllAction extends ISerializedActionCall {
  name: "selectAll"
  args: [boolean]
}

export interface SelectCasesAction extends ISerializedActionCall {
  name: "selectCases"
  args: [string[], boolean]
}

export interface SetSelectedCasesAction extends ISerializedActionCall {
  name: "setSelectedCases"
  args: [string[]]
}

export type PartialSelectionAction = SelectCasesAction | SetSelectedCasesAction;
export type SelectionAction = PartialSelectionAction | SelectAllAction;

export const isPartialSelectionAction = (action: ISerializedActionCall): action is PartialSelectionAction =>
              ["selectCases", "setSelectedCases"].includes(action.name);

export const isSelectionAction = (action: ISerializedActionCall): action is SelectionAction =>
              ["selectAll", "selectCases", "setSelectedCases"].includes(action.name);
