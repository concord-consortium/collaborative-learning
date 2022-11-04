import { types, Instance } from "mobx-state-tree";
import { v4 as uuid } from "uuid";

export const TileCommentModel = types
.model("TileComment", {
  key: types.optional(types.identifier, () => uuid()),
  uid: types.string,
  text: types.string,
  selectionInfo: types.maybe(types.string),
  deleted: false
})
.actions(self  => ({
  delete() {
    self.deleted = true;
  }
}));
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
    },

    getCommentAtIndex(index: number) {
      return self.comments[index];
    }
  }));

export type TileCommentsModelType = Instance<typeof TileCommentsModel>;
