import { each } from "lodash";
import { useCallback } from "react";
import { useQuery } from "react-query";
import { IGetNetworkResourcesParams, IGetNetworkResourcesResponse } from "../../functions/src/shared";
import { DBOfferingUserProblemDocument, DBOtherDocument, DBOtherPublication, DBPublication } from "../lib/db-types";
import { DocumentModel } from "../models/document/document";
import {
  LearningLogDocument, LearningLogPublication, PersonalDocument, PersonalPublication,
  PlanningDocument, ProblemDocument, ProblemPublication
} from "../models/document/document-types";
import { useFirebaseFunction } from "./use-firebase-function";
import { useNetworkDocuments, useProblemPath } from "./use-stores";
import { useUserContext } from "./use-user-context";

export function useNetworkResources() {
  const context = useUserContext();
  const problemPath = useProblemPath();
  const documents = useNetworkDocuments();
  const getNetworkResources_v1 = useFirebaseFunction<IGetNetworkResourcesParams>("getNetworkResources_v1");
  const getNetworkResources = useCallback(() => {
    return getNetworkResources_v1({ context, problem: problemPath });
  }, [context, getNetworkResources_v1, problemPath]);
  return useQuery(["network-resources", context.network], async () => {
    const networkResources = await getNetworkResources();
    const { response } = networkResources.data as IGetNetworkResourcesResponse;
    response?.forEach(aClass => {
      const { context_id: remoteContext } = aClass;
      // add class-wide publications to the network documents store
      let keys: string[] = [];
      each(aClass.personalPublications, (metadata: DBOtherPublication) => {
        const { self: { documentKey: key }, title, properties, uid, originDoc } = metadata;
        const type = PersonalPublication;
        documents.add(DocumentModel.create({ uid, type, key, remoteContext, title, properties, originDoc }));
        keys.push(key);
      });
      aClass.personalPublications && (aClass.personalPublications = keys);
      keys = [];
      each(aClass.learningLogPublications, (metadata: DBOtherPublication) => {
        const { self: { documentKey: key }, title, properties, uid, originDoc } = metadata;
        const type = LearningLogPublication;
        documents.add(DocumentModel.create({ uid, type, key, remoteContext, title, properties, originDoc }));
        keys.push(key);
      });
      aClass.learningLogPublications && (aClass.learningLogPublications = keys);
      // add each teacher's class-wide documents to the network documents store
      aClass.teachers?.forEach(teacher => {
        keys = [];
        each(teacher.personalDocuments, (metadata: DBOtherDocument) => {
          const { self: { uid, documentKey: key }, title, properties } = metadata;
          const type = PersonalDocument;
          documents.add(DocumentModel.create({ uid, type, key, remoteContext, title, properties }));
          keys.push(key);
        });
        teacher.personalDocuments && (teacher.personalDocuments = keys);
        keys = [];
        each(teacher.learningLogs, (metadata: DBOtherDocument) => {
          const { self: { uid, documentKey: key }, title, properties } = metadata;
          const type = LearningLogDocument;
          documents.add(DocumentModel.create({ uid, type, key, remoteContext, title, properties }));
          keys.push(key);
        });
        teacher.learningLogs && (teacher.learningLogs = keys);
      });
      // add problem-specific publications to the network document store
      aClass.resources?.forEach(offering => {
        keys = [];
        each(offering.problemPublications, (metadata: DBPublication) => {
          const { documentKey: key, userId: uid } = metadata;
          const type = ProblemPublication;
          documents.add(DocumentModel.create({ uid, type, key, remoteContext }));
          keys.push(key);
        });
        offering.problemPublications && (offering.problemPublications = keys);
        // add teacher's problem-specific documents to the network documents store
        offering.teachers?.forEach(teacher => {
          keys = [];
          each(teacher.problemDocuments, (metadata: DBOfferingUserProblemDocument) => {
            const { self: { uid } = { uid: null }, documentKey: key, visibility } = metadata || {};
            const type = ProblemDocument;
            if (uid && key) {
              documents.add(DocumentModel.create({ uid, type, key, remoteContext, visibility }));
              keys.push(key);
            }
            else {
              console.warn("Warning: useNetworkResources encountered invalid problem document metadata:",
                            JSON.stringify(metadata));
            }
          });
          teacher.problemDocuments && (teacher.problemDocuments = keys);
          keys = [];
          each(teacher.planningDocuments, (metadata: DBOfferingUserProblemDocument) => {
            const { self: { uid } = { uid: null }, documentKey: key, visibility } = metadata;
            const type = PlanningDocument;
            if (uid && key) {
              documents.add(DocumentModel.create({ uid, type, key, remoteContext, visibility }));
              keys.push(key);
            }
            else {
              console.warn("Warning: useNetworkResources encountered invalid problem document metadata:",
                            JSON.stringify(metadata));
            }
          });
          teacher.planningDocuments && (teacher.planningDocuments = keys);
        });
      });
    });
    return response;
  });
}
