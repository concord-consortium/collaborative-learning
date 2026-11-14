import { DBDocument, INotExactEvidence } from "../../lib/db-types";
import { hashString } from "../../utilities/js-utils";
import { ITileMapEntry } from "../../../shared/shared";
import { IArrowAnnotation } from "../annotations/arrow-annotation";
import { ICommittedEntry } from "../history/history-commits";
import { ISavedEnvelope } from "./document";
import { DocumentContentSnapshotType } from "./document-content";

/**
 * The tools a document uses, as listed in its Firestore metadata: each tile type once, plus
 * "Sparrow" when the document has an arrow annotation.
 */
export function getDocumentTools(snapshot: DocumentContentSnapshotType): string[] {
  const tileMap = snapshot.tileMap || {};
  const tools: string[] = [];
  Object.keys(tileMap).forEach((tileKey) => {
    const tileInfo = tileMap[tileKey] as ITileMapEntry;
    const tileType = tileInfo.content.type;
    if (!tools.includes(tileType)) {
      tools.push(tileType);
    }
  });

  // The annotations property does exist on the snapshot but MobX doesn't recognize it
  // as a property because of the way we are constructing the DocumentContentModel
  // on top of multiple other models. This typing is a workaround so TS doesn't complain.
  const annotations =
    (snapshot as {annotations?: Record<string, IArrowAnnotation>}).annotations || {};

  Object.keys(annotations).forEach((annotationKey: string) => {
    const annotation = annotations[annotationKey];
    // for now we only want Sparrow annotations
    // we might want to change this if we want to count other types in the future
    if (annotation.type === "arrowAnnotation" && !tools.includes("Sparrow")) {
      tools.push("Sparrow");
    }
  });
  return tools;
}

interface IExactSaveArgs {
  content: string;
  changeCount: number;
  entry: ICommittedEntry;
  exactSince: string;
}

/**
 * The envelope fields of a save whose content is exactly the history from exactSince through the
 * entry. The fields of an intermediate save are cleared, since the save is merged with update().
 */
export function buildExactSave({ content, changeCount, entry, exactSince }: IExactSaveArgs)
    : Record<string, unknown> {
  return {
    content,
    changeCount,
    lastHistoryEntryId: entry.id,
    exactThrough: { id: entry.id, index: entry.index, contentHash: hashString(content), since: exactSince },
    notExact: null
  };
}

interface IIntermediateSaveArgs {
  content: string;
  changeCount: number;
  entry?: { id: string };
  evidence: INotExactEvidence;
}

/**
 * The envelope fields of a save whose content may not match its entry. The entry, when there is one,
 * is only evidence: the content can hold later entries, and can lack earlier ones.
 */
export function buildIntermediateSave({ content, changeCount, entry, evidence }: IIntermediateSaveArgs)
    : Record<string, unknown> {
  return {
    content,
    changeCount,
    ...(entry && { lastHistoryEntryId: entry.id }),
    exactThrough: null,
    notExact: evidence
  };
}

/**
 * The history fields of a stored envelope. Its exactThrough is kept only when it was written with
 * this id and content: a client that doesn't know the field saves without clearing it.
 */
export function readSavedEnvelope(dbDocument: Pick<DBDocument, "content" | "lastHistoryEntryId" | "exactThrough">)
    : ISavedEnvelope | undefined {
  const { content, lastHistoryEntryId, exactThrough } = dbDocument;
  if (typeof lastHistoryEntryId !== "string") return undefined;
  const exact = exactThrough?.id === lastHistoryEntryId && typeof exactThrough.index === "number"
    && typeof exactThrough.since === "string" && typeof content === "string"
    && exactThrough.contentHash === hashString(content);
  return exact
    ? { lastHistoryEntryId, exactThrough: { index: exactThrough.index, since: exactThrough.since } }
    : { lastHistoryEntryId };
}
