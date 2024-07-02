import { getParentOfType, Instance, SnapshotIn, types } from "mobx-state-tree";
import { typedId } from "../../../utilities/js-utils";
import { onAnyAction } from "../../../utilities/mst-utils";
import { DataConfigurationModel, IDataConfigurationModel } from "./data-configuration-model";
import { getAppConfig } from "../../../models/tiles/tile-environment";
import { GraphPlace } from "../imports/components/axis-graph-shared";
import { GraphAttrRole } from "../graph-types";
import { IUpdateCategoriesOptions } from "../adornments/adornment-models";
import { GraphModel } from "./graph-model";
import { IDataSet, addCanonicalCasesToDataSet } from "../../../models/data/data-set";
import { ISharedCaseMetadata } from "../../../models/shared/shared-case-metadata";
import { DotsElt } from "../d3-types";
import { ICaseCreation } from "../../../models/data/data-set-types";
import { isImageUrl } from "../../../models/data/data-types";

export const GraphLayerModel = types
  .model('GraphLayerModel')
  .props({
    id: types.optional(types.identifier, () => typedId("LAYR")),
    config: types.optional(DataConfigurationModel, () => DataConfigurationModel.create()),
    // Whether this layer contains "points by hand" that can be edited in the graph
    editable: false
  })
  .volatile(self => ({
    autoAssignedAttributes: [] as Array<{ place: GraphPlace, role: GraphAttrRole, dataSetID: string, attrID: string }>,
    disposeDataSetListener: undefined as (() => void) | undefined,
    dotsElt: null as DotsElt
  }))
  .views(self => ({
    get isLinked() {
      return !!self.config?.dataset;
    }
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
    setDataConfiguration(config: IDataConfigurationModel) {
      self.config = config;
    },
    setDataset(dataset: IDataSet | undefined, metadata: ISharedCaseMetadata | undefined) {
      self.config.setDataset(dataset, metadata);
    },
    setDotsElt(elt: DotsElt) {
      self.dotsElt = elt;
    },
    setAttributeID(role: GraphAttrRole, dataSetID: string, id: string) {
      // dataSetID argument is used by onAction handlers
      if (role === 'yPlus') {
        self.config.addYAttribute({attributeID: id});
      } else {
        self.config.setAttributeForRole(role, {attributeID: id});
      }
      this.updateAdornments(true);
    },
    autoAssignAttributeID(place: GraphPlace, role: GraphAttrRole, dataSetID: string, attrID: string) {
      this.setAttributeID(role, dataSetID, attrID);
      self.autoAssignedAttributes.push({ place, role, dataSetID, attrID });
    },
    clearAutoAssignedAttributes() {
      self.autoAssignedAttributes = [];
    },
    /**
     * Add a point to this layer with the given x and y values.
     * A plot number can be provided; it defaults to 0 since currently
     * only a single trace of manually created points can be created in the graph.
     * @param x
     * @param y
     * @param plotNum optional, default 0
     */
    addPoint(x: number, y: number, plotNum: number=0) {
      const dataset = self.config.dataset;
      const xAttr = self.config.attributeID("x");
      const yAttr = self.config.yAttributeIDs[plotNum];
      if (dataset && xAttr && yAttr) {
        const newCase: ICaseCreation = {};
        newCase[xAttr] = x;
        newCase[yAttr] = y;
        const caseAdded = addCanonicalCasesToDataSet(dataset, [newCase]);
        return caseAdded[0];
      }
    },
    configureLinkedLayer() {
      if (!self.config) {
        console.warn("GraphLayerModel.configureLinkedLayer requires a dataset");
        return;
      }

      if (getAppConfig(self)?.getSetting("autoAssignAttributes", "graph")) {
        const attributeCount = self.config.dataset?.attributes.length;
        if (!attributeCount) return;

        const data = self.config.dataset;
        const xAttrId = self.config.attributeID("x");
        const isValidXAttr = xAttrId && !!data?.attrFromID(xAttrId);
        const yAttrId = self.config.attributeID("y");
        const isValidYAttr = yAttrId && !!data?.attrFromID(yAttrId);

        if (!isValidXAttr && !isValidYAttr) {
          const validAttributes = data?.attributes.filter(attr => {
            return data?.cases.every((c) => {
              const value = data?.getValue(c.__id__, attr.id);
              // For now at least, we do not graph images.
              return !(typeof value === "string" && isImageUrl(value));
            });
          });

          const bottomAttrId = validAttributes && validAttributes.length > 0 ? validAttributes[0].id : "";
          const leftAttrId = validAttributes && validAttributes.length > 1 ? validAttributes[1].id : "";

          this.autoAssignAttributeID("bottom", "x", data?.id ?? "", bottomAttrId);
          this.autoAssignAttributeID("left", "y", data?.id ?? "", leftAttrId);
        }
      } else {
        console.log('autoAssign is off');
      }
    },
    configureUnlinkedLayer() {
      if (!self.config.isEmpty) {
        self.config.clearAttributes();
        self.editable = false;
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
      const options = this.getUpdateCategoriesOptions(resetPoints);
      const graph = getParentOfType(self, GraphModel);
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
      const graph = getParentOfType(self, GraphModel);
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

export interface IGraphLayerModel extends Instance<typeof GraphLayerModel> { }
export interface IGraphLayerModelSnapshot extends SnapshotIn<typeof GraphLayerModel> {}
