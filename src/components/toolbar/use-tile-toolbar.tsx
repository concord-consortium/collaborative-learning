import { useFloating, autoUpdate, flip } from "@floating-ui/react";

import "./toolbar.scss";

export function useTileToolbar(tileElement: HTMLElement|null) {

  const { refs, floatingStyles } = useFloating({
    open: true,
    placement: "bottom-end",  // TODO eventually move to bottom-start
    whileElementsMounted: autoUpdate,
    middleware: [flip()],
    elements: {
      reference: tileElement
    }
  });

  return { refs, toolbarStyles: floatingStyles };
}
