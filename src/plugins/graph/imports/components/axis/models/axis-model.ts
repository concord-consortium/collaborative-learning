import {Instance, isAlive, SnapshotIn, types} from "mobx-state-tree";
import { kDefaultNumericAxisBounds } from "../../../../graph-types";
import {AxisOrientation, AxisPlaces, IScaleType, ScaleTypes} from "../axis-types";

export const AxisModel = types.model("AxisModel", {
  type: types.optional(types.string, () => {
    throw "type must be overridden";
  }),
  place: types.enumeration([...AxisPlaces]),
  scale: types.optional(types.enumeration([...ScaleTypes]), "ordinal"),
})
  .volatile(self => ({
    transitionDuration: 0
  }))
  .views(self => ({
    get orientation(): AxisOrientation {
      return ['left', 'rightCat', 'rightNumeric'].includes(self.place)
        ? "vertical" : "horizontal";
    },
    get isNumeric() {
      return self.type === "numeric";
    },
    get isCategorical() {
      return self.type === "categorical";
    }
  }))
  .actions(self => ({
    setScale(scale: IScaleType) {
      self.scale = scale;
    },
    setTransitionDuration(duration: number) {
      self.transitionDuration = duration;
    }
  }));

export interface IAxisModel extends Instance<typeof AxisModel> {
}

export const EmptyAxisModel = AxisModel
  .named("EmptyAxisModel")
  .props({
    type: "empty",
    min: 0,
    max: 0
  });
export interface IEmptyAxisModel extends Instance<typeof EmptyAxisModel> {}
export interface IEmptyAxisModelSnapshot extends SnapshotIn<typeof EmptyAxisModel> {}

export function isEmptyAxisModel(axisModel?: IAxisModel): axisModel is IEmptyAxisModel {
  return axisModel?.type === "empty";
}

export const CategoricalAxisModel = AxisModel
  .named("CategoricalAxisModel")
  .props({
    type: "categorical",
    scale: "band"
  });
export interface ICategoricalAxisModel extends Instance<typeof CategoricalAxisModel> {}
export interface ICategoricalAxisModelSnapshot extends SnapshotIn<typeof CategoricalAxisModel> {}

export function isCategoricalAxisModel(axisModel?: IAxisModel): axisModel is ICategoricalAxisModel {
  return !!axisModel?.isCategorical;
}

export const NumericAxisModel = AxisModel
  .named("NumericAxisModel")
  .props({
    type: "numeric",
    scale: types.optional(types.enumeration([...ScaleTypes]), "linear"),
    min: types.number,
    max: types.number
  })
  .views(self => ({
    get domain() {
      // TODO: figure out why this is sometimes called on defunct objects during linking, etc.
      if (isAlive(self)) return [self.min, self.max] as const;
      console.warn("NumericAxisModel.domain", "attempt to access defunct axis model domain");
      return kDefaultNumericAxisBounds;
    }
  }))
  .actions(self => ({
    setMin(value: number){
      self.min = value;
    },
    setMax(value: number){
      self.max = value;
    },
    setDomain(min: number, max: number) {
      // Clean NaNs since they will make the document crash
      if (!isFinite(min) || !isFinite(max)) {
        console.warn('NumericAxisModel.setDomain called with non-numeric arg(s):', min, max);
        min=kDefaultNumericAxisBounds[0];
        max=kDefaultNumericAxisBounds[1];
      }
      // If we're close enough to zero on either end, we snap to it
      const snapFactor = 100;
      if ((max > 0) && (Math.abs(min) <= max / snapFactor)) {
        min = 0;
      } else if ((min < 0) && (Math.abs(max) < Math.abs(min / snapFactor))) {
        max = 0;
      }
      // Truncate to 2 decimal digits, but without making the range smaller
      self.min = Math.floor(min*100)/100;
      self.max = Math.ceil(max*100)/100;
    }
  }));
export interface INumericAxisModel extends Instance<typeof NumericAxisModel> {}
export interface INumericAxisModelSnapshot extends SnapshotIn<typeof NumericAxisModel> {}

export function isNumericAxisModel(axisModel?: IAxisModel): axisModel is INumericAxisModel {
  return !!axisModel?.isNumeric;
}

const axisTypeDispatcher = (axisSnap: any) => {
  switch (axisSnap.type) {
    case "categorical": return CategoricalAxisModel;
    case "numeric": return NumericAxisModel;
    default: return EmptyAxisModel;
  }
};

export const AxisModelUnion = types.union({ dispatcher: axisTypeDispatcher },
  EmptyAxisModel, CategoricalAxisModel, NumericAxisModel);
export type IAxisModelUnion = IEmptyAxisModel | ICategoricalAxisModel | INumericAxisModel;
export type IAxisModelSnapshotUnion =
  IEmptyAxisModelSnapshot | ICategoricalAxisModelSnapshot | INumericAxisModelSnapshot;
