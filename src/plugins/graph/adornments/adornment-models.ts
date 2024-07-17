/*
  Adornment models are strictly MST. They keep track of the user modifications of the defaults.
 */

import {Instance, types} from "mobx-state-tree";
import { IAxisModel } from "../imports/components/axis/models/axis-model";
import {typedId} from "../../../utilities/js-utils";
import {GraphAttrRole, Point} from "../graph-types";
import { IClueTileObject } from "../../../models/annotations/clue-object";

export const PointModel = types.model("Point", {
    x: types.optional(types.number, NaN),
    y: types.optional(types.number, NaN)
  })
  .views(self=>({
    isValid() {
      return isFinite(self.x) && isFinite(self.y);
    }
  }))
  .actions(self => ({
    set(aPt:Point) {
      if (aPt) {
        self.x = aPt.x;
        self.y = aPt.y;
      }
    }
  }))
  .preProcessSnapshot(snapshot => {
    // Sometimes the snapshot is undefined. And in this case it is necessary
    // to return undefined. This happens when the Point model is referenced
    // by `prop: types.maybe(PointModel)`.
    // However, the MST type system isn't happy with returning undefined,
    // so we cast it to any to bypass the types.
    if (snapshot == null) return undefined as any;

    // When NaN is written out to JSON it will be converted to null,
    // So we need to convert it back to NaN. It would be better to avoid using
    // NaN in MST models, or use a primitive type other than the default
    // `types.number` which can handle NaN correctly.
    return {
      x: snapshot.x == null ? NaN : snapshot.x,
      y: snapshot.y == null ? NaN : snapshot.y
    };
  });
export interface IPointModel extends Instance<typeof PointModel> {}
export const kInfinitePoint = {x:NaN, y:NaN};

export interface IUpdateCategoriesOptions {
  xAxis?: IAxisModel
  xAttrId: string
  xCats: string[]
  yAxis?: IAxisModel
  yAttrId: string
  yCats: string[]
  topCats: string[]
  topAttrId: string
  rightCats: string[]
  rightAttrId: string
  resetPoints?: boolean
}

export const AdornmentModel = types.model("AdornmentModel", {
    id: types.optional(types.identifier, () => typedId("ADRN")),
    type: types.optional(types.string, () => {
      throw "type must be overridden";
    }),
    isVisible: true
  })
  .views(self => ({
    instanceKey(subPlotKey: Record<string, string>) {
      return JSON.stringify(subPlotKey);
    },
    classNameFromKey(subPlotKey: Record<string, string>) {
      let className = "";
      Object.entries(subPlotKey).forEach(([key, value]) => {
        const valueNoSpaces = value.replace(/\s+/g, "-");
        className += `${className ? "-" : ""}${key}-${valueNoSpaces}`;
      });
      return className;
    },
    /**
     * Return a list of numeric values for the given role that are contributed by this adornment.
     * This is used in auto-scaling the graph to ensure these values are visible.
     * Normally an empty list, but can be overridden by subclasses.
     */
    numericValuesForAttrRole(role: GraphAttrRole) {
      return [] as number[];
    },
    /**
     * Return a list of objects that can be used by the annotation layer.
     * Normally an empty list, but can be overridden by subclasses.
     * @param tileId The TileID is passed in since it is needed to create the IClueObject return values.
     */
    get annotatableObjects() {
      return [] as IClueTileObject[];
    },
    /**
     * Determine the position (in the graph's X/Y coordinate space) of the object with the given ID.
     * May return undefined if the type is not one this adornment handles, or if no such object ID exists.
     * @param type the annotatable object type
     * @param objectId ID of an annotatable object
     * @returns an {x, y} pair or undefined
     */
    getAnnotatableObjectPosition(type: string, objectId: string): Point|undefined {
      return undefined;
    },
    hasSelectedInstances() {
      // derived models should override to return true if they have selected instances
      return false;
    }
  }))
  .actions(self => ({
    setVisibility(isVisible: boolean) {
      self.isVisible = isVisible;
    },
    updateCategories(options: IUpdateCategoriesOptions) {
      // derived models should override to update their models when categories change
    },
    setSubPlotKey(options: IUpdateCategoriesOptions, index: number) {
      const { xAttrId, xCats, yAttrId, yCats, topAttrId, topCats, rightAttrId, rightCats } = options;
      const subPlotKey: Record<string, string> = {};
      if (topAttrId) subPlotKey[topAttrId] = topCats?.[index % topCats.length];
      if (rightAttrId) subPlotKey[rightAttrId] = rightCats?.[Math.floor(index / topCats.length)];
      if (yAttrId && yCats[0]) subPlotKey[yAttrId] = yCats?.[index % yCats.length];
      if (xAttrId && xCats[0]) subPlotKey[xAttrId] = xCats?.[index % xCats.length];
      return subPlotKey;
    },
    toggleSelected() {
      // derived models should override to toggle the selected state of an instance
    },
    deleteSelected() {
      // derived models should override to delete an instance when requested
    }
  }));
export interface IAdornmentModel extends Instance<typeof AdornmentModel> {}

export const UnknownAdornmentModel = AdornmentModel
  .named("UnknownAdornmentModel")
  .props({
    type: "Unknown"
  });
export interface IUnknownAdornmentModel extends Instance<typeof UnknownAdornmentModel> {}

export function isUnknownAdornmentModel(adornmentModel: IAdornmentModel): adornmentModel is IUnknownAdornmentModel {
  return adornmentModel.type === "Unknown";
}
