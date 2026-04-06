import { FocusTrapStrategy } from "@concord-consortium/accessibility-tools/hooks";
import { getAriaLabels } from "./use-aria-labels";
import type { ClueFocusTrapConfig } from "./use-clue-accessibility";

/**
 * Maps CLUE tile concepts (content elements, tile type, toolbar portals) to the generic
 * FocusTrapStrategy interface from @concord-consortium/accessibility-tools.
 *
 * Each config property supports either a React ref or a getter function, so both
 * function components (refs) and class components (getters) can use it.
 */
export function createClueTileStrategy(config: ClueFocusTrapConfig): FocusTrapStrategy {
  const getContent = config.getContentElement
    ?? (() => config.contentRef?.current ?? undefined);
  const getTitle = config.getTitleElement
    ?? (() => config.titleRef?.current ?? undefined);
  const getToolbar = config.getToolbarElement
    ?? (() => config.toolbarRef?.current ?? undefined);

  const ariaLabels = getAriaLabels();

  return {
    getElements: () => ({
      content: getContent(),
      title: getTitle(),
      toolbar: getToolbar(),
    }),
    focusContent: config.focusContent,
    cycleOrder: ["title", "toolbar", "content"],
    announceEnter: ariaLabels.announce.editingTile(config.tileType),
    announceExit: ariaLabels.announce.exitedTile(config.tileType),
    getExternalElements: () => {
      const toolbar = getToolbar();
      return toolbar ? [toolbar] : [];
    },
  };
}
