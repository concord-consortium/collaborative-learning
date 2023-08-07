import { difference, intersection } from "lodash";
import { applySnapshot, getSnapshot, getType, Instance, SnapshotIn, types } from "mobx-state-tree";
import { kDefaultBoardModelInputProps, kGeometryTileType } from "./geometry-types";
import { uniqueId } from "../../../utilities/js-utils";
import { typeField } from "../../../utilities/mst-utils";
import { TileContentModel } from "../tile-content";
import { ESegmentLabelOption, JXGChange, JXGPositionProperty } from "./jxg-changes";
import { imageChangeAgent } from "./jxg-image";
import { movableLineChangeAgent } from "./jxg-movable-line";
import { createPoint } from "./jxg-point";
import { polygonChangeAgent } from "./jxg-polygon";
import { vertexAngleChangeAgent } from "./jxg-vertex-angle";
import { kGeometryDefaultPixelsPerUnit } from "./jxg-types";

export interface IDependsUponResult {
  depends: boolean;
  dependencies: string[];
  required: boolean;
}

export interface IAxisProperties {
  name?: string;
  label?: string;
  min?: number;
  unit?: number;
  range?: number;
}

export const AxisModel = types.model("AxisModel", {
  name: types.maybe(types.string),
  label: types.maybe(types.string),
  min: types.number,
  unit: kGeometryDefaultPixelsPerUnit,
  range: types.maybe(types.number)
})
.actions(self => ({
  setName(name: string) {
    self.name = name;
  },
  setLabel(label: string) {
    self.label = label;
  },
  setMin(min: number) {
    self.min = min;
  },
  setUnit(unit: number) {
    self.unit = unit;
  },
  setRange(range: number) {
    self.range = range;
  }
}));
export interface AxisModelType extends Instance<typeof AxisModel> {}
export interface AxisModelSnapshot extends SnapshotIn<typeof AxisModel> {}

export const BoardModel = types.model("BoardModel", {
  xAxis: AxisModel,
  yAxis: AxisModel
});
export interface BoardModelType extends Instance<typeof BoardModel> {}

export const defaultBoard = () => BoardModel.create(kDefaultBoardModelInputProps);

export const GeometryObjectModel = types.model("GeometryObject", {
  type: types.optional(types.string, () => {throw "Type must be overridden";}),
  id: types.optional(types.identifier, () => uniqueId())
})
.views(self => ({
  get dependencies(): string[] {
    return [];
  }
}))
.views(self => ({
  dependsUpon(ids: string[]): IDependsUponResult {
    const dependencies = intersection(ids, self.dependencies);
    // by default all dependencies are required, i.e. object should be deleted if dependent is deleted
    const depCount = dependencies.length;
    return { depends: depCount > 0, dependencies, required: depCount > 0 };
  }
}))
.actions(self => ({
  setPosition(position: JXGPositionProperty) {
    // ignored by base model
  },
  setText(text: string) {
    // ignored by base model
  },
  removeDependencies(ids: string[]) {
    // ignored by base model
  }
}));
export interface GeometryObjectModelType extends Instance<typeof GeometryObjectModel> {}

// JSON.stringify converts undefined to null, which is invalid for position values.
// This function, suitable for use as a preProcessSnapshot handler, converts null
// position values back to undefined. One might think that one could handle this with a
// single preProcessSnapshot handler on the PositionedObjectModel, but that changes the
// types of the models in ways that breaks the build. ¯\_(ツ)_/¯ Therefore, we reuse
// this function in each final model that "derives" from PositionedObjectModel.
function preProcessPositionInSnapshot(snap: any) {
  return snap?.x === null || snap?.y === null
    ? {
        ...snap,
        // convert nulls to undefined
        x: snap.x ?? undefined,
        y: snap.y ?? undefined
      }
    : snap;
  }

export const PositionedObjectModel = GeometryObjectModel
  .named("PositionedObject")
  .props({
    x: types.maybe(types.number),
    y: types.maybe(types.number)
  })
  .actions(self => ({
    setPosition(position: JXGPositionProperty) {
      const x = position[position.length - 2];
      const y = position[position.length - 1];
      (x != null) && (self.x = x);
      (y != null) && (self.y = y);
    }
  }));
