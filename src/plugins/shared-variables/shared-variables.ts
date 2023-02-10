import { destroy, Instance, types } from "mobx-state-tree";
import { Variable, VariableType } from "@concord-consortium/diagram-view";
import { SharedModel } from "../../models/shared/shared-model";

export const kSharedVariablesID = "SharedVariables";

export const SharedVariables = SharedModel.named("SharedVariables")
.props({
  type: types.optional(types.literal(kSharedVariablesID), kSharedVariablesID),
  variables: types.array(Variable)
})
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
  addAndInsertVariable(variable: VariableType, insertVariable: (variable: VariableType) => void) {
    self.addVariable(variable);
    const addedVariable = self.variables.find(v => v === variable);
    if (addedVariable) {
      insertVariable(addedVariable);
    }
  },
  createVariable(): VariableType {
    const variable = Variable.create();
    self.addVariable(variable);
    return variable;
  },
}))
.views(self => ({
  getVariables() {
    return self.variables;
  }
}));
export interface SharedVariablesType extends Instance<typeof SharedVariables> {}
