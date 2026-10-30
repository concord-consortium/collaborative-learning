import { RefObject, useEffect, useMemo, useRef } from "react";
import { FocusTrapConfig, useFocusTrap } from "@concord-consortium/accessibility-tools/hooks";

interface TutorDrawerTrapOptions {
  containerRef: RefObject<HTMLElement | null>;
  // Ada's sidebar body wrapper — the trap's "content" slot
  bodyRef: RefObject<HTMLElement | null>;
  // close Ada and restore focus (owned by the caller)
  onEscape: () => void;
  // False while Ada's sidebar is mounted but the drawer's other tab is showing; the trap is then off.
  active: boolean;
  // The right drawer's tab buttons, which sit outside the sidebar. Tab reaches them as the
  // trap's "tabs" slot, so a keyboard user can switch to the other panel without closing Ada.
  drawerTabsRef?: RefObject<HTMLElement | null>;
}

// Tab/Shift+Tab containment and Escape for Ada's sidebar, via useFocusTrap.
// The sidebar is mounted only while Ada is open, and the config is undefined (trap off) while the
// drawer's other tab is showing. enterTrap() must be called explicitly each time the trap becomes active, after
// the hook's own effect (which sets descendants non-tabbable), or all controls would be left at
// tabindex=-1 with no initial focus.
//
// Strategy shape: a "content" slot (the body wrapper) and, while the drawer shows its tab
// buttons, a "tabs" slot. Both are in tabWithinSlots, so Tab walks each slot's focusable children
// before moving to the other. Both slots get the same escapeHandler; returning "handled" skips
// the trap's exit + container.focus(), letting the caller's focus restore stand (plain onExit
// cannot do this — the trap's container.focus() would clobber it).
export function useTutorDrawerTrap(
  { containerRef, bodyRef, onEscape, active, drawerTabsRef }: TutorDrawerTrapOptions
) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  const config: FocusTrapConfig | undefined = useMemo(() => {
    if (!active) return undefined;
    const escape = () => {
      onEscapeRef.current();
      return "handled" as const;
    };
    return {
      containerRef,
      strategy: {
        getElements: () => ({ content: bodyRef.current ?? undefined, tabs: drawerTabsRef?.current ?? undefined }),
        getExternalElements: () => (drawerTabsRef?.current ? [drawerTabsRef.current] : []),
        contentSlot: "content",
        cycleOrder: ["content", "tabs"],
        tabWithinSlots: ["content", "tabs"],
        // enterTrap() focuses the first cycleOrder slot, not the composer, so initial
        // focus is placed explicitly here.
        focusContent: () => {
          const composer = bodyRef.current?.querySelector<HTMLElement>(".chat-input");
          (composer ?? bodyRef.current)?.focus();
          return true;
        },
        escapeHandlers: { content: escape, tabs: escape }
      }
    };
  }, [containerRef, bodyRef, drawerTabsRef, active]);

  const trap = useFocusTrap(config);
  const trapRef = useRef(trap);
  trapRef.current = trap;

  useEffect(() => {
    if (active) trapRef.current?.enterTrap();
  }, [active]);
}
