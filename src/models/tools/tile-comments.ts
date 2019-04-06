import { types, Instance } from "mobx-state-tree";
import * as uuid from "uuid/v4";
import { boolean, ISimpleType } from "mobx-state-tree/dist/internal";

export const TileCommentModel = types
.model("TileComment", {
  key: types.optional(types.identifier, () => uuid()),
  uid: types.string,
  text: types.string,
  selectionInfo: types.maybe(types.string)
});
export type TileCommentModelType = Instance<typeof TileCommentModel>;

export const TileCommentsModel = types
  .model("TileComments", {
    comments: types.array(TileCommentModel),
    tileId: types.string
  })
  .volatile(self => ({
    visible: true
  }))
  .actions(self => ({
    setVisible(visible: boolean) {
      self.visible = visible;
    },

    addComment(comment: TileCommentModelType) {
      self.comments.push(comment);
    }
  }));

export type TileCommentsModelType = Instance<typeof TileCommentsModel>;
