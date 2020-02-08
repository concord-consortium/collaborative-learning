import { JXGChange, JXGChangeAgent } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { gImageMap } from "../../image-map";
import { assign } from "lodash";
import uuid from "uuid/v4";

export const isImage = (v: any) => v instanceof JXG.Image;

export const imageChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const _board = board as JXG.Board;
    const parents = (change.parents || []).slice();
    const url = parents && parents[0] as string || "";
    const imageEntry = url && gImageMap.getCachedImage(url);
    const displayUrl = imageEntry && imageEntry.displayUrl || "";
    parents[0] = displayUrl;
    const props = assign({ id: uuid(), fixed: true }, change.properties);
    return parents && parents.length >= 3
            ? _board.create("image", parents, props)
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
        const displayUrl = imageEntry && imageEntry.displayUrl || "";
        if (displayUrl) {
          image.url = displayUrl;
        }
        if (size != null) {
          image.setSize(size[0], size[1]);
        }
      }
    });
    // other properties can be handled generically
    objectChangeAgent.update(board, change);
    return undefined;
  },

  // delete can be handled generically
  delete: objectChangeAgent.delete
};
