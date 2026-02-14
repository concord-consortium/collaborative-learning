import { difference, intersection } from "lodash";
import { applySnapshot, getSnapshot, Instance, SnapshotIn, types } from "mobx-state-tree";
import { kDefaultBoardModelInputProps, kGeometryTileType } from "./geometry-types";
import { uniqueId } from "../../../utilities/js-utils";
import { typeField } from "../../../utilities/mst-utils";
import { ELabelOption, JXGPositionProperty } from "./jxg-changes";
import { kGeometryDefaultPixelsPerUnit } from "./jxg-types";
import { findLeastUsedNumber } from "../../../utilities/math-utils";
import { clueBasicDataColorInfo } from "../../../utilities/color-utils";
import { NavigatableTileModel } from "../navigatable-tile-model";

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
  },
  panByPixels(pixels: number) {
    self.min += pixels / self.unit;
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
    snapToGrid: types.maybe(types.boolean),
    colorScheme: 0,
    labelOption: types.optional(
      types.enumeration<ELabelOption>("LabelOption", Object.values(ELabelOption)),
      ELabelOption.kNone)
  })
  .preProcessSnapshot(preProcessPositionInSnapshot)
  .actions(self => ({
    setLabelOption(option: ELabelOption) {
      if (option !== self.labelOption) {
        self.labelOption = option;
      }
    },
    setName(name: string) {
      if (name !== self.name) {
        self.name = name;
      }
    },
    setColorScheme(colorScheme: number) {
      self.colorScheme = colorScheme;
    }
  }));
export interface PointModelType extends Instance<typeof PointModel> {}

export const isPointModel = (o?: GeometryObjectModelType): o is PointModelType => o?.type === "point";

/**
 * PointMetadata supplements the information about points that are stored in a DataSet.
 * The ID corresponds to the ID that we construct for the DataSet point,
 * and the metadata record holds labeling options. If no metadata record exists
 * for a given point, then default values are assumed.
 */
export const PointMetadataModel = types.model("PointMetadata", {
  id: types.identifier,
  name: types.maybe(types.string),
  labelOption: types.optional(
    types.enumeration<ELabelOption>("LabelOption", Object.values(ELabelOption)),
    ELabelOption.kNone)
})
.actions(self => ({
  setLabelOption(option: ELabelOption) {
    if (option !== self.labelOption) {
      self.labelOption = option;
    }
  },
  setName(name: string) {
    if (name !== self.name) {
      self.name = name;
    }
  }
}));

export interface PointMetadataModelType extends Instance<typeof PointMetadataModel> {}

/**
 * Circles are defined by a center point and a point that is somewhere on the circumference.
 * These are actual points which can be labeled, so the circle itself does not get a label.
 */
export const CircleModel = GeometryObjectModel
.named("CircleModel")
.props({
  type: typeField("circle"),
  centerPoint: types.string,
  tangentPoint: types.maybe(types.string),
  colorScheme: 0
})
.views(self => ({
  get dependencies(): string[] {
    if (self.tangentPoint) {
      return [self.centerPoint, self.tangentPoint];
    }
    return [self.centerPoint];
  }
}))
.actions(self => ({
  setColorScheme(colorScheme: number) {
    self.colorScheme = colorScheme;
  }
}));

export interface CircleModelType extends Instance<typeof CircleModel> {}

export const isCircleModel = (o?: GeometryObjectModelType): o is CircleModelType => o?.type === "circle";

// PolygonSegments are edges of polygons.
// Usually we don't need to know anything about them since they are defined by
// the polygon and its vertices. However, if they are labeled we store that
// information. The ID used is the concatenated IDs of the endpoints.

// We use a double colon separator since linked point IDs have a single colon in
// them. Besides these methods, also note the separator comes into play in
// `updateGeometryContentWithNewSharedModelIds`.

export const segmentIdFromPointIds = (ptIds: [string, string]) => `${ptIds[0]}::${ptIds[1]}`;
export const pointIdsFromSegmentId = (segmentId: string) => segmentId.split("::");

