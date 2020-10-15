interface IGetToolbarLocationArgs {
  documentContent?: HTMLElement | null;
  toolTile?: HTMLElement | null;
  toolbarHeight: number;
  minToolContent?: number;
  toolLeft?: number;
  toolBottom?: number;
}

export function getToolbarLocation({
                  documentContent, toolTile, toolbarHeight, minToolContent, toolLeft, toolBottom
                }: IGetToolbarLocationArgs) {
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  let minToolbarTop = minToolContent || 22;
  let maxToolbarTop = viewportHeight - toolbarHeight;
  let tileLeftOffset = 0;
  let tileTopOffset = 0;

  if (documentContent && toolTile) {
    const docBounds = documentContent.getBoundingClientRect();
    const textBounds = toolTile.getBoundingClientRect();
    const topOffset = textBounds.top - docBounds.top;
    const leftOffset = textBounds.left - docBounds.left;
    if ((topOffset != null) && (leftOffset != null)) {
      tileTopOffset = topOffset;
      tileLeftOffset = leftOffset;
    }
    minToolbarTop += topOffset;
    maxToolbarTop -= docBounds.top;
  }

  const toolbarLeft = toolLeft != null
                      ? tileLeftOffset + toolLeft - 4
                      : undefined;
  const toolbarTop = toolBottom != null
                    ? Math.max(Math.min(tileTopOffset + toolBottom - 2, maxToolbarTop), minToolbarTop)
                    : undefined;
  return [toolbarLeft, toolbarTop];
}
