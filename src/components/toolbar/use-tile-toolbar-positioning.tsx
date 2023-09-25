import { useFloating, autoUpdate, flip, offset, shift } from "@floating-ui/react";

import "./toolbar.scss";

export function useTileToolbarPositioning(tileElement: HTMLElement|null) {

  const { refs, placement, floatingStyles } = useFloating({
    open: true,
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    // Offset accounts for margin. Shift and flip attempt to keep toolbar in the viewport.
    middleware: [offset({ crossAxis: -2}), flip(), shift()],
    elements: {
      reference: tileElement
    }
  });

  return { toolbarRefs: refs, toolbarStyles: floatingStyles, toolbarPlacement: placement };
}