export const PolygonSegmentLabelModel = types.model("PolygonSegmentLabel", {
  id: types.identifier, // {pt1Id}::{pt2Id}
  option: types.enumeration<ELabelOption>("LabelOption", Object.values(ELabelOption)),
  name: types.maybe(types.string)
})
.preProcessSnapshot(snap => {
  // Previously a single colon was used as a separator.
  // If this is found, replace it with a double colon.
  // If the point IDs were from linked points, there would be 3 colons, and the middle one should be doubled.
  // Since it was previously not possible to make a polygon from a mixture of linked and unlinked points,
  // there should never be 2 ambiguous colons in legacy content.
  const id = snap.id;
  if (id.match(/::/)) {
    // Modern format, return as-is.
    return snap;
  }
  let newId = id;
  const colons = (id.match(/:/g) || []).length;
  if (colons === 1) {
    newId = id.replace(":", "::");
  } else if (colons === 3) {
    const parts = id.split(":");
    newId = parts[0] + ":" + parts[1] + "::" + parts[2] + ":" + parts[3];
  }
  return { ...snap, id: newId };
});

export interface PolygonSegmentLabelModelType extends Instance<typeof PolygonSegmentLabelModel> {}
export interface PolygonSegmentLabelModelSnapshot extends SnapshotIn<typeof PolygonSegmentLabelModel> {}

