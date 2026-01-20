import { types, Instance, SnapshotIn } from "mobx-state-tree";
import { IDocumentMetadata } from "../../../shared/shared";

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
  properties: types.map(types.union(types.string, types.number)),
  tools: types.array(types.string),
  strategies: types.array(types.string),
  investigation: types.maybeNull(types.string),
  problem: types.maybeNull(types.string),
  unit: types.maybeNull(types.string),
  visibility: types.maybeNull(types.string),
  lastHistoryEntry: types.maybeNull(types.model({
    id: types.string,
    index: types.number,
  })),
})
.views((self) => ({
  get propertiesAsStringRecord(): Record<string, string> {
    const record: Record<string, string> = {};
    self.properties.forEach((value, key) => {
      record[key] = String(value);
    });
    return record;
  },
  /**
   * In the database there can be properties with numeric values.
   * For consistency with the other document types we always return these as Strings.
   * @param key
   */
  getProperty(key: string) {
    const value = self.properties.get(key);
    if (value === undefined) {
      return undefined;
    }
    return String(value);
  },
}));

export interface IDocumentMetadataModel extends Instance<typeof DocumentMetadataModel> {}

// Compile-time checks that IDocumentMetadataModel is compatible with IDocumentMetadata.
// The `properties` field is omitted because the model uses an observable map while
// the interface uses Record<string, string>.

/**
 * Check the basic compatibility between IDocumentMetadataModel and IDocumentMetadata.
 * Since many of the properties are optional, this check mainly catches type mismatches.
 */
// eslint-disable-next-line unused-imports/no-unused-vars
function _checkDocumentMetadataModelMatchesInterface(
  _model: Omit<IDocumentMetadataModel, "properties">
): IDocumentMetadata {
  return _model;
}

/**
 * Check that all of the properties match between IDocumentMetadataModel and IDocumentMetadata.
 * It does this by making all properties required.
 * The createdAt property is excluded because in the MST model it is maybe, which results in
 * a typescript type of `number | undefined`, which doesn't get stripped out by the Required<T>
 * utility type.
 */
// eslint-disable-next-line unused-imports/no-unused-vars
function _checkDocumentMetadataModelMatchesFullInterface(
  _model: Required<Omit<IDocumentMetadataModel, "properties" | "createdAt">>
): Required<Omit<IDocumentMetadata, "properties" | "createdAt">> {
  return _model;
}


/**
 * Check that the snapshot type of DocumentMetadataModel matches IDocumentMetadata.
 * The DocumentMetadataModel is created from the data in Firestore which is supposed
 * to match the IDocumentMetadata interface. So this checks to make sure at least
 * the types support that creation. The types are modified to have all required
 * properties so it will pick up missing properties.
 *
 * @param _model
 * @returns
 */
// eslint-disable-next-line unused-imports/no-unused-vars
function _checkInterfaceMatchesDocumentMetadataModelSnapshotIn(
  _model: Required< IDocumentMetadata >
): Required< SnapshotIn<typeof DocumentMetadataModel> > {
  return _model;
}
