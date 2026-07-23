import { ITemplateContent, ITemplateTile } from "../types";

// Build a document template pre-seeded, for each section id, with a section divider followed by a
// "put content here" placeholder — the same header+placeholder structure the default sectioned problem
// document uses (see createDefaultSectionedContent). Authors then replace each placeholder with content;
// any section left empty keeps its placeholder, exactly as in the default problem document. Callers pass
// the section ids for the scope being seeded (all unit sections at unit scope, the problem's own
// sections per-problem).
export function buildSectionDividerTemplate(sectionIds: string[] | undefined): ITemplateContent {
  const tiles: ITemplateTile[] = [];
  (sectionIds ?? []).forEach(sectionId => {
    tiles.push({ content: { isSectionHeader: true as const, sectionId } });
    tiles.push({ content: { type: "Placeholder", sectionId, containerType: "DocumentContent" } });
  });
  return { tiles };
}
