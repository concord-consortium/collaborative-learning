import { types } from "mobx-state-tree";
import { DocumentContentModel, DocumentContentModelType } from "../document/document-content";

export enum ESupportType {
  // simple text supports (e.g. legacy supports); content is simple text
  text = "text",
  // supports with embedded document content (e.g. curricular supports with document content)
  // content is stringified document content
  document = "document",
  // published teacher supports: content is path to published support document
  publication = "publication"
}

interface LegacySupportSnapshot {
  text: string;
}

export function createTextSupport(text: string) {
  return SupportModel.create({ type: ESupportType.text, content: text });
}

export const SupportModel = types
  .model("Support", {
    type: types.enumeration<ESupportType>("SupportType", Object.values(ESupportType)),
    // text string or path to document
    content: types.string
  })
  .preProcessSnapshot(snapshot => {
    const legacy = snapshot as any as LegacySupportSnapshot;
    if (legacy.text) return { type: ESupportType.text, content: legacy.text };
    return snapshot;
  });

export type SupportModelType = typeof SupportModel.Type;
