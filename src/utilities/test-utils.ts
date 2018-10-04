import * as ReactDOMServer from "react-dom/server";
import { DocumentContentSnapshotType } from "../models/document-content";
import { each, isObject, isUndefined, unset } from "lodash";

export const isUuid = (id: string) => {
  return /[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/.test(id);
};

// Recursively removes properties whose values are undefined.
// The specified object is modified in place and returned.
// cf. https://stackoverflow.com/a/37250225
export const omitUndefined = (obj: {}) => {
  each(obj, (v, k) => {
    if (isUndefined(v)) {
      unset(obj, k);
    }
    else if (isObject(v)) {
      omitUndefined(v);
    }
  });
  return obj;
};

export function createSingleTileContent(content: any): DocumentContentSnapshotType {
  const rowId = "row1";
  const tileId = "tile1";
  return {
    rowMap: {
      [rowId]: {
        id: rowId,
        tiles: [{ tileId }]
      }
    },
    rowOrder: [
      rowId
    ],
    tileMap: {
      [tileId]: {
        id: tileId,
        content
      }
    }
  };
}

export const logComponent = (component: JSX.Element) => {
  // tslint:disable-next-line:no-console
  console.log(ReactDOMServer.renderToStaticMarkup(component));
};
