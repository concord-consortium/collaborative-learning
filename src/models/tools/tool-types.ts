import { IAnyType, types } from "mobx-state-tree";
import { kGeometryToolID, GeometryContentModel } from "./geometry/geometry-content";
import { kRichTextToolID, RichTextContentModel } from "./rich-text/rich-text-content";
import { kTableToolID, TableContentModel } from "./table/table-content";
import { kTextToolID, TextContentModel } from "./text/text-content";
import { kImageToolID, ImageContentModel } from "./image/image-content";
import { kUnknownToolID, UnknownContentModel } from "./unknown-content";

export const ToolTypeEnum = types.enumeration(
                              "ToolTypes",
                              [
                                kGeometryToolID,
                                kRichTextToolID,
                                kTableToolID,
                                kTextToolID,
                                kImageToolID,
                                kUnknownToolID
                              ]);
export const ToolContentUnion = types.union(
                                  { dispatcher: toolFactory },
                                  GeometryContentModel,
                                  RichTextContentModel,
                                  TableContentModel,
                                  TextContentModel,
                                  ImageContentModel,
                                  UnknownContentModel);

interface IToolMap {
  [id: string]: IAnyType;
}

interface IPrivate {
  toolMap: IToolMap;
}

export const _private: IPrivate = {
  toolMap: {
    [kGeometryToolID]: GeometryContentModel,
    [kRichTextToolID]: RichTextContentModel,
    [kTableToolID]: TableContentModel,
    [kTextToolID]: TextContentModel,
    [kImageToolID]: ImageContentModel,
    [kUnknownToolID]: UnknownContentModel
  }
};

export function isToolType(type: string) {
  return !!(type && _private.toolMap[type]);
}

export function toolFactory(snapshot: any) {
  const toolType: string | undefined = snapshot && snapshot.type;
  return toolType && _private.toolMap[toolType] || UnknownContentModel;
}
