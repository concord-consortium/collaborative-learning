export class Rect {
  public left: number;
  public top: number;
  public width: number;
  public height: number;

  constructor(left: number, top: number, width: number, height: number) {
    this.left = left;
    this.top = top;
    this.width = width;
    this.height = height;
  }

  get right() {
    return this.left + this.width;
  }

  get bottom() {
    return this.top + this.height;
  }

  get isValid() {
    return isFinite(this.left) && isFinite(this.top) &&
            isFinite(this.width) && isFinite(this.height) &&
            (this.width > 0) && (this.height > 0);
  }
}

export function translateRectTo(r: Rect, x: number, y: number) {
  return new Rect(x, y, r.width, r.height);
}

export function translateRectBy(r: Rect, dx: number, dy: number) {
  return new Rect(r.left + dx, r.top + dy, r.width, r.height);
}

export function scaleRect(r: Rect, scale: number): Rect {
  return new Rect(r.left * scale, r.top * scale, r.width * scale, r.height * scale);
}

export function unionRect(r1: Rect, r2: Rect): Rect {
  if (!r2.isValid) return r1;
  if (!r1.isValid) return r2;
  const left = Math.min(r1.left, r2.left);
  const top = Math.min(r1.top, r2.top);
  const right = Math.max(r1.right, r2.right);
  const bottom = Math.max(r1.bottom, r2.bottom);
  return new Rect(left, top, right - left, bottom - top);
}

export function isIntersecting(r1: Rect, r2: Rect): boolean {
  return r1.isValid && r2.isValid &&
          !((r2.left >= r1.right) || (r2.right <= r1.left) ||
            (r2.top >= r1.bottom) || (r2.bottom <= r1.top));
}

export function intersectRect(r1: Rect, r2: Rect): Rect | undefined {
  if (!isIntersecting(r1, r1)) return;
  const left = Math.max(r1.left, r2.left);
  const top = Math.max(r1.top, r2.top);
  const right = Math.min(r1.right, r2.right);
  const bottom = Math.min(r1.bottom, r2.bottom);
  return new Rect(left, top, right - left, bottom - top);
}
