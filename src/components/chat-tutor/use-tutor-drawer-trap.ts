import { RefObject, useEffect, useMemo, useRef } from "react";
import { FocusTrapConfig, useFocusTrap } from "@concord-consortium/accessibility-tools/hooks";

interface TutorDrawerTrapOptions {
  containerRef: RefObject<HTMLElement | null>;
  // the drawer body wrapper — the trap's single "content" slot
  bodyRef: RefObject<HTMLElement | null>;
  // close the drawer + restore focus to the launcher (owned by the caller)
  onEscape: () => void;
  // False while the drawer is mounted but another tab is showing; the trap is then off.
  active: boolean;
}

// Tab/Shift+Tab containment and Escape for the tutor drawer, via useFocusTrap.
// The drawer is mounted only while open, and the config is undefined (trap off) while another
// tab is showing. enterTrap() must be called explicitly each time the trap becomes active, after
// the hook's own effect (which sets descendants non-tabbable), or all controls would be left at
// tabindex=-1 with no initial focus.
//
// Strategy shape: one "content" slot (the body wrapper), listed in tabWithinSlots so
// Tab walks the body's focusable children instead of cycling back immediately. One
// slot also means Escape is always in the content slot, so the single escapeHandler
// always fires; returning "handled" skips the trap's exit + container.focus(), letting
// the caller's launcher-restore stand (plain onExit cannot do this — the trap's
// container.focus() would clobber it).
export function useTutorDrawerTrap({ containerRef, bodyRef, onEscape, active }: TutorDrawerTrapOptions) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  const config: FocusTrapConfig | undefined = useMemo(() => active ? ({
    containerRef,
    strategy: {
      getElements: () => ({ content: bodyRef.current ?? undefined }),
      contentSlot: "content",
      cycleOrder: ["content"],
      tabWithinSlots: ["content"],
      // enterTrap() focuses the first cycleOrder slot, not the composer, so initial
      // focus is placed explicitly here.
      focusContent: () => {
        const composer = bodyRef.current?.querySelector<HTMLElement>(".chat-input");
        (composer ?? bodyRef.current)?.focus();
        return true;
      },
      escapeHandlers: {
        content: () => {
          onEscapeRef.current();
          return "handled" as const;
        }
      }
    }
  }) : undefined, [containerRef, bodyRef, active]);

  const trap = useFocusTrap(config);
  const trapRef = useRef(trap);
  trapRef.current = trap;

  useEffect(() => {
    if (active) trapRef.current?.enterTrap();
  }, [active]);
}
