import { useFloating, autoUpdate, offset, flip, shift, hide } from "@floating-ui/react";

import "./toolbar.scss";

export function useTileToolbarPositioning(tileElement: HTMLElement|null) {

  const canvasElement = tileElement?.closest('.canvas') as HTMLElement|| undefined;
  const boundary = canvasElement || 'clippingAncestors';

  const { refs, placement, floatingStyles, middlewareData } = useFloating({
    open: true,
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    // "offset" middleware accounts for margin width.
    // "shift" and "flip" keep toolbar in the viewport.
    // "hide" tells us not to display the toolbar if the active element has scrolled out of view.
    middleware: [offset({ mainAxis: -2, crossAxis: 1}),
      flip({mainAxis: true, crossAxis: true, fallbackStrategy: 'initialPlacement', boundary}),
      shift({crossAxis: true}),
      hide()
    ],
    elements: {
      reference: tileElement
    }
  });

  return { toolbarRefs: refs, toolbarStyles: floatingStyles, toolbarPlacement: placement, rootElement: canvasElement,
    hide: middlewareData.hide?.referenceHidden };
}
