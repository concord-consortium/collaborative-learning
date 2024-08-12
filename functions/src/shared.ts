export const escapeKey = (s: string): string => {
  return s.replace(/[.$[\]#\/]/g, "_");
};

const kProblemPathRegEx = /(.+)\/(\d)\/(\d)$/;
export const isProblemPath = (key?: string) => {
  // if it looks like a section path, assume it is one
  return key ? kProblemPathRegEx.test(key) : false;
};

/*
 * parseProblemPath
 *
 * Parses strings of following form, returning a component array:
 *  "msa/1/2" => ["msa", "1, "2"]
 * In other words, on success the returned array contains:
 *  [unit, investigation, problem]
 */
export const parseProblemPath = (key?: string) => {
  const result = kProblemPathRegEx.exec(key || "");
  return result ? result?.slice(1) : undefined;
}

/*
 * isSectionPath
 *
 * Matches strings of following form:
 *  "msa/1/2/introduction"
 *  "msa:guide/1/2/introduction"
 */
const kSectionPathRegEx = /([^:]+)(:(.+))?\/(\d)\/(\d)\/(.+)$/;
export const isSectionPath = (key?: string) => {
  // if it looks like a section path, assume it is one
  return key ? kSectionPathRegEx.test(key) : false;
};

/*
 * parseSectionPath
 *
 * Parses strings of following form, returning a component array:
 *  "msa/1/2/introduction" => ["msa", undefined, "1, "2", "introduction"]
 *  "msa:guide/1/2/introduction" => ["msa", "guide", "1, "2", "introduction"]
 * In other words, on success the returned array contains:
 *  [unit, facet?, investigation, problem, section]
 */
export const parseSectionPath = (key?: string) => {
  const result = kSectionPathRegEx.exec(key || "");
  return result ? [result[1], ...result?.slice(3)] : undefined;
}

const facetMap: Record<string, string> = {
  "teacher-guide": "guide"
}

export const buildProblemPath = (unitCode: string, investigationOrdinal: string, problemOrdinal: string) => {
  return `${unitCode}/${investigationOrdinal}/${problemOrdinal}`;
};

export const buildSectionPath = (problemPath: string, section?: string, facet?: string) => {
  const [unit, investigation, problem] = parseProblemPath(problemPath) || [];
  if (!unit || !investigation || !problem) return;
  const facetCode = (facet && facetMap[facet]) ?? facet;
  const facetField = facetCode ? `:${facetCode}` : "";
  const sectionField = section ? `/${section}` : "";
  return `${unit}${facetField}/${investigation}/${problem}${sectionField}`;
};

export const getCurriculumMetadata = (sectionPath?: string): ICurriculumMetadata | undefined => {
  const [unit, facet, investigation, problem, section] = parseSectionPath(sectionPath) || [];
  return sectionPath && unit && investigation && problem && section
          ? { unit, facet, problem: `${investigation}.${problem}`, section, path: sectionPath }
          : undefined;
}

/*
 * Types that are shared between cloud functions and client code.
 */
export interface IUserContext {
  appMode: string;
  demoName?: string;
  portal?: string;
  uid?: string;                 // user id of caller; validated for authenticated users when provided
  type?: "student" | "teacher"; // user's role
  name?: string;
  network?: string;             // current network for teachers
  classHash: string;
  teachers?: string[];          // user ids of class's teachers
}

/*
 * networkDocumentKey
 *
 * To accommodate the fact that the same document can be commented upon in multiple networks, the
 * id of a document in firestore is a mashup of the network/uid and the document key.
 */
export function networkDocumentKey(uid: string, documentKey: string, network?: string) {
  const escapedKey = escapeKey(documentKey);
  const escapedNetwork = network && escapeKey(network);
  const prefix = escapedNetwork || `uid:${uid}`;
  return `${prefix}_${escapedKey}`;
}

export interface IDocumentMetadata {
  uid: string;
  type: string;
  key: string;
  createdAt?: number;
  title?: string;
  originDoc?: string;
  properties?: Record<string, string>;
  tileTypes?: string[];
  strategies?: string[];
  investigation?: string;
  problem?: string;
  unit?: string;
  visibility?: string;
}
export function isDocumentMetadata(o: any): o is IDocumentMetadata {
  return !!o.uid && !!o.type && !!o.key;
}

export interface ICurriculumMetadata {
  unit: string;         // unit code, e.g. "sas", "msa", etc.
  facet?: string;       // e.g. "guide" for teacher guide; undefined for regular curriculum
  problem: string;      // ordinal string, e.g. "2.1"
  section: string;      // "introduction", etc.
  path: string;         // e.g. sas/2/1
}
export function isCurriculumMetadata(o: any): o is ICurriculumMetadata {
  return !!o?.unit && !!o.problem && !!o.section && !!o.path;
}

export interface IRowMapEntry {
  id: string;
  isSectionHeader?: boolean;
  sectionId?: string;
  tiles: Array<{ tileId: string }>;
}
export interface ITileContent {
  type: string;
  // ... other tile-specific properties
}
export interface ITileMapEntry {
  id: string;
  content: ITileContent;
}
export interface ISharedModel {
  type: string;
  id: string;
  // ... other shared-model specific properties
}
export interface ISharedModelMapEntry {
  sharedModel: any;
  tiles: Array<string>;
}
export interface IDocumentContent {
  rowMap: Record< string, IRowMapEntry>;
  rowOrder: string[];
  tileMap: Record<string, ITileMapEntry>;
  sharedModelMap: Record<string, ISharedModelMapEntry>;
}

interface IFirebaseFunctionWarmUpParams {
  warmUp: boolean;
}
export function isWarmUpParams(o: any): o is IFirebaseFunctionWarmUpParams {
  return !!o?.warmUp;
}

interface IFirebaseFunctionBaseParams {
  context: IUserContext;
}

export interface IGetImageDataParams extends IFirebaseFunctionBaseParams {
  url: string;
}
export type IGetImageDataUnionParams = IGetImageDataParams | IFirebaseFunctionWarmUpParams;

export interface IPublishSupportParams extends IFirebaseFunctionBaseParams {
  caption: string;
  problem: string;
  classes: string[];
  content: string;
  properties: Record<string, string>;
  originDoc: string;
  originDocType: string;
  resource_link_id: string;
  resource_url: string;
  pubVersion?: number;
}
export type IPublishSupportUnionParams = IPublishSupportParams | IFirebaseFunctionWarmUpParams;

export interface IClientCommentParams {
  tileId?: string;    // empty for document comments
  content: string;    // plain text for now; potentially html if we need rich text
  tags?: string[];    // tag option that user selects for AI
}

export interface ICommentableDocumentParams extends IFirebaseFunctionBaseParams {
  document: IDocumentMetadata | ICurriculumMetadata;
}
export type ICommentableDocumentUnionParams = ICommentableDocumentParams | IFirebaseFunctionWarmUpParams;

export interface IPostDocumentCommentParams extends ICommentableDocumentParams {
  comment: IClientCommentParams;
}
export type IPostDocumentCommentUnionParams = IPostDocumentCommentParams | IFirebaseFunctionWarmUpParams;

export interface INetworkResourceTeacherClassResponse {
  uid: string;
  personalDocuments?: Record<string, any>;
  learningLogs?: Record<string, any>;
}
export interface INetworkResourceTeacherOfferingResponse {
  uid: string;
  problemDocuments?: Record<string, any>;
  planningDocuments?: Record<string, any>;
}
export interface INetworkResourceOfferingResponse {
  resource_link_id: string;
  problemPublications?: Record<string, any>;
  teachers?: INetworkResourceTeacherOfferingResponse[];
}
export interface INetworkResourceClassResponse {
  id?: string;          // portal class id
  name?: string;        // portal class name
  context_id: string;   // portal class hash
  personalPublications?: Record<string, any>;
  learningLogPublications?: Record<string, any>;
  teacher?: string;     // name of primary(?) teacher
  teachers?: INetworkResourceTeacherClassResponse[];
  resources: INetworkResourceOfferingResponse[];
}
export interface IGetNetworkResourcesParams extends IFirebaseFunctionBaseParams {
  problem: string;  // problem path, e.g. "sas/1/2"
}
export interface IGetNetworkResourcesResponse {
  version: string;
  response: INetworkResourceClassResponse[];
}
export type IGetNetworkResourcesUnionParams = IGetNetworkResourcesParams | IFirebaseFunctionWarmUpParams;

export interface IGetNetworkDocumentParams extends IFirebaseFunctionBaseParams {
  context_id: string;
  uid: string;
  key: string;
}
export type IGetNetworkDocumentUnionParams = IGetNetworkDocumentParams | IFirebaseFunctionWarmUpParams;

export interface IGetNetworkDocumentResponse {
  version: string;
  content: any;     // DBDocument
  metadata: any;    // DBDocumentMetadata
}