export interface PositionedObjectModelType extends Instance<typeof PositionedObjectModel> {}

export const isPositionedObjectModel = (o: GeometryObjectModelType): o is PositionedObjectModelType =>
  Object.hasOwn(o, "x") && Object.hasOwn(o, "y");

export const CommentModel = PositionedObjectModel
  .named("CommentModel")
  .props({
    type: typeField("comment"),
    // multiple anchors to support polygon line segment comments, for instance
    anchors: types.array(types.string), // ids of anchor objects
    text: types.maybe(types.string)
  })
  .preProcessSnapshot(preProcessPositionInSnapshot)
  .views(self => ({
    get dependencies(): string[] {
      return self.anchors;
    }
  }))
  .actions(self => ({
    setText(text: string) {
      self.text = text;
    }
  }));
export interface CommentModelType extends Instance<typeof CommentModel> {}

export const isCommentModel = (o?: GeometryObjectModelType): o is CommentModelType => o?.type === "comment";

export const PointModel = PositionedObjectModel
  .named("PointModel")
  .props({
    type: typeField("point"),
    name: types.maybe(types.string),
    fillColor: types.maybe(types.string),
    strokeColor: types.maybe(types.string),
    snapToGrid: types.maybe(types.boolean),
    snapSizeX: types.maybe(types.number),
    snapSizeY: types.maybe(types.number)
  })
  .preProcessSnapshot(preProcessPositionInSnapshot);
export interface PointModelType extends Instance<typeof PointModel> {}

export const isPointModel = (o?: GeometryObjectModelType): o is PointModelType => o?.type === "point";

export const segmentIdFromPointIds = (ptIds: [string, string]) => `${ptIds[0]}:${ptIds[1]}`;
export const pointIdsFromSegmentId = (segmentId: string) => segmentId.split(":");

export const PolygonSegmentLabelModel = types.model("PolygonSegmentLabel", {
  id: types.identifier, // {pt1Id}:{pt2Id}
  option: types.enumeration<ESegmentLabelOption>("LabelOption", Object.values(ESegmentLabelOption))
});
export interface PolygonSegmentLabelModelType extends Instance<typeof PolygonSegmentLabelModel> {}
export interface PolygonSegmentLabelModelSnapshot extends SnapshotIn<typeof PolygonSegmentLabelModel> {}

export const PolygonModel = GeometryObjectModel
  .named("PolygonModel")
  .props({
    type: typeField("polygon"),
    points: types.array(types.string),
    labels: types.maybe(types.array(PolygonSegmentLabelModel))
  })
  .views(self => ({
    get dependencies(): string[] {
      return self.points;
    },
    hasSegmentLabel(ptIds: [string, string]) {
      return !!self.labels?.find(label => label.id === segmentIdFromPointIds(ptIds));
    },
    getSegmentLabel(ptIds: [string, string]) {
      const found = self.labels?.find(label => label.id === segmentIdFromPointIds(ptIds));
      return found ? found.option : undefined;
    }
  }))
  .views(self => ({
    dependsUpon(ids: string[]): IDependsUponResult {
      const dependencies = intersection(ids, self.dependencies);
      // points can be removed from polygons until there are at least two vertices remaining
      const depCount = dependencies.length;
      return { depends: depCount > 0, dependencies, required: depCount > self.points.length - 2 };
    }
  }))
  .actions(self => ({
    removeDependencies(ids: string[]) {
      console.log("GeometryModel> removeDependencies:", self.points, ids);
      self.points.replace(difference(self.points, ids));
    },
    replacePoints(ids: string[]) {
      self.points.replace(ids);
    },
    setSegmentLabel(ptIds: [string, string], option: ESegmentLabelOption) {
      const id = segmentIdFromPointIds(ptIds);
      const value = { id, option };
      const foundIndex = self.labels?.findIndex(label => label.id === id);
      // remove any existing label if setting label to "none"
      if (option === ESegmentLabelOption.kNone) {
        if (self.labels && foundIndex != null && foundIndex >= 0) {
          self.labels.splice(foundIndex, 1);
        }
      }
      // replace the label if the segment is already labeled
      else if (self.labels && foundIndex != null && foundIndex >= 0) {
        self.labels[foundIndex] = value;
      }
      else if (!self.labels) {
        // TODO: there must be a more efficient way to initialize an MST array
        applySnapshot(self, { ...getSnapshot(self), labels: [value] });
      }
      else {
        self.labels.push(value);
      }
    }
  }));
