export interface IGetToolbarLocationBaseArgs {
  documentContent?: HTMLElement | null;
  toolTile?: HTMLElement | null;
  scale?: number;
  toolbarHeight: number;
  minToolContent?: number;
  toolbarLeftOffset?: number;
  toolbarTopOffset?: number;
}

interface IGetToolbarLocationArgs extends IGetToolbarLocationBaseArgs {
  toolLeft?: number;
  toolBottom?: number;
}

export function getToolbarLocation({
  documentContent, toolTile, scale,
  toolbarHeight, minToolContent, toolLeft, toolBottom, toolbarLeftOffset, toolbarTopOffset
}: IGetToolbarLocationArgs) {
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  let minToolbarTop = minToolContent || 30;
  let maxToolbarTop = viewportHeight - toolbarHeight;
  let tileLeftOffset = 0;
  let tileTopOffset = 0;

  if (documentContent && toolTile) {
    const _scale = scale || 1;
    const docBounds = documentContent.getBoundingClientRect();
    const tileBounds = toolTile.getBoundingClientRect();
    const topOffset = tileBounds.top - docBounds.top;
    const leftOffset = tileBounds.left - docBounds.left;
    if ((topOffset != null) && (leftOffset != null)) {
      tileTopOffset = topOffset / _scale;
      tileLeftOffset = leftOffset / _scale;
    }
    minToolbarTop += topOffset;
    maxToolbarTop -= docBounds.top;
  }

  const toolbarLeft = toolLeft != null
                      ? tileLeftOffset + toolLeft + (toolbarLeftOffset || 0)
                      : undefined;
  const toolbarTop = toolBottom != null
                    ? Math.max(
                        Math.min(tileTopOffset + toolBottom + (toolbarTopOffset || 0), maxToolbarTop),
                        minToolbarTop)
                    : undefined;
  const spaceBelow = toolbarTop ? maxToolbarTop - toolbarTop : undefined;
  return { left: toolbarLeft, top: toolbarTop, spaceBelow };
}
