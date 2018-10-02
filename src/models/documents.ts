import { types } from "mobx-state-tree";
import { DocumentModel, DocumentModelType, SectionDocument } from "./document";

type DocumentTypeOption = "section" | "publication" | "learningLog";

export const DocumentsModel = types
  .model("Documents", {
    all: types.array(DocumentModel),
  })
  .views((self) => {
    const getDocument = (documentKey: string) => {
      return self.all.find((document) => document.key === documentKey);
    };
    const byType = (type: DocumentTypeOption) => {
      return self.all.filter((document) => document.type === type);
    };
    const byTypeForUser = (type: DocumentTypeOption, userId: string) => {
      return self.all.filter((document) => {
        return (document.type === type) && (document.uid === userId);
      });
    };

    return {
      getDocument,
      byType,
      byTypeForUser,

      getSectionDocument(userId: string, sectionId: string) {
        return self.all.find((document) => {
          return (document.type === SectionDocument) && (document.uid === userId) && (document.sectionId === sectionId);
        });
      },

      getSectionDocumentsForGroup(sectionId: string, groupId: string) {
        return self.all.filter((document) => {
          return (document.type === SectionDocument) &&
                 (document.sectionId === sectionId) &&
                 (document.groupId === groupId);
        });
      },

      // Returns the most recently published docs for the given section, sorted by group ID number
      getLatestPublicationsForSection(sectionId: string) {
        const latestPublications: DocumentModelType[] = [];
        byType("publication")
          .filter((publication) => publication.sectionId === sectionId)
          .forEach((publication) => {
            const groupId = publication.groupId;
            const latestIndex = latestPublications.findIndex((pub) => pub.groupId === groupId);
            if (latestIndex === -1) {
              latestPublications.push(publication);
            }
            else if (publication.createdAt > latestPublications[latestIndex].createdAt) {
              latestPublications[latestIndex] = publication;
            }
          });

        return latestPublications
          .sort((pub1, pub2) => parseInt(pub1.groupId!, 10) - parseInt(pub2.groupId!, 10));
      },
    };
  })
  .actions((self) => {
    const add = (document: DocumentModelType) => {
      if (!self.getDocument(document.key)) {
        self.all.push(document);
      }
    };

    const remove = (document: DocumentModelType) => {
      self.all.remove(document);
    };

    const update = (document: DocumentModelType) => {
      if (!self.getDocument(document.key)) {
        add(document);
      }
      else {
        const i = self.all.findIndex((currDoc) => currDoc.key === document.key);
        if (i !== -1) {
          self.all[i] = document;
        }
      }
    };

    return {
      add,
      remove,
      update
    };
  });

export type DocumentsModelType = typeof DocumentsModel.Type;
