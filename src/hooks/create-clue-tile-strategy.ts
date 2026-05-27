import { FocusTrapStrategy } from "@concord-consortium/accessibility-tools/hooks";
import { getAriaLabels } from "./use-aria-labels";
import { getTileContentInfo } from "../models/tiles/tile-content-info";
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
  // Prefer the user-facing displayName ("Coordinate Grid" for `geometry`); the
  // fallback covers unit tests that pass synthetic tile-type strings.
  const announceName = getTileContentInfo(config.tileType)?.displayName ?? config.tileType;

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
    // topbar: optional controls strip above the editor (e.g. dataflow).
    // palette: inline secondary toolbar — single tab stop with arrow roving.
    // Slots with undefined elements are skipped, so tiles without
    // topbar/palette are unaffected.
    cycleOrder: ["title", "topbar", "content", "palette", "toolbar", "resize"],
    // Default within-slot Tab routing covers topbar + content. Tiles can opt
    // palette in via config when its controls are heterogeneous (XY Plot's
    // legend), or leave it out for arrow-roved palettes (dataflow's Add-block).
    tabWithinSlots: config.tabWithinSlots ?? ["topbar", "content"],
    announceEnter: ariaLabels.announce.editingTile(announceName),
    announceExit: ariaLabels.announce.exitedTile(announceName),
    getExternalElements: () => {
      const toolbar = getToolbar();
      return toolbar ? [toolbar] : [];
    },
    onTabWhenInactive: config.onTabWhenInactive,
    escapeHandlers: config.escapeHandlers,
    tabHandlers: config.tabHandlers,
  };
}
