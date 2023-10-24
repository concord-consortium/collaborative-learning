import { getParent, types } from "@concord-consortium/mobx-state-tree";
import { typedId } from "../../../utilities/js-utils";
import { onAnyAction } from "../../../utilities/mst-utils";
import { DataConfigurationModel, IDataConfigurationModel } from "./data-configuration-model";
import { getAppConfig } from "../../../models/tiles/tile-environment";
import { GraphPlace } from "../imports/components/axis-graph-shared";
import { GraphAttrRole } from "../graph-types";
import { IUpdateCategoriesOptions } from "../adornments/adornment-models";
import { IGraphModel } from "./graph-model";

export const GraphLayerModel = types
  .model('GraphLayerModel')
  .props({
    id: types.optional(types.identifier, () => typedId("LAYER")),
    config: types.optional(DataConfigurationModel, () => DataConfigurationModel.create())
  })
  .volatile(self => ({
    isLinked: false,
    autoAssignedAttributes: [] as Array<{ place: GraphPlace, role: GraphAttrRole, dataSetID: string, attrID: string }>,
    disposeDataSetListener: undefined as (() => void) | undefined
  }))
  .views(self => ({
    get description() {
      return `[${self.id}: linked=${self.isLinked} config=${self.config.id} dataset=${self.config.dataset?.id}]`;
    }
  }))
  .actions(self => ({
    beforeDestroy() {
      self.disposeDataSetListener?.();
    },
    setDataConfiguration: (config: IDataConfigurationModel) => {
      self.config = config;
      self.isLinked = true;
    },
    setAttributeID(role: GraphAttrRole, id: string) {
      if (role === 'yPlus') {
        self.config.addYAttribute({attributeID: id});
      } else {
        self.config.setAttribute(role, {attributeID: id});
      }
      this.updateAdornments(true);
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
        const attributeCount = self.config.dataset?.attributes.length;
        console.log('autoAssign is on. Atts: ', attributeCount);
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
        console.log('autoAssigned: ', self.autoAssignedAttributes);
      } else {
        console.log('autoassign is off');
      }
    },
    configureUnlinkedLayer() {
      if (self.config.attributeID("y")) {
        self.config.setAttribute("y");
      }
      if (self.config.attributeID("x")) {
        self.config.setAttribute("x");
      }
    },
    setDataSetListener() {
      const actionsAffectingCategories = [
        "addCases", "removeAttribute", "removeCases", "setCaseValues"
      ];
      self.disposeDataSetListener?.();
      self.disposeDataSetListener = self.config
        ? onAnyAction(self.config, action => {
            // TODO: check whether categories have actually changed before updating
            if (actionsAffectingCategories.includes(action.name)) {
              this.updateAdornments();
            }
          })
        : undefined;
    },
    updateAdornments(resetPoints=false) {
      console.log('updateAdornments');
      const options = this.getUpdateCategoriesOptions(resetPoints);
      // TODO: should adornments be registered on each layer?
      // Currently storing and updating them at the Graph level:
      const graph = getParent(self) as IGraphModel;
      if (graph) {
        graph.adornments.forEach(adornment => adornment.updateCategories(options));
      } else {
        console.log('not connected to graph, cannot updateAdornments');
      }
    },
    getUpdateCategoriesOptions(resetPoints=false): IUpdateCategoriesOptions {
      const xAttrId = self.config.attributeID("x") || '',
        xAttrType = self.config.attributeType("x"),
        xCats = xAttrType === "categorical"
          ? self.config.categoryArrayForAttrRole("x", [])
          : [""],
        yAttrId = self.config.attributeID("y") || '',
        yAttrType = self.config.attributeType("y"),
        yCats = yAttrType === "categorical"
          ? self.config.categoryArrayForAttrRole("y", [])
          : [""],
        topAttrId = self.config.attributeID("topSplit") || '',
        topCats = self.config.categoryArrayForAttrRole("topSplit", []) ?? [""],
        rightAttrId = self.config.attributeID("rightSplit") || '',
        rightCats = self.config.categoryArrayForAttrRole("rightSplit", []) ?? [""];
      const graph = getParent(self) as IGraphModel;
      const xAxis = graph.getAxis("bottom");
      const yAxis = graph.getAxis("left");
      return {
        xAxis,
        xAttrId,
        xCats,
        yAxis,
        yAttrId,
        yCats,
        topAttrId,
        topCats,
        rightAttrId,
        rightCats,
        resetPoints
      };
    }


  }));
