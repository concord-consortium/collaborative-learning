import { types, getSnapshot } from "mobx-state-tree";
import { DocumentContentModel, IAuthoredDocumentContent } from "../document/document-content";

export enum ESupportType {
  // simple text supports (e.g. legacy supports); content is simple text
  text = "text",
  // supports with embedded document content (e.g. curricular supports with document content)
  // content is stringified document content
  document = "document",
  // published teacher supports: content is path to published support document
  publication = "publication"
}

// standard teacher supports have mode undefined
export enum ESupportMode {
  stickyNote = "sticky"
}

interface LegacySupportSnapshot {
  text: string;
}

interface RichAuthoredSupportSnapshot {
  type: "document";
  content: IAuthoredDocumentContent;
}

export function createTextSupport(text: string) {
  return SupportModel.create({ type: ESupportType.text, content: text });
}

export function createStickyNote(text: string) {
  return SupportModel.create({ type: ESupportType.text, mode: ESupportMode.stickyNote, content: text });
}

export const SupportModel = types
  .model("Support", {
    type: types.enumeration<ESupportType>("SupportType", Object.values(ESupportType)),
    mode: types.maybe(types.enumeration<ESupportMode>("SupportMode", Object.values(ESupportMode))),
    // text string or path to document
    content: types.string
  })
  .preProcessSnapshot(snapshot => {
    const legacySupport = snapshot as any as LegacySupportSnapshot;
    if (legacySupport.text) return { type: ESupportType.text, content: legacySupport.text };

    const authoredSupport = snapshot as any as RichAuthoredSupportSnapshot;
    if ((snapshot.type === ESupportType.document) && authoredSupport.content.tiles) {
      const content = DocumentContentModel.create(authoredSupport.content);
      return { type: ESupportType.document, content: JSON.stringify(getSnapshot(content)) };
    }

    return snapshot;
  });

export type SupportModelType = typeof SupportModel.Type;
