import { destroy, Instance, types } from "mobx-state-tree";
import { Variable, VariableType } from "@concord-consortium/diagram-view";

export const kSharedVariablesID = "SharedVariables";

export const SharedVariables = types
.model("SharedVariables", {
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
  createVariable(): VariableType {
    const variable = Variable.create();
    self.addVariable(variable);
    return variable;
  },
}));
export interface SharedVariablesType extends Instance<typeof SharedVariables> {}
