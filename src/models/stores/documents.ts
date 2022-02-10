import { forEach } from "lodash";
import { types } from "mobx-state-tree";
import { AppConfigModelType } from "./app-config-model";
import { DocumentModel, DocumentModelType } from "../document/document";
import {
  DocumentType, LearningLogDocument, LearningLogPublication, OtherDocumentType, OtherPublicationType,
  PersonalDocument, PersonalPublication, PlanningDocument, ProblemDocument, ProblemPublication
} from "../document/document-types";
import { ClassModelType } from "./class";
import { UserModelType } from "./user";

const extractLatestPublications = (publications: DocumentModelType[], attr: "uid" | "originDoc") => {
  const latestPublications: DocumentModelType[] = [];
  publications.forEach((publication) => {
    const latestIndex = latestPublications.findIndex((pub) => pub[attr] === publication[attr]);
    if (latestIndex === -1) {
      latestPublications.push(publication);
    }
    else if (publication.createdAt > latestPublications[latestIndex].createdAt) {
      latestPublications[latestIndex] = publication;
    }
  });
  return latestPublications;
};

export interface IRequiredDocumentPromise {
  promise: Promise<DocumentModelType | null>;
  resolve: (document: DocumentModelType | null) => void;
  isResolved: boolean;
}

export const DocumentsModel = types
  .model("Documents", {
    all: types.array(DocumentModel)
  })
  .volatile(self => ({
    appConfig: undefined as AppConfigModelType | undefined,
    requiredDocuments: {} as Record<string, IRequiredDocumentPromise>
  }))
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
    getTypeOfTileInDocument(documentKey: string, tileId: string) {
      return self.getDocument(documentKey)?.content?.getTileType(tileId);
    },
    getNextPersonalDocumentTitle(user: UserModelType, base: string) {
      let maxUntitled = 0;
      self.byTypeForUser(PersonalDocument, user.id)
        .forEach(document => {
          const match = /.*-([0-9]+)$/.exec(document.title || "");
          // length check to skip timestamps
          if (match && match[1] && (match[1].length < 4)) {
            const suffix = parseInt(match[1], 10);
            maxUntitled = Math.max(maxUntitled, suffix);
          }
        });
      return `${base}-${++maxUntitled}`;
    },

    getPersonalDocument(userId: string) {
      return self.all.find((document) => {
        return (document.type === PersonalDocument) && (document.uid === userId);
      });
    },

    getLearningLogDocument(userId: string) {
      return self.all.find((document) => {
        return (document.type === LearningLogDocument) && (document.uid === userId);
      });
    },

    getPlanningDocument(userId: string) {
      return self.all.find((document) => {
        return (document.type === PlanningDocument) && (document.uid === userId);
      });
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

    getLastPublishedProblemDocumentsForGroup(groupId: string) {
      const groupPublications = self.byType(ProblemPublication).filter((pub) => pub.groupId === groupId);
      return extractLatestPublications(groupPublications, "uid");
    },

    getNextLearningLogTitle(user: UserModelType, base: string) {
      let maxUntitled = 0;
      self.byTypeForUser(LearningLogDocument, user.id)
        .forEach(document => {
          const match = /.*-([0-9]+)$/.exec(document.title || "");
          // length check to skip timestamps
          if (match && match[1] && (match[1].length < 4)) {
            const suffix = parseInt(match[1], 10);
            maxUntitled = Math.max(maxUntitled, suffix);
          }
        });
      return `${base}-${++maxUntitled}`;
    },

    // Returns the most recently published personal documents or learning logs per user, sorted by title
    getLatestOtherPublications(type: OtherPublicationType) {
      const latestPublications = extractLatestPublications(self.byType(type), "originDoc");
      return latestPublications.sort((pub1, pub2) => {
        return (pub1.title || "").localeCompare(pub2.title || "");
      });
    },

    // Returns the most recently published docs for the given section/problem per user, sorted by name
    getLatestPublications(clazz: ClassModelType) {
      const latestPublications = extractLatestPublications(self.byType(ProblemPublication), "uid");
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
    getLatestPersonalPublications() {
      return self.getLatestOtherPublications(PersonalPublication);
    },

    getLatestLogPublications() {
      return self.getLatestOtherPublications(LearningLogPublication);
    },

    getNextOtherDocumentTitle(user: UserModelType, documentType: OtherDocumentType, base: string) {
      switch (documentType) {
        case PersonalDocument: return self.getNextPersonalDocumentTitle(user, base);
        case LearningLogDocument: return self.getNextLearningLogTitle(user, base);
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

    const addRequiredDocumentPromises = (requiredTypes: string[]) => {
      requiredTypes.forEach(type => {
        const wrapper: Partial<IRequiredDocumentPromise> = { isResolved: false };
        wrapper.promise = new Promise(resolve => {
          wrapper.resolve = (document: DocumentModelType | null) => {
            resolve(document);
            wrapper.isResolved = true;
          };
        });
        self.requiredDocuments[type] = wrapper as IRequiredDocumentPromise;
      });
    };

    const resolveRequiredDocumentPromise = (document: DocumentModelType | null, typeToNull?: string) => {
      const type = document?.type || typeToNull;
      if (type) {
        const promise = self.requiredDocuments[type];
        !promise.isResolved && promise.resolve(document);
      }
    };

    const resolveAllRequiredDocumentPromisesWithNull = () => {
      forEach(self.requiredDocuments, (wrapper, type) => {
        resolveRequiredDocumentPromise(null, type);
      });
    };

    const findDocumentOfTile = (tileId: string): DocumentModelType | null => {
      const parentDocument = self.all.find(document => !!document.content?.tileMap.get(tileId));
      return parentDocument || null;
    };

    const setAppConfig = (appConfig: AppConfigModelType) => {
      self.appConfig = appConfig;
    };

    return {
      add,
      remove,
      update,
      addRequiredDocumentPromises,
      resolveRequiredDocumentPromise,
      resolveAllRequiredDocumentPromisesWithNull,
      findDocumentOfTile,
      setAppConfig
    };
  });

export type DocumentsModelType = typeof DocumentsModel.Type;

export function createDocumentsModelWithRequiredDocuments(requiredTypes: string[]) {
  const documents = DocumentsModel.create();
  documents.addRequiredDocumentPromises(requiredTypes);
  return documents;
}
