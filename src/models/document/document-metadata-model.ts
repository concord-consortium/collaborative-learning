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
  title: types.maybeNull(types.string),
  originDoc: types.maybeNull(types.string),
  properties: types.map(types.union(types.string, types.number)),
  tools: types.array(types.string),
  strategies: types.array(types.string),
  investigation: types.maybeNull(types.string),
  problem: types.maybeNull(types.string),
  unit: types.maybeNull(types.string),
  visibility: types.maybe(types.string)
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
   * @returns
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
