import { Instance, types } from "mobx-state-tree";

export const DocumentDragKey = "org.concord.clue.document.key";

export const SectionDocumentDEPRECATED = "section";
export const ProblemDocument = "problem";
export const PersonalDocument = "personal";
export const PlanningDocument = "planning";
export const LearningLogDocument = "learningLog";
export const ExemplarDocument = "exemplar";
export const ProblemPublication = "publication";
export const PersonalPublication = "personalPublication";
export const LearningLogPublication = "learningLogPublication";
export const SupportPublication = "supportPublication";
export const GroupDocument = "group";

export function isProblemType(type: string) {
  return [ProblemDocument, ProblemPublication].indexOf(type) >= 0;
}
export function isPlanningType(type: string) {
  return type === PlanningDocument;
}
export function isPersonalType(type: string) {
  return [PersonalDocument, PersonalPublication].indexOf(type) >= 0;
}
export function isLearningLogType(type: string) {
  return [LearningLogDocument, LearningLogPublication].indexOf(type) >= 0;
}
export function isSupportType(type: string) {
  return type === SupportPublication;
}
export function isExemplarType(type: string) {
  return type === ExemplarDocument;
}
// is this type of document associated with the offering (i.e. with a particular problem)
export function isOfferingType(type: string) {
  return [SectionDocumentDEPRECATED, PlanningDocument, ProblemDocument, ProblemPublication, SupportPublication]
          .indexOf(type) >= 0;
}
export function isUnpublishedType(type: string) {
  return [SectionDocumentDEPRECATED, PlanningDocument, ProblemDocument, PersonalDocument, LearningLogDocument]
          .indexOf(type) >= 0;
}
export function isPublishedType(type: string) {
  return [ProblemPublication, PersonalPublication, LearningLogPublication, SupportPublication]
          .indexOf(type) >= 0;
}
export function isSortableType(type: string){
  return [ProblemDocument, PersonalDocument, LearningLogDocument, ExemplarDocument].indexOf(type) >= 0;
}
// This function uses a bit of a hack to determine if a document is curriculum or not:
// curriculum documents have no ids.
// Perhaps a better method will be found to determine if a document is curriculum. In the mean time, this
// function will at least identify areas in the code where we need to test for curriculum.
export function isCurriculumDocument(documentId?: string) {
  return documentId === undefined;
}

const DocumentTypeEnumValues = [SectionDocumentDEPRECATED,
                ProblemDocument, PersonalDocument, PlanningDocument, LearningLogDocument, ExemplarDocument,
                ProblemPublication, PersonalPublication, LearningLogPublication, SupportPublication,
                GroupDocument];
export const DocumentTypeEnum = types.enumeration("type", DocumentTypeEnumValues);
export type DocumentType = Instance<typeof DocumentTypeEnum>;
export function isDocumentType(value: string): value is DocumentType {
  return DocumentTypeEnumValues.indexOf(value as DocumentType) >= 0;
}
export type ProblemOrPlanningDocumentType = typeof ProblemDocument | typeof PlanningDocument;
export type OtherDocumentType = typeof PersonalDocument | typeof LearningLogDocument;
export type PublishableType = typeof ProblemDocument | OtherDocumentType;
export type OtherPublicationType = typeof PersonalPublication | typeof LearningLogPublication;
export type PublicationType = typeof ProblemPublication | OtherPublicationType | typeof SupportPublication;

export type ISetProperties = Record<string, string | undefined>;

export interface IDocumentContext {
  type: DocumentType;
  key: string;
  title?: string;
  originDoc?: string;
  getProperty: (key: string) => string | undefined;
  setProperties: (properties: ISetProperties) => void;
}
