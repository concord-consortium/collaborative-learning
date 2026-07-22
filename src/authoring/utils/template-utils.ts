import { ISection, ITemplateContent } from "../types";

// Build a document template pre-seeded with one (empty) section divider per section, so authors fill in
// each section's content instead of building the section structure by hand. A section divider is the
// authored-format marker { content: { isSectionHeader: true, sectionId } }.
export function buildSectionDividerTemplate(sections: Record<string, ISection> | undefined): ITemplateContent {
  return {
    tiles: Object.keys(sections ?? {}).map(sectionId => ({
      content: { isSectionHeader: true, sectionId }
    }))
  } as unknown as ITemplateContent;
}
