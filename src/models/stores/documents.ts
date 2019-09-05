import { types } from "mobx-state-tree";
import { DocumentModel, DocumentModelType, DocumentType, LearningLogDocument, LearningLogPublication,
        OtherDocumentType, OtherPublicationType, PersonalDocument, PersonalPublication, ProblemDocument
      } from "../document/document";
import { UnitModel, UnitModelType } from "../curriculum/unit";
import { ClassModelType } from "./class";
import { UserModelType } from "./user";

export const DocumentsModel = types
  .model("Documents", {
    all: types.array(DocumentModel),
    unit: types.maybe(UnitModel)
  })
  .views(self => ({
    getDocument(documentKey: string) {
      return self.all.find((document) => document.key === documentKey);
    },

    byType(type: DocumentType) {
      return self.all.filter((document) => document.type === type);
    },

    byTypeForUser(type: DocumentType, userId: string) {
      return self.all.filter((document) => {
        return (document.type === type) && (document.uid === userId);
      });
    }
  }))
  .views(self => ({
    getNextPersonalDocumentTitle(user: UserModelType) {
      let maxUntitled = 0;
      self.byTypeForUser(PersonalDocument, user.id)
        .forEach(document => {
          const match = /.*-([0-9]+)$/.exec(document.title || "");
          if (match && match[1]) {
            const suffix = parseInt(match[1], 10);
            maxUntitled = Math.max(maxUntitled, suffix);
          }
        });
      return `Untitled-${++maxUntitled}`;
    },

    getProblemDocument(userId: string) {
      return self.all.find((document) => {
        return (document.type === ProblemDocument) && (document.uid === userId);
      });
    },

    getProblemDocumentsForGroup(groupId: string) {
      return self.all.filter((document) => {
        return (document.type === ProblemDocument) && (document.groupId === groupId);
      });
    },

    getNextLearningLogTitle(user: UserModelType) {
      let maxUntitled = 0;
      self.byTypeForUser(LearningLogDocument, user.id)
        .forEach(document => {
          const match = /.*-([0-9]+)$/.exec(document.title || "");
          if (match && match[1]) {
            const suffix = parseInt(match[1], 10);
            maxUntitled = Math.max(maxUntitled, suffix);
          }
        });
      return `UntitledLog-${++maxUntitled}`;
    },

    // Returns the most recently published personal documents or learning logs per user, sorted by title
    getLatestOtherPublications(type: OtherPublicationType) {
      const latestPublications: DocumentModelType[] = [];
      self.byType(type)
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

    getLatestPersonalPublications() {
      return this.getLatestOtherPublications(PersonalPublication);
    },

    getLatestLogPublications() {
      return this.getLatestOtherPublications(LearningLogPublication);
    },

    // Returns the most recently published docs for the given section/problem per user, sorted by name
    getLatestPublications(clazz: ClassModelType) {
      const latestPublications: DocumentModelType[] = [];
      self.byType("publication")
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
    }
  }))
  .views(self => ({
    getNextOtherDocumentTitle(user: UserModelType, documentType: OtherDocumentType) {
      switch (documentType) {
        case PersonalDocument: return self.getNextPersonalDocumentTitle(user);
        case LearningLogDocument: return self.getNextLearningLogTitle(user);
      }
      return "";
    }
  }))
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
