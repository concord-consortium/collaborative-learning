import { useFloating, autoUpdate, offset, flip, shift } from "@floating-ui/react";

import "./toolbar.scss";

export function useTileToolbarPositioning(tileElement: HTMLElement|null) {

  const canvas = tileElement?.closest('.canvas') || 'clippingAncestors';

  const { refs, placement, floatingStyles } = useFloating({
    open: true,
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    // Offset accounts for margin width. Shift and flip keep toolbar in the viewport.
    middleware: [offset({ mainAxis: -2}),
      flip({mainAxis: true, crossAxis: true, fallbackStrategy: 'initialPlacement', boundary: canvas}),
      shift({crossAxis: true})],
    elements: {
      reference: tileElement
    }
  });

  return { toolbarRefs: refs, toolbarStyles: floatingStyles, toolbarPlacement: placement };
}
