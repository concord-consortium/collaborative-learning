interface IProps {
  target: Element | null
  portal?: Element | null
}

export function useOverlayBounds({ target, portal }: IProps) {
  const portalBounds = portal?.getBoundingClientRect();
  const targetBounds = target?.getBoundingClientRect();
  if (targetBounds) {

    const overlayProperties = {
      left: targetBounds.x - (portalBounds?.x ?? 0),
      top: targetBounds.y - (portalBounds?.y ?? 0),
      width: targetBounds.width,
      height: targetBounds.height
    };

    // TEMPORARY hack to use overlay on simple-attribute-label
    if (target?.classList.contains("simple-attribute-label")) {
      overlayProperties.left = overlayProperties.left - 50;
      overlayProperties.width = 100;
    }

    return overlayProperties;
  }
  return {};
}
