import { types } from "@concord-consortium/mobx-state-tree";
import { typedId } from "../../utilities/js-utils";
import { DataConfigurationModel } from "./models/data-configuration-model";

export const GraphLayerModel = types
  .model('GraphLayerModel')
  .props({
    id: types.optional(types.identifier, () => typedId("LAYER")),
    config: types.optional(DataConfigurationModel, () => DataConfigurationModel.create())
  })
;
