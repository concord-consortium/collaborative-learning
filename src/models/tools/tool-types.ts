import { IAnyType, types } from "mobx-state-tree";
import { kGeometryToolID, GeometryContentModel, GeometryContentModelType,
          GeometryMetadataModel, GeometryMetadataModelType } from "./geometry/geometry-content";
import { kImageToolID, ImageContentModel, ImageContentModelType } from "./image/image-content";
import { kTableToolID, TableContentModel, TableContentModelType, TableToolMetadataModel } from "./table/table-content";
import { kTextToolID, TextContentModel, TextContentModelType } from "./text/text-content";
import { kUnknownToolID, UnknownContentModel, UnknownContentModelType } from "./unknown-content";
import { DrawingContentModelType, DrawingContentModel, kDrawingToolID,
          DrawingToolMetadataModel, DrawingToolMetadataModelType } from "./drawing/drawing-content";

export const ToolTypeEnum = types.enumeration(
                              "ToolTypes",
                              [
                                kGeometryToolID,
                                kImageToolID,
                                kTableToolID,
                                kTextToolID,
                                kDrawingToolID,
                                kUnknownToolID
                              ]);
export const ToolContentUnion = types.union(
                                  { dispatcher: toolFactory },
                                  GeometryContentModel,
                                  ImageContentModel,
                                  TableContentModel,
                                  TextContentModel,
                                  DrawingContentModel,
                                  UnknownContentModel);

export type ToolContentUnionType = GeometryContentModelType |
                                    ImageContentModelType |
                                    TableContentModelType |
                                    TextContentModelType |
                                    DrawingContentModelType |
                                    UnknownContentModelType;

export type ToolMetadataUnionType = GeometryMetadataModelType |
                                    DrawingToolMetadataModelType;

interface IToolMap {
  [id: string]: IAnyType;
}

interface IPrivate {
  toolMap: IToolMap;
  metadataMap: IToolMap;
  metadata: { [id: string]: ToolMetadataUnionType };
}

export const _private: IPrivate = {
  toolMap: {
    [kGeometryToolID]: GeometryContentModel,
    [kImageToolID]: ImageContentModel,
    [kTableToolID]: TableContentModel,
    [kTextToolID]: TextContentModel,
    [kDrawingToolID]: DrawingContentModel,
    [kUnknownToolID]: UnknownContentModel
  },

  metadataMap: {
    [kGeometryToolID]: GeometryMetadataModel,
    [kTableToolID]: TableToolMetadataModel,
    [kDrawingToolID]: DrawingToolMetadataModel
  },

  metadata: {}
};

export function isToolType(type: string) {
  return !!(type && _private.toolMap[type]);
}

export function toolFactory(snapshot: any) {
  const toolType: string | undefined = snapshot && snapshot.type;
  return toolType && _private.toolMap[toolType] || UnknownContentModel;
}

export function findMetadata(type: string, id: string) {
  const MetadataType = _private.metadataMap[type];
  if (!MetadataType) return;

  if (!_private.metadata[id]) {
    _private.metadata[id] = MetadataType.create({ id });
  }
  return _private.metadata[id];
}
