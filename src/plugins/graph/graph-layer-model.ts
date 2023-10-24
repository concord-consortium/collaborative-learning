import { types } from "@concord-consortium/mobx-state-tree";
import { typedId } from "../../utilities/js-utils";
import { DataConfigurationModel, IDataConfigurationModel } from "./models/data-configuration-model";
import { getAppConfig } from "../../models/tiles/tile-environment";
import { GraphPlace } from "./imports/components/axis-graph-shared";
import { GraphAttrRole } from "./graph-types";

export const GraphLayerModel = types
  .model('GraphLayerModel')
  .props({
    id: types.optional(types.identifier, () => typedId("LAYER")),
    config: types.optional(DataConfigurationModel, () => DataConfigurationModel.create())
  })
  .volatile(self => ({
    isLinked: false,
    autoAssignedAttributes: [] as Array<{ place: GraphPlace, role: GraphAttrRole, dataSetID: string, attrID: string }>,
  }))
  .views(self => ({
    get description() {
      return `[${self.id}: linked=${self.isLinked} config=${self.config.id} dataset=${self.config.dataset?.id}]`;
    }
  }))
  .actions(self => ({
    setDataConfiguration: (_config: IDataConfigurationModel) => {
      self.config = _config;
      self.isLinked = true;
    },
    autoAssignAttributeID(place: GraphPlace, role: GraphAttrRole, dataSetID: string, attrID: string) {
      self.config.setAttribute(role, {attributeID: attrID});
      self.autoAssignedAttributes.push({ place, role, dataSetID, attrID });
    },
    clearAutoAssignedAttributes() {
      self.autoAssignedAttributes = [];
    },
    configureLinkedLayer() {
      if (!self.config) {
        console.warn("GraphLayerModel.configureLinkedLayer requires a dataset");
        return;
      }

      if (getAppConfig(self)?.getSetting("autoAssignAttributes", "graph")) {
        const attributeCount = self.config.attributes.length;
        if (!attributeCount) return;

        const xAttrId = self.config.attributeID("x");
        const isValidXAttr = xAttrId && !!self.config.dataset?.attrFromID(xAttrId);
        const yAttrId = self.config.attributeID("y");
        const isValidYAttr = yAttrId && !!self.config.dataset?.attrFromID(yAttrId);

        if (!isValidXAttr && !isValidYAttr) {
          this.autoAssignAttributeID("bottom", "x", self.config.id, self.config.dataset?.attributes[0].id || '');
          if (attributeCount > 1) {
            this.autoAssignAttributeID("left", "y", self.config.id, self.config.dataset?.attributes[1].id || '');
          }
        }
      }
    },
    configureUnlinkedLayer() {
      if (self.config.attributeID("y")) {
        self.config.setAttribute("y");
      }
      if (self.config.attributeID("x")) {
        self.config.setAttribute("x");
      }
    }
  }));
