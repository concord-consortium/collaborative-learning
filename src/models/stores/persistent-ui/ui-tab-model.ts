import { types } from "mobx-state-tree";
import { UIDocumentGroup } from "./ui-document-group";

/**
 * This model is used to track which document group of a tab is open, which documents are open in
 * each document group, and which secondaryDocuments (comparison) documents are open in each
 * document group.
 * For the StudentGroupView the currentDocumentGroupId is the student group id.
 * For the SortWorkView the currentDocumentGroupId in an encoding the filters for group documents
 * that are currently open.
 *
 * TODO: Create different tab types so so the models can more clearly match the UI
 */

export const UITabModel = types
  .model("UITab", {
    id: types.identifier,
    /**
     * The currently open document group on this tab. This could be a subtab, a workgroup,
     * or a collapsible section on the sort work tab.
     */
    currentDocumentGroupId: types.maybe(types.string),
    /**
     * Document groups that the user has visited.
     */
    visitedDocumentGroups: types.map(UIDocumentGroup),
  })
  .views(self => ({
    /**
     * Return the document group. Note: if there is no state saved about this document
     * group then undefined will be returned. Use getOrCreateDocumentGroup if you need to save
     * state.
     * @param docGroupId
     * @returns
     */
    getDocumentGroup(docGroupId: string) {
      return self.visitedDocumentGroups.get(docGroupId);
    },
  }))
  .views(self => ({
    /**
     * Note: If there hasn't been any state saved about the currentDocumentGroupId then
     * this will return undefined. Use getOrCreateDocumentGroup if you need to save
     * state.
     */
    get currentDocumentGroup() {
      if (!self.currentDocumentGroupId) return undefined;

      return self.getDocumentGroup(self.currentDocumentGroupId);
    },
    getDocumentGroupPrimaryDocument(docGroupId: string) {
      return self.visitedDocumentGroups.get(docGroupId)?.primaryDocumentKey;
    },
    getDocumentGroupSecondaryDocument(docGroupId: string) {
      return self.visitedDocumentGroups.get(docGroupId)?.secondaryDocumentKey;
    }
  }))
  .actions(self => ({
    /**
     * This should not be used from view. Because this is an action the properties it reads
     * will not be observed by that parent view. For example if the documentGroup is
     * deleted, that would not trigger the parent view to be re-rendered.
     * @param docGroupId
     * @returns
     */
    getOrCreateDocumentGroup(docGroupId: string) {
      let group = self.visitedDocumentGroups.get(docGroupId);
      if (!group) {
        group = UIDocumentGroup.create({ id: docGroupId });
        self.visitedDocumentGroups.put(group);
      }
      return group;
    }
  }))
  .actions(self => ({
    /**
     * This will create or update the UIDocumentGroup in this tab.
     * This will not change the currentDocumentGroup.
     *
     * @param docGroupId
     * @param documentKey
     */
    setDocumentGroupPrimaryDocument(docGroupId: string, documentKey: string) {
      const group = self.getOrCreateDocumentGroup(docGroupId);
      group.setPrimaryDocumentKey(documentKey);
    },
    setDocumentGroupSecondaryDocument(docGroupId: string, documentKey: string) {
      const group = self.getOrCreateDocumentGroup(docGroupId);
      group.setSecondaryDocumentKey(documentKey);
    }
  }))
  .actions(self => ({
    openDocumentGroupPrimaryDocument(docGroupId: string, documentKey: string) {
      self.setDocumentGroupPrimaryDocument(docGroupId, documentKey);
      self.currentDocumentGroupId = docGroupId;
    },
  }));

export interface UITabModel_V1 {
  id: string;
  openSubTab?: string;
  openDocuments: Record<string, string>;
  openSecondaryDocuments: Record<string, string>;
}