export interface PolygonModelType extends Instance<typeof PolygonModel> {}

export const isPolygonModel = (o?: GeometryObjectModelType): o is PolygonModelType => o?.type === "polygon";

export const VertexAngleModel = GeometryObjectModel
  .named("VertexAngleModel")
  .props({
    type: typeField("vertexAngle"),
    points: types.refinement(types.array(types.string), v => v?.length === 3),
    radius: types.maybe(types.number)
  })
  .views(self => ({
    get dependencies(): string[] {
      return self.points;
    }
  }))
  .actions(self => ({
    replacePoints(ids: string[]) {
      self.points.replace(ids);
    }
  }));
export interface VertexAngleModelType extends Instance<typeof VertexAngleModel> {}

export const isVertexAngleModel = (o?: GeometryObjectModelType): o is VertexAngleModelType =>
  o?.type === "vertexAngle";

export const MovableLineModel = GeometryObjectModel
  .named("MovableLineModel")
  .props({
    type: typeField("movableLine"),
    p1: PointModel,
    p2: PointModel
  });
export interface MovableLineModelType extends Instance<typeof MovableLineModel> {}

export const isMovableLineModel = (o?: GeometryObjectModelType): o is MovableLineModelType =>
  o?.type === "movableLine";

export const isMovableLinePointId = (id: string) => /.*-point[12]/.test(id);

export const ImageModel = PositionedObjectModel
  .named("ImageModel")
  .props({
    type: typeField("image"),
    url: types.string,
    filename: types.maybe(types.string),
    width: types.number,  // coordinate system size (not pixels)
    height: types.number  // coordinate system size (not pixels)
  })
  .preProcessSnapshot(preProcessPositionInSnapshot)
  .actions(self => ({
    setUrl(url: string) {
      self.url = url;
    }
  }));
export interface ImageModelType extends Instance<typeof ImageModel> {}
export const isImageModel = (o: GeometryObjectModelType): o is ImageModelType => o.type === "image";

export function createObject(board: JXG.Board, obj: GeometryObjectModelType) {
  const objType = getType(obj);
  switch(objType.name) {

    case ImageModel.name: {
      const image = obj as ImageModelType;
      const { x, y, url, width, height, ...properties } = image;
      const change: JXGChange = {
        operation: "create",
        target: "image",
        parents: [url, [x, y], [width, height]],
        properties
      };
      imageChangeAgent.create(board, change);
      break;
    }

    case MovableLineModel.name: {
      const line = obj as MovableLineModelType;
      const { p1, p2, ...properties } = line;
      const change: JXGChange = {
        operation: "create",
        target: "movableLine",
        parents: [[p1.x, p1.y], [p2.x, p2.y]],
        properties
      };
      movableLineChangeAgent.create(board, change);
      break;
    }

    case PointModel.name: {
      const pt = obj as PointModelType;
      const { x, y, ...props } = pt;
      createPoint(board, [pt.x, pt.y], props);
      break;
    }

    case PolygonModel.name: {
      const poly = obj as PolygonModelType;
      const { points, ...properties } = poly;
      const change: JXGChange = {
        operation: "create",
        target: "polygon",
        parents: poly.points.filter(id => !!id) as string[],
        properties
      };
      polygonChangeAgent.create(board, change);
      break;
    }

    case VertexAngleModel.name: {
      const angle = obj as VertexAngleModelType;
      const { points, ...properties } = angle;
      const change: JXGChange = {
        operation: "create",
        target: "vertexAngle",
        parents: angle.points.filter(id => !!id) as string[],
        properties
      };
      vertexAngleChangeAgent.create(board, change);
      break;
    }

  }
}

export type GeometryObjectModelUnion = CommentModelType | ImageModelType | MovableLineModelType | PointModelType |
                                        PolygonModelType | VertexAngleModelType;

