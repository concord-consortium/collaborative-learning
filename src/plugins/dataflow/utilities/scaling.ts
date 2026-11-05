import { IContentBounds, MAX_ZOOM, MIN_ZOOM } from "../rete/rete-manager";

// A node is drawn at its default size at scale 1; fitting must never choose more than that.
// This only limits what Fit all picks; zooming in by hand allows MAX_ZOOM.
export const kMaxFitScale = 1;

/** The scale and offset that fit `bounds` into the container, centred, without enlarging it. */
export function calculateFitTransform(bounds: IContentBounds, containerWidth: number, containerHeight: number) {
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;

  if (contentWidth <= 0 || contentHeight <= 0) {
    return { scale: 1, offsetX: 0, offsetY: 0 };
  }

  // Add some padding around the content.
  const padding = 20;
  const availableWidth = Math.max(0, containerWidth - 2 * padding);
  const availableHeight = Math.max(0, containerHeight - 2 * padding);

  // Calculate the scale needed to fit content within container.
  let scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
  scale = Math.min(kMaxFitScale, Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale)));

  // Calculate the offset for centering content.
  const scaledContentWidth = contentWidth * scale;
  const scaledContentHeight = contentHeight * scale;
  const offsetX = (containerWidth - scaledContentWidth) / 2 - bounds.minX * scale;
  const offsetY = (containerHeight - scaledContentHeight) / 2 - bounds.minY * scale;

  return { scale, offsetX, offsetY };
}
