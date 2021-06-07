import { comma, safeJsonParse } from "../../../utilities/js-utils";
import { DrawingObjectDataType } from "./drawing-objects";
import { DrawingToolChange } from "./drawing-types";

export interface IDrawingObjectInfo {
  id: string;
  type: DrawingObjectDataType["type"];
  changes: DrawingToolChange[]; // changes that affect this object
  isDeleted?: boolean;          // true if the object has been deleted
}

export const exportDrawingTileSpec = (changes: string[]) => {
  const objectInfoMap: Record<string, IDrawingObjectInfo> = {};
  const orderedIds: string[] = [];
  const lines: string[] = [];

  const isExportable = (id: string) => {
    const objInfo = objectInfoMap[id];
    return !!objInfo && !objInfo.isDeleted;
  };

  const pushLine = (line: string, indent: number) => {
    let space = "";
    for (; space.length < indent; space += " ");
    lines.push(space + line);
  };

  const exportObject = (id: string, isLast: boolean) => {
    const objInfo = objectInfoMap[id];
    let data = { ...objInfo.changes[0].data } as DrawingObjectDataType;
    for (let i = 1; i < objInfo.changes.length; ++i) {
      const change = objInfo.changes[i];
      switch (change.action) {
        case "move":
          change.data.forEach(move => {
            if (move.id === id) {
              data = { ...data, x: move.destination.x , y: move.destination.y };
            }
          });
          break;
        case "update": {
          const { ids, update: { prop, newValue }} = change.data;
          ids.forEach(_id => {
            if (_id === id) {
              (data as any)[prop] = newValue;
            }
          });
          break;
        }
      }
    }
    const { id: idData, type, ...others } = data;
    const othersJson = JSON.stringify(others);
    const othersStr = othersJson.slice(1, othersJson.length - 1);
    pushLine(`{ "type": "${objInfo.type}", "id": "${id}", ${othersStr} }${comma(!isLast)}`, 4);
  };

  const exportObjects = () => {
    pushLine(`"objects": [`, 2);
    let lastExportedId: string;
    orderedIds.forEach(id => {
      if (isExportable(id)) {
        lastExportedId = id;
      }
    });
    orderedIds.forEach(id => {
      if (isExportable(id)) {
        exportObject(id, id === lastExportedId);
      }
    });
    pushLine(`]`, 2);
  };

  // loop through each change, adding it to the set of changes that affect each object
  changes.forEach(changeJson => {
    const change = safeJsonParse<DrawingToolChange>(changeJson);
    if (change) {
      switch (change.action) {
        case "create": {
          const { id, type  } = change.data;
          if (id) {
            objectInfoMap[id] = { id, type, changes: [change] };
            orderedIds.push(id);
          }
          break;
        }
        case "update": {
          const { ids } = change.data;
          ids.forEach(id => {
            const objInfo = objectInfoMap[id];
            objInfo && objInfo.changes.push(change);
          });
          break;
        }
        case "move": {
          change.data.forEach(move => {
            const objInfo = objectInfoMap[move.id];
            objInfo && objInfo.changes.push(change);
          });
          break;
        }
        case "delete":{
          change.data.forEach(id => {
            const objInfo = objectInfoMap[id];
            if (objInfo) {
              objInfo.changes.push(change);
              objInfo.isDeleted = true;
            }
          });
          break;
        }
      }
    }
  });

  pushLine(`"type": "Drawing",`, 2);
  exportObjects();
  return [
    `{`,
    ...lines,
    `}`
  ].join("\n");
};
