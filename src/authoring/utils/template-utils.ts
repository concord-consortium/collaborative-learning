import { ITemplateContent } from "../types";

// Build a document template pre-seeded with one (empty) section divider per section id, so authors fill in
// each section's content instead of building the section structure by hand. A section divider is the
// authored-format marker { content: { isSectionHeader: true, sectionId } }. Callers pass the section ids
// for the scope being seeded (all unit sections at unit scope, the problem's own sections per-problem).
export function buildSectionDividerTemplate(sectionIds: string[] | undefined): ITemplateContent {
  return {
    tiles: (sectionIds ?? []).map(sectionId => ({
      content: { isSectionHeader: true as const, sectionId }
    }))
  };
}
