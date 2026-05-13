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
  const getTopbar = config.getTopbarElement
    ?? (() => config.topbarRef?.current ?? undefined);
  const getPalette = config.getPaletteElement
    ?? (() => config.paletteRef?.current ?? undefined);
  const getResize = config.getResizeElement
    ?? (() => config.resizeRef?.current ?? undefined);

  const ariaLabels = getAriaLabels();

  return {
    getElements: () => ({
      content: getContent(),
      title: getTitle(),
      toolbar: getToolbar(),
      topbar: getTopbar(),
      palette: getPalette(),
      resize: getResize(),
    }),
    focusContent: config.focusContent,
    tabHandlers: config.tabHandlers,
    escapeHandlers: config.escapeHandlers,
    // topbar sits between title and content — for tiles that have a secondary
    // controls strip above the editor (e.g. dataflow). palette sits between
    // content and toolbar so an inline secondary toolbar is a single tab stop
    // with internal arrow nav. findNextSlot skips slots whose elements are
    // undefined, so tiles that don't provide topbar/palette are unaffected.
    cycleOrder: ["title", "topbar", "content", "palette", "toolbar", "resize"],
    tabWithinSlots: ["topbar", "content"],
    announceEnter: ariaLabels.announce.editingTile(config.tileType),
    announceExit: ariaLabels.announce.exitedTile(config.tileType),
    getExternalElements: () => {
      const toolbar = getToolbar();
      return toolbar ? [toolbar] : [];
    },
    onTabWhenInactive: config.onTabWhenInactive,
  };
}