export const PolygonModel = GeometryObjectModel
  .named("PolygonModel")
  .props({
    type: typeField("polygon"),
    points: types.array(types.string),
    labelOption: types.optional(
      types.enumeration<ELabelOption>("LabelOption", Object.values(ELabelOption)),
      ELabelOption.kNone),
    name: types.maybe(types.string),
    labels: types.maybe(types.array(PolygonSegmentLabelModel)),
    colorScheme: 0
  })
  .views(self => ({
    get dependencies(): string[] {
      return self.points;
    },
    get segmentIds(): string[] {
      const segmentIds: string[] = [];
      self.points.forEach((point, index) => {
        const otherPointIndex = index < self.points.length - 1 ? index+1 : 0;
        segmentIds.push(segmentIdFromPointIds([point, self.points[otherPointIndex]]));
      });
      return segmentIds;
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
      self.points.replace(difference(self.points, ids));
    },
    replacePoints(ids: string[]) {
      self.points.replace(ids);
    },
    setSegmentLabel(ptIds: [string, string], option: ELabelOption, name: string|undefined) {
      const id = segmentIdFromPointIds(ptIds);
      const value = { id, option, name };
      const foundIndex = self.labels?.findIndex(label => label.id === id);
      // remove any existing label if setting label to "none"
      if (option === ELabelOption.kNone) {
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
    },
    setColorScheme(colorScheme: number) {
      self.colorScheme = colorScheme;
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

/**
 * Lines are defined by two points. The line extends infinitely through both points,
 * displayed with arrows at the board edges. Unlike MovableLine, this uses shared points
 * from the point system and supports colorScheme like polygons and circles.
 */
export const LineModel = GeometryObjectModel
  .named("LineModel")
  .props({
    type: typeField("line"),
    point1: types.string,
    point2: types.maybe(types.string),
    colorScheme: 0,
    labelOption: types.optional(
      types.enumeration<ELabelOption>("LabelOption", Object.values(ELabelOption)),
      ELabelOption.kNone),
    name: types.maybe(types.string)
  })
  .views(self => ({
    get dependencies(): string[] {
      if (self.point2) {
        return [self.point1, self.point2];
      }
      return [self.point1];
    }
  }))
  .actions(self => ({
    setColorScheme(colorScheme: number) {
      self.colorScheme = colorScheme;
    },
    setLabelOption(option: ELabelOption) {
      if (option !== self.labelOption) {
        self.labelOption = option;
      }
    },
    setName(name: string) {
      if (name !== self.name) {
        self.name = name;
      }
    }
  }));

export interface LineModelType extends Instance<typeof LineModel> {}

export const isLineModel = (o?: GeometryObjectModelType): o is LineModelType => o?.type === "line";

export const MovableLineModel = GeometryObjectModel
  .named("MovableLineModel")
  .props({
    type: typeField("movableLine"),
    p1: PointModel,
    p2: PointModel,
    colorScheme: 0
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

export type GeometryObjectModelUnion = CircleModelType | CommentModelType | ImageModelType | LineModelType |
                                       MovableLineModelType | PointModelType | PolygonModelType |
                                       VertexAngleModelType;

// Define the shape of the geometry content without the views/actions, etc. to avoid circular references
export const GeometryBaseContentModel = NavigatableTileModel
  .named("GeometryBaseContent")
  .props({
    type: types.optional(types.literal(kGeometryTileType), kGeometryTileType),
    board: types.maybe(BoardModel),
    bgImage: types.maybe(ImageModel),
    objects: types.map(types.union(
      CircleModel, CommentModel, LineModel, MovableLineModel, PointModel, PolygonModel, VertexAngleModel)),
    pointMetadata: types.map(PointMetadataModel),
    // Maps attribute ID to color.
    linkedAttributeColors: types.map(types.number),
    // Used for importing table links from legacy documents
    links: types.array(types.string)  // table tile ids
  })
  .volatile(self => ({
    // This is the point that tracks the mouse pointer when you're in a shape-creation mode.
    phantomPoint: undefined as PointModelType|undefined,
    // In polygon mode, the phantom point is considered to be part of an in-progress polygon.
    activePolygonId: undefined as string|undefined,
    // In circle mode, the phantom point is used to construct a cirlce
    activeCircleId: undefined as string|undefined,
    // In line mode, the phantom point is used to construct an infinite line
    activeLineId: undefined as string|undefined
  }))
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
  .views(self => ({
    getColorSchemeForAttributeId(id: string) {
      return self.linkedAttributeColors.get(id);
    },
    /**
     * Return the name and labelOption for a given point.
     * If this is a regular point, these values are stored in the Point object.
     * If it is a linked point, they are stored in pointMetadata,
     * or default values are used if no record is found in either place.
     * @param id
     * @returns an object with "name" and "labelOption" properties
     */
    getPointLabelProps(id: string) {
      const object = self.objects.get(id);
      if (isPointModel(object)) {
        return { name: object.name, labelOption: object.labelOption };
      }
      const metadata = self.pointMetadata.get(id);
      if (metadata) {
        return { name: metadata.name, labelOption: metadata.labelOption };
      }
      return { name: "", labelOption: ELabelOption.kNone };
    }
  }))
  .actions(self => ({
    replaceLinks(newLinks: string[]) {
      self.links.replace(newLinks);
    },
    assignColorSchemeForAttributeId(id: string) {
      if (self.linkedAttributeColors.get(id)) {
        return self.linkedAttributeColors.get(id);
      }
      const color = findLeastUsedNumber(clueBasicDataColorInfo.length, self.linkedAttributeColors.values());
      self.linkedAttributeColors.set(id, color);
      return color;
    },
    /**
     * Sets the name and labelOption properties in the correct place for the point.
     * If this is a regular point, these values are stored in the Point object.
     * If it is a linked point, they are stored in pointMetadata. A new metadata record
     * will be created if necessary.
     * @param id
     * @param name
     * @param labelOption
     */
    setPointLabelProps(id: string, name: string, labelOption: ELabelOption) {
      const object = self.objects.get(id);
      if (isPointModel(object)) {
        object.setName(name);
        object.setLabelOption(labelOption);
        return;
      }
      const metadata = self.pointMetadata.get(id);
      if (metadata) {
        metadata.setName(name);
        metadata.setLabelOption(labelOption);
      } else {
        self.pointMetadata.put(PointMetadataModel.create({ id, name, labelOption }));
      }
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
  if (isLineModel(obj)) {
    const point1 = idMap[obj.point1];
    const point2 = obj.point2 ? idMap[obj.point2] : undefined;
    if (point1 && (!obj.point2 || point2)) {
      return LineModel.create({ ...obj, id, point1, point2 });
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
