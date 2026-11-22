// Space left between a revealed tile and the edge of the visible area.
export const kRevealMarginPx = 8;

/**
 * The container's scrollTop, and vertical positions in client coordinates, as
 * getBoundingClientRect gives them.
 */
export interface IRevealGeometry {
  scrollTop: number;
  // The top and bottom of the part of the container that is not covered.
  visibleTop: number;
  visibleBottom: number;
  tileTop: number;
  tileBottom: number;
}

/**
 * The scrollTop that brings a tile into the visible area, or undefined when it is already there.
 * A tile that fits is scrolled the shortest way until it is fully visible, with a margin where
 * there is room. A tile taller than the area is scrolled the shortest way until it fills the area,
 * so a reader who has scrolled within it is left where they are.
 */
export function getRevealScrollTop(g: IRevealGeometry) {
  const { scrollTop, visibleTop, visibleBottom, tileTop, tileBottom } = g;
  if (tileTop >= visibleTop && tileBottom <= visibleBottom) return undefined;
  const spare = visibleBottom - visibleTop - (tileBottom - tileTop);
  let delta: number;
  if (spare >= 0) {
    const margin = Math.min(kRevealMarginPx, spare / 2);
    delta = tileTop < visibleTop ? tileTop - visibleTop - margin : tileBottom - visibleBottom + margin;
  } else {
    if (tileTop <= visibleTop && tileBottom >= visibleBottom) return undefined;
    delta = tileTop > visibleTop ? tileTop - visibleTop : tileBottom - visibleBottom;
  }
  return Math.max(0, scrollTop + delta);
}

/**
 * Smooth within one visible height, where the motion shows which way the change is; farther, a
 * smooth scroll crawls, so it jumps. Always jumps for a reader who asked for reduced motion.
 * "instant" rather than "auto", which defers to the container's CSS `scroll-behavior`.
 */
export function getRevealScrollBehavior(distance: number, visibleHeight: number, reducedMotion: boolean):
    ScrollBehavior {
  return !reducedMotion && Math.abs(distance) <= visibleHeight ? "smooth" : "instant";
}
