import { Instance, types } from "mobx-state-tree";

export const DocumentDragKey = "org.concord.clue.document.key";

export const SectionDocumentDEPRECATED = "section";
export const ProblemDocument = "problem";
export const PersonalDocument = "personal";
export const LearningLogDocument = "learningLog";
export const ProblemPublication = "publication";
export const PersonalPublication = "personalPublication";
export const LearningLogPublication = "learningLogPublication";
export const SupportPublication = "supportPublication";

export function isProblemType(type: string) {
  return [ProblemDocument, ProblemPublication].indexOf(type) >= 0;
}
export function isPersonalType(type: string) {
  return [PersonalDocument, PersonalPublication].indexOf(type) >= 0;
}
export function isLearningLogType(type: string) {
  return [LearningLogDocument, LearningLogPublication].indexOf(type) >= 0;
}
export function isUnpublishedType(type: string) {
  return [SectionDocumentDEPRECATED, ProblemDocument, PersonalDocument, LearningLogDocument]
          .indexOf(type) >= 0;
}
export function isPublishedType(type: string) {
  return [ProblemPublication, PersonalPublication, LearningLogPublication, SupportPublication].indexOf(type) >= 0;
}

export const DocumentTypeEnum = types.enumeration("type",
              [SectionDocumentDEPRECATED,
                ProblemDocument, PersonalDocument, LearningLogDocument,
                ProblemPublication, PersonalPublication, LearningLogPublication,
                SupportPublication]);
export type DocumentType = Instance<typeof DocumentTypeEnum>;
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
