import { types, Instance } from "mobx-state-tree";

/**
 * This is the serializable version of IDocumentMetadata. It is almost the same. The one
 * important difference is the `properties` property.
 * In this MST model that property is an `observable.map<string, string>`.
 * In the IDocumentMetadata it is a Record<string,string>.
 */
export const DocumentMetadataModel = types.model("DocumentMetadata", {
  uid: types.string,
  type: types.string,
  key: types.identifier,
  createdAt: types.maybe(types.number),
  /**
   * If the document is a group document this is the id the group that owns the document.
   * If the document is not a group document this should be undefined because the group
   * of the user of the document might change and we don't want to store stale group ids,
   * or try to keep them all updated.
   */
  groupId: types.maybeNull(types.string),
  title: types.maybeNull(types.string),
  originDoc: types.maybeNull(types.string),
  properties: types.map(types.string),
  tools: types.array(types.string),
  strategies: types.array(types.string),
  investigation: types.maybeNull(types.string),
  problem: types.maybeNull(types.string),
  unit: types.maybeNull(types.string),
  visibility: types.maybeNull(types.string)
})
.views((self) => ({
  getProperty(key: string) {
    return self.properties.get(key);
  },
}));

export interface IDocumentMetadataModel extends Instance<typeof DocumentMetadataModel> {}
