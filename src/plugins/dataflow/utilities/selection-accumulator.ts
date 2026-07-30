// Tracks whether a multi-select modifier is currently held, for rete's `selectableNodes`
// accumulating option. Like AreaExtensions.accumulateOnCtrl() but also allows Shift, the more
// natural multi-select modifier, and Meta on macOS.

export interface ISelectionAccumulator {
  active: () => boolean;
  destroy: () => void;
}

export function accumulateOnModifier(): ISelectionAccumulator {
  let pressed = false;
  // Read the event's own modifier state rather than toggling a flag per key. Toggling turned
  // accumulation off as soon as any one modifier came up, so holding Ctrl+Shift and releasing just
  // Shift silently ended additive selection mid-gesture. A modifier's flag is already set on its
  // keydown and already cleared on its own keyup, so this is true while any of them is held and
  // false once the last one is released.
  const sync = (e: KeyboardEvent) => { pressed = e.shiftKey || e.ctrlKey || e.metaKey; };
  document.addEventListener("keydown", sync);
  document.addEventListener("keyup", sync);
  return {
    active: () => pressed,
    destroy: () => {
      document.removeEventListener("keydown", sync);
      document.removeEventListener("keyup", sync);
    }
  };
}
