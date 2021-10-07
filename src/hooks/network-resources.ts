import { each } from "lodash";
import { useCallback } from "react";
import { useQuery } from "react-query";
import { IGetNetworkResourcesParams, IGetNetworkResourcesResponse } from "../../functions/src/shared";
import { DBOfferingUserProblemDocument, DBOtherDocument, DBOtherPublication, DBPublication } from "../lib/db-types";
import { DocumentModel } from "../models/document/document";
import {
  LearningLogDocument, PersonalDocument, PersonalPublication, PlanningDocument, ProblemDocument, ProblemPublication
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
      // add each teacher's class-wide documents to the network documents store
      aClass.teachers?.forEach(teacher => {
        each(teacher.personalDocuments, (metadata: DBOtherDocument, key: string) => {
          const { self: { uid }, title, properties } = metadata;
          const type = PersonalDocument;
          documents.add(DocumentModel.create({ uid, type, key, remoteContext, title, properties }));
        });
        each(teacher.learningLogs, (metadata: DBOtherDocument, key: string) => {
          const { self: { uid }, title, properties } = metadata;
          const type = LearningLogDocument;
          documents.add(DocumentModel.create({ uid, type, key, remoteContext, title, properties }));
        });
      });
      // add problem-specific publications to the network document store
      aClass.resources?.forEach(offering => {
        each(offering.problemPublications, (metadata: DBPublication, key: string) => {
          const { userId: uid } = metadata;
          const type = ProblemPublication;
          documents.add(DocumentModel.create({ uid, type, key, remoteContext }));
        });
        each(offering.personalPublications, (metadata: DBOtherPublication, key: string) => {
          const { uid, title, properties, originDoc } = metadata;
          const type = PersonalPublication;
          documents.add(DocumentModel.create({ uid, type, key, remoteContext, title, properties, originDoc }));
        });
        // add teacher's problem-specific documents to the network documents store
        offering.teachers?.forEach(teacher => {
          each(teacher.problemDocuments, (metadata: DBOfferingUserProblemDocument, key: string) => {
            const { self: { uid }, visibility } = metadata;
            const type = ProblemDocument;
            documents.add(DocumentModel.create({ uid, type, key, remoteContext, visibility }));
          });
          each(teacher.planningDocuments, (metadata: DBOfferingUserProblemDocument, key: string) => {
            const { self: { uid }, visibility } = metadata;
            const type = PlanningDocument;
            documents.add(DocumentModel.create({ uid, type, key, remoteContext, visibility }));
          });
        });
      });
    });
    return response;
  });
}