// Define the shape of the geometry content without the views/actions, etc. to avoid circular references
export const GeometryBaseContentModel = TileContentModel
  .named("GeometryBaseContent")
  .props({
    type: types.optional(types.literal(kGeometryTileType), kGeometryTileType),
    board: types.maybe(BoardModel),
    bgImage: types.maybe(ImageModel),
    objects: types.map(types.union(CommentModel, MovableLineModel, PointModel, PolygonModel, VertexAngleModel)),
    // Used for importing table links from legacy documents
    links: types.array(types.string)  // table tile ids
  })
  .preProcessSnapshot(snapshot => {
    // fix null table links ¯\_(ツ)_/¯
    if (snapshot.links?.some(link => link == null)) {
      snapshot = { ...snapshot, links: snapshot.links.filter(link => link != null) };
    }
    if (!snapshot.board) {
      return { ...snapshot, board: defaultBoard() };
    }
    return snapshot;
  })
  .postProcessSnapshot(snapshot => {
    // Remove links from snapshot
    const { links, ...rest } = snapshot;
    return { ...rest };
  })
  .actions(self => ({
    replaceLinks(newLinks: string[]) {
      self.links.replace(newLinks);
    }
  }));
export interface GeometryBaseContentModelType extends Instance<typeof GeometryBaseContentModel> {}
export interface GeometryBaseContentSnapshotType extends Instance<typeof GeometryBaseContentModel> {}

export const MigratedExtrasModel = types.model("MigratedExtras", {
  extras: types.maybe(types.model("Extras", { title: types.maybe(types.string) }))
});

// Allow additional information to be returned from imports
export const GeometryExtrasContentModel = types.compose(
  "GeometryExtraContent", GeometryBaseContentModel, MigratedExtrasModel);
export interface GeometryExtrasContentModelType extends Instance<typeof GeometryExtrasContentModel> {}
export interface GeometryExtrasContentSnapshotType extends SnapshotIn<typeof GeometryExtrasContentModel> {}

interface ICloneGeometryObjectOptions {
  idMap: Record<string, string>;
  offset?: {
    x: number;
    y: number;
  };
}
export function cloneGeometryObject(
  obj: GeometryObjectModelType, options: ICloneGeometryObjectOptions
): GeometryObjectModelType | undefined {
  const { idMap, offset } = options || {};
  const id = idMap[obj.id] || uniqueId();

  function offsetPos(o: GeometryObjectModelType) {
    return isPositionedObjectModel(o) && o.x != null && o.y != null && offset
            ? { x: o.x + offset.x, y: o.y + offset.y }
            : undefined;
  }

  if (isPointModel(obj)) {
    return PointModel.create({ ...obj, id, ...offsetPos(obj) });
  }
  if (isPolygonModel(obj)) {
    const points = obj.points.map(ptId => idMap[ptId]);
    const _labels = obj.labels?.map(label => {
      const [p1Id, p2Id] = pointIdsFromSegmentId(label.id);
      return { ...label, id: `${segmentIdFromPointIds([idMap[p1Id], idMap[p2Id]])}`, };
    });
    const labels = _labels ? { labels: _labels } : undefined;
    // all vertices must be selected/copied to copy a polygon
    if (points.every(ptId => !!ptId)) {
      return PolygonModel.create({ ...obj, id, points, ...labels });
    }
  }
  if (isVertexAngleModel(obj)) {
    const points = obj.points.map(ptId => idMap[ptId]);
    // all vertices must be selected/copied to copy a vertexAngle
    if (points.every(ptId => !!ptId)) {
      return VertexAngleModel.create({ ...obj, id, points });
    }
  }
  if (isMovableLineModel(obj)) {
    const { id: _id, p1, p2, ...others } = obj;
    const _p1 = PointModel.create({ ...p1, id: `${id}-point1`, ...offsetPos(p1) });
    const _p2 = PointModel.create({ ...p2, id: `${id}-point2`, ...offsetPos(p2) });
    return MovableLineModel.create({ ...others, id, p1: _p1, p2: _p2 });
  }
  if (isCommentModel(obj)) {
    const anchors = obj.anchors.map(anchorId => idMap[anchorId]);
    if (anchors.every(srcId => !!srcId)) {
      return CommentModel.create({ ...obj, id, anchors });
    }
  }
}
