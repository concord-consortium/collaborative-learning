import { JXGChange, JXGChangeAgent, JXGProperties } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { gImageMap } from "../../image-map";
import { assign } from "lodash";
import * as uuid from "uuid/v4";

export const isImage = (v: any) => v instanceof JXG.Image;

export const imageChangeAgent: JXGChangeAgent = {
  create: (board: JXG.Board, change: JXGChange) => {
    const parents = change.parents;
    const _props = change.properties && change.properties as JXGProperties;
    const url = _props && _props.url;
    const imageEntry = gImageMap.getCachedImage(url);
    const contentUrl = imageEntry && imageEntry.contentUrl && url;
    const props = assign({ id: uuid(), fixed: true },
                          change.properties, { url: contentUrl });
    return parents && parents.length >= 3
            ? board.create("image", change.parents, props)
            : undefined;
  },

  update: (board, change) => {
    if (!change.targetID || !change.properties) { return; }
    const ids = Array.isArray(change.targetID) ? change.targetID : [change.targetID];
    const props = Array.isArray(change.properties) ? change.properties : [change.properties];
    ids.forEach((id, index) => {
      const obj = board.objects[id] as JXG.GeometryElement;
      const image = isImage(obj) ? obj as JXG.Image : undefined;
      const objProps = index < props.length ? props[index] : props[0];
      if (image && objProps) {
        const { url, size } = objProps;
        const imageEntry = gImageMap.getCachedImage(url);
        const contentUrl = imageEntry && imageEntry.contentUrl && url;
        if (contentUrl) {
          image.url = contentUrl;
        }
        if (size != null) {
          image.setSize(size[0], size[1]);
        }
      }
    });
    // other properties can be handled generically
    objectChangeAgent.update(board, change);
  },

  // delete can be handled generically
  delete: objectChangeAgent.delete
};
