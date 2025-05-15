import { SectionModelType } from "../curriculum/section";
import { DocumentContentModel } from "./document-content";
import { IAuthoredDocumentContent, OriginalTilesSnapshot } from "./document-content-import-types";

interface ISectionedContent {
  sections?: SectionModelType[];
  content?: Record<string, IAuthoredDocumentContent>;
}
export function createDefaultSectionedContent({ sections, content }: ISectionedContent = {}) {
  const tiles: OriginalTilesSnapshot = [];
  // for blank sectioned documents, default content is a section header row and a placeholder
  // tile for each section that is present in the template (the passed sections)
  sections?.forEach(section => {
    tiles.push({ content: { isSectionHeader: true, sectionId: section.type }});
    if (content?.[section.type]) {
      tiles.push(...(content[section.type].tiles || []));
    }
    else {
      tiles.push({ content: { type: "Placeholder", sectionId: section.type, containerType: "DocumentContent" }});
    }
  });
  // cast required because we're using the import format
  return DocumentContentModel.create({ tiles } as any);
}
