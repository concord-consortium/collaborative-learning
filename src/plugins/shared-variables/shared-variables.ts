import { destroy, Instance, types } from "mobx-state-tree";
import { SharedModel } from "../../models/tools/shared-model";
import { uniqueId } from "../../utilities/js-utils";

export const kSharedVariablesID = "SharedVariables";

export const Variable = types.model("Variable", {
  id: types.identifier,
  name: types.string
});
export interface VariableType extends Instance<typeof Variable> {}

export const SharedVariables = SharedModel.named("SharedVariables")
.props({
  type: types.optional(types.literal(kSharedVariablesID), kSharedVariablesID),
  variables: types.array(Variable)
})
.actions(self => ({
  addVariable(text: string) {
    self.variables.push({id: uniqueId(), name: text});
  },

  removeVariable(variable: VariableType) {
    destroy(variable);
  }
}));
export interface SharedVariablesType extends Instance<typeof SharedVariables> {}
