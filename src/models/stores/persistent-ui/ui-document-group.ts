import { types, cast } from "mobx-state-tree";


export const UIDocumentGroup = types
  .model("UIDocumentGroup", {
    id: types.identifier,
    /**
     * Either undefined, an empty array, or an array of document ids.
     * - Undefined means the user hasn't chosen anything yet so we can show a default view
     *   in some cases this might be showing the first document of the listing.
     * - Empty array means the user has explicitly chosen to close the documents and
     *   this typically means they'll be viewing the listing of documents.
     * - The array typically has a single document id, in some cases a second document
     *   can be open at the same time.
     *
     * TODO: another approach for handling the "user hasn't chosen anything yet" case is
     * to look to see if there is a document group at all. Currently the visitedDocumentGroup
     * isn't created until a user actually opens a document. But before making that switch
     * we need to have a working example of this "automaticallyOpenFirstDocument" setting.
     */
    currentDocumentKeys: types.maybe(types.array(types.string))
  })
  .views(self => ({
    get primaryDocumentKey() {
      if (!self.currentDocumentKeys || self.currentDocumentKeys.length < 1) {
        return undefined;
      }
      return self.currentDocumentKeys[0];
    },
    get secondaryDocumentKey() {
      if (!self.currentDocumentKeys || self.currentDocumentKeys.length < 2) {
        return undefined;
      }
      return self.currentDocumentKeys[1];
    },
    get userExplicitlyClosedDocument() {
      return self.currentDocumentKeys?.length === 0;
    }
  }))
  .actions(self => ({
    setPrimaryDocumentKey(documentKey: string) {
      let docKeys = self.currentDocumentKeys;
      if (!docKeys) {
        self.currentDocumentKeys = cast([]);
        docKeys = self.currentDocumentKeys!;
      }

      if (docKeys.length === 0) {
        docKeys.push(documentKey);
      } else if (docKeys.length > 0) {
        docKeys[0] = documentKey;
      }
    },
    /**
     * If there is no primary document we just set the documentKey as the primary document
     * and print a warning in the console
     * @param documentKey
     */
    setSecondaryDocumentKey(documentKey: string) {
      let docKeys = self.currentDocumentKeys;
      if (!docKeys) {
        self.currentDocumentKeys = cast([]);
        docKeys = self.currentDocumentKeys!;
      }

      if (docKeys.length === 0) {
        console.warn("setting a secondary document when there is no primary document");
        docKeys.push(documentKey);
      } else if (docKeys.length === 1) {
        docKeys.push(documentKey);
      } else if (docKeys.length > 1) {
        docKeys[1] = documentKey;
      }
    },
    /**
     * Close the current primary document. If there is a secondary document it will become
     * the primary document.
     * @returns
     */
    closePrimaryDocument() {
      const docKeys = self.currentDocumentKeys;
      if (!docKeys) {
        // The user is taking the explicit action to close the document
        // So we save that as an empty array.
        self.currentDocumentKeys = cast([]);
        return;
      }

      if (docKeys.length === 0) return;

      docKeys.splice(0, 1);
    },
    /**
     *
     * @returns
     */
    closeSecondaryDocument() {
      const docKeys = self.currentDocumentKeys;

      if (!docKeys || docKeys.length < 2) return;

      docKeys.splice(1, 1);
    }
  }));
