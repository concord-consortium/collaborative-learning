// Marquee (rubber-band) selection over the dataflow canvas. A left-drag starting on the empty
// canvas draws a rectangle and selects every node it intersects; panning moves to space-drag or
// middle-mouse (see the drag guard in rete-manager). Node dragging is untouched (each node stops
// pointerdown propagation, so those drags never reach this controller).

export interface Rect { left: number; top: number; right: number; bottom: number; }

// Axis-aligned rectangle overlap (touching edges don't count as overlapping).
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function normalizeRect(x0: number, y0: number, x1: number, y1: number): Rect {
  return { left: Math.min(x0, x1), top: Math.min(y0, y1), right: Math.max(x0, x1), bottom: Math.max(y0, y1) };
}

const kDragThreshold = 3; // px of movement before a drag counts as a marquee (vs. a click)

interface MarqueeOptions {
  container: HTMLElement;
  // Screen-space (client) rects of the currently selectable node elements.
  getNodeRects: () => Array<{ id: string; rect: Rect }>;
  // Gestures that should pan/scroll instead of marquee-select (space-drag, middle-mouse).
  isPanGesture: (e: PointerEvent) => boolean;
  // Apply the selection. `additive` when a multi-select modifier was held at drag start.
  onSelect: (ids: string[], additive: boolean) => void;
}

export class MarqueeSelection {
  private startX = 0;
  private startY = 0;
  private additive = false;
  private marqueeEl: HTMLDivElement | null = null;

  constructor(private opts: MarqueeOptions) {
    opts.container.addEventListener("pointerdown", this.onPointerDown);
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;                       // left button only
    if (this.opts.isPanGesture(e)) return;            // space/middle-mouse pans instead
    // Drags that start on a node/control have their own handling (and stopPropagation), but guard
    // anyway so a marquee never begins on top of a block.
    if ((e.target as HTMLElement | null)?.closest?.(".node")) return;
    this.additive = e.shiftKey || e.ctrlKey || e.metaKey;
    this.startX = e.clientX;
    this.startY = e.clientY;
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.marqueeEl) {
      if (Math.abs(e.clientX - this.startX) < kDragThreshold
          && Math.abs(e.clientY - this.startY) < kDragThreshold) return;
      this.marqueeEl = document.createElement("div");
      this.marqueeEl.className = "dataflow-marquee";
      this.opts.container.appendChild(this.marqueeEl);
    }
    const c = this.opts.container.getBoundingClientRect();
    this.marqueeEl.style.left = `${Math.min(this.startX, e.clientX) - c.left}px`;
    this.marqueeEl.style.top = `${Math.min(this.startY, e.clientY) - c.top}px`;
    this.marqueeEl.style.width = `${Math.abs(e.clientX - this.startX)}px`;
    this.marqueeEl.style.height = `${Math.abs(e.clientY - this.startY)}px`;
  };

  private onPointerUp = (e: PointerEvent) => {
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    if (this.marqueeEl) {
      const rect = normalizeRect(this.startX, this.startY, e.clientX, e.clientY);
      const ids = this.opts.getNodeRects()
        .filter(n => rectsIntersect(rect, n.rect))
        .map(n => n.id);
      this.opts.onSelect(ids, this.additive);
      this.marqueeEl.remove();
      this.marqueeEl = null;
    }
  };

  destroy() {
    this.opts.container.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.marqueeEl?.remove();
    this.marqueeEl = null;
  }
}
