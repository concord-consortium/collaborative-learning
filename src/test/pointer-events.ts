/**
 * Provides what jsdom lacks for pointer-event tests: pointer capture methods, and a PointerEvent
 * that carries `pointerId` along with the MouseEvent fields such as `clientX` and `shiftKey`.
 * Call it from `beforeAll`.
 */
export function mockPointerEvents() {
  HTMLElement.prototype.setPointerCapture = jest.fn();
  HTMLElement.prototype.releasePointerCapture = jest.fn();
  if (typeof PointerEvent === "undefined") {
    (global as any).PointerEvent = class PointerEvent extends MouseEvent {
      pointerId: number;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 0;
      }
    };
  }
}
