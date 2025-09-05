import { destroy, getType, Instance, SnapshotIn, types } from "mobx-state-tree";
import { UnitsManager, Variable, VariableSnapshot, VariableType } from "@concord-consortium/diagram-view";
import { SharedModel, SharedModelType } from "../../models/shared/shared-model";
import { withoutUndo } from "../../models/history/without-undo";
import { getSharedModelManager } from "../../models/tiles/tile-environment";

export const kSharedVariablesID = "SharedVariables";

export const SharedVariables = SharedModel.named("SharedVariables")
.props({
  type: types.optional(types.literal(kSharedVariablesID), kSharedVariablesID),
  variables: types.array(Variable)
})
.volatile(self => ({
  unitsManager: new UnitsManager()
}))
.actions(self => ({
  addVariable(variable: VariableType) {
    self.variables.push(variable);
  },

  removeVariable(variable?: VariableType) {
    if (variable) {
      destroy(variable);
    }
  }
}))
.actions(self => ({
  addAndInsertVariable(
    variable: VariableType,
    insertVariable: (variable: VariableType) => void,
    noUndo?: boolean
  ) {
    // In some cases, adding and inserting a new variable can add two undo steps to the undo stack,
    // leading to unexpected behavior. The noUndo flag is available to prevent a second undo step by
    // triggering a call to withoutUndo here when it is set to true.
    //
    // In the case of the text tile, for example, adding a new variable would add undo steps for both
    // the related call to setSlate and to addAndInsertVariable. The undo step for setSlate would be
    // added before the one for addAndInsertVariable. So after adding a new variable to a text tile
    // and then clicking undo, the variable was deleted but its chip in the text editor was replaced
    // with an "invalid reference: [variable ID]" error because the text editor still contained a
    // reference to the variable that no longer existed.
    if (noUndo) withoutUndo();
    self.addVariable(variable);
    const addedVariable = self.variables.find(v => v === variable);
    if (addedVariable) {
      insertVariable(addedVariable);
    }
  },
  createVariable(snapshot?: VariableSnapshot): VariableType {
    const variable = Variable.create(snapshot);
    self.addVariable(variable);
    return variable;
  }
}))
.views(self => ({
  get label() {
    const sharedModelManager = getSharedModelManager(self);
    return sharedModelManager?.getSharedModelLabel(self);
  },
  getVariables() {
    return self.variables;
  },
  getVariableById(id: string) {
    return self.variables.find(v => v.id === id);
  }
}));
export interface SharedVariablesType extends Instance<typeof SharedVariables> {}
export interface SharedVariablesSnapshot extends SnapshotIn<typeof SharedVariables> {}

export function isSharedVariables(model?: SharedModelType): model is SharedVariablesType {
  return model ? getType(model) === SharedVariables : false;
}
