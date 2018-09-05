import { IAnyType, types } from "mobx-state-tree";
import { kGeometryToolID, GeometryToolModel } from "./geometry/geometry-tool";
import { kTableToolID, TableToolModel } from "./table/table-tool";
import { kTextToolID, TextToolModel } from "./text/text-tool";
import { UnknownToolModel } from "./unknown-tool";

export const ToolTypeUnion = types.union(
                              { dispatcher: toolFactory },
                              GeometryToolModel, TableToolModel, TextToolModel);

interface IPrivate {
  toolMap: { [id: string]: IAnyType };
}

export const _private: IPrivate = {
  toolMap: {
    [kGeometryToolID]: GeometryToolModel,
    [kTableToolID]: TableToolModel,
    [kTextToolID]: TextToolModel
  }
};

export function toolFactory(snapshot: any) {
  const toolType: string | undefined = snapshot.type;
  return toolType && _private.toolMap[toolType] || UnknownToolModel;
}
