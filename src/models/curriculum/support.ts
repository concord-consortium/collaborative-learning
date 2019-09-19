import { types } from "mobx-state-tree";
import { DocumentContentModel, DocumentContentModelType } from "../document/document-content";

export enum ESupportType {
  text = "text",
  document = "document"
}

interface LegacySupportSnapshot {
  text: string;
}

export function createTextSupport(text: string) {
  return SupportModel.create({ type: ESupportType.text, content: text });
}

export const SupportModel = types
  .model("Support", {
    type: types.enumeration<ESupportType>("Type", Object.values(ESupportType)),
    // text string or path to document
    content: types.string
  })
  .preProcessSnapshot(snapshot => {
    const legacy = snapshot as any as LegacySupportSnapshot;
    if (legacy.text) return { type: ESupportType.text, content: legacy.text };
    return snapshot;
  });

export type SupportModelType = typeof SupportModel.Type;

export function getDocumentContentForSupport(support: SupportModelType) {
    const content = DocumentContentModel.create();
    content.addTextTile(support.content);
    return content;
}
