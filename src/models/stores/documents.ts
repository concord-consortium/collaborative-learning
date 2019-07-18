import { types } from "mobx-state-tree";
import { DocumentModel, DocumentModelType, DocumentType, SectionDocument } from "../document/document";
import { ClassModelType } from "./class";
import { UnitModel, UnitModelType } from "../curriculum/unit";

export const DocumentsModel = types
  .model("Documents", {
    all: types.array(DocumentModel),
    unit: types.maybe(UnitModel)
  })
  .views((self) => {
    const getDocument = (documentKey: string) => {
      return self.all.find((document) => document.key === documentKey);
    };
    const byType = (type: DocumentType) => {
      return self.all.filter((document) => document.type === type);
    };
    const byTypeForUser = (type: DocumentType, userId: string) => {
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

      // Returns the most recently published learning logs per user, sorted by title
      getLatestLogPublications() {
        const latestPublications: DocumentModelType[] = [];
        byType("learningLogPublication")
          .forEach((publication) => {
            const originDoc = publication.originDoc;
            const latestIndex = latestPublications.findIndex((pub) => pub.originDoc === originDoc);
            if (latestIndex === -1) {
              latestPublications.push(publication);
            }
            else if (publication.createdAt > latestPublications[latestIndex].createdAt) {
              latestPublications[latestIndex] = publication;
            }
          });

        return latestPublications.sort((pub1, pub2) => {
          return (pub1.title || "").localeCompare(pub2.title || "");
        });
      },

      // Returns the most recently published docs for the given section per user, sorted by name
      getLatestPublicationsForSection(sectionId: string, clazz: ClassModelType) {
        const latestPublications: DocumentModelType[] = [];
        byType("publication")
          .filter((publication) => publication.sectionId === sectionId)
          .forEach((publication) => {
            const uid = publication.uid;
            const latestIndex = latestPublications.findIndex((pub) => pub.uid === uid);
            if (latestIndex === -1) {
              latestPublications.push(publication);
            }
            else if (publication.createdAt > latestPublications[latestIndex].createdAt) {
              latestPublications[latestIndex] = publication;
            }
          });

        return latestPublications.sort((pub1, pub2) => {
          const user1 = clazz.getUserById(pub1.uid);
          const user2 = clazz.getUserById(pub2.uid);
          // Every publication should have a user, but if it's missing, sort that document last
          if (!user1 || !user2) return (user2 ? 1 : 0) - (user1 ? 1 : 0);
          return user1.lastName !== user2.lastName
            ? user1.lastName.localeCompare(user2.lastName)
            : user1.firstName.localeCompare(user2.firstName);
        });
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
          const oldDoc = self.all[i];
          if (oldDoc && oldDoc.changeCount > document.changeCount) return;

          self.all[i] = document;
        }
      }
    };

    const findDocumentOfTile = (tileId: string): DocumentModelType | null => {
      const parentDocument = self.all.find(document => !!document.content.tileMap.get(tileId));
      return parentDocument || null;
    };

    const setUnit = (unit: UnitModelType) => {
      self.unit = unit;
    };

    return {
      add,
      remove,
      update,
      findDocumentOfTile,
      setUnit
    };
  });

export type DocumentsModelType = typeof DocumentsModel.Type;
