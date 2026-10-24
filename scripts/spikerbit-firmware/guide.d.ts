export interface GuideDisplay { title: string; constName: string; icon: string; description: string }
export interface GuideValue { constName: string; description: string; value: number }
export interface GuideTags { displays: GuideDisplay[]; values: GuideValue[] }
export function collectGuideTags(source: string): GuideTags;
export function iconPatterns(iconsTs: string): Record<string, string>;
export function displayImageName(display: GuideDisplay): string;
export function renderGuideSections(tags: GuideTags): Record<"displays" | "values", string>;
export function replaceGuideSections(guide: string, sections: Record<string, string>): string;
export function readGuideSections(guide: string): Record<string, string>;
export const kGuideImageDir: "guide-images";
