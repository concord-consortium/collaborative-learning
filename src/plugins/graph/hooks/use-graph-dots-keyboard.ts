import React, { useCallback, useEffect, useRef } from "react";
import { CaseData, DotsElt, graphDotSelector } from "../d3-types";
import { IDataConfigurationModel } from "../models/data-configuration-model";
import { activateDotSelection, buildDotAriaLabel } from "../utilities/graph-utils";

interface IUseGraphDotsKeyboardProps {
  dotsRef: React.MutableRefObject<DotsElt>;
  dataConfiguration: IDataConfigurationModel | undefined;
  readOnly: boolean;
}

/**
 * Finds the aria-live announcer element for the graph tile containing `start`.
 *
 * The announcer is rendered as a direct child of `.graph-wrapper`. We anchor
 * on the nearest `.graph-wrapper` ancestor and use `:scope >` so the query
 * only matches that direct child — never descendants. That keeps the lookup
 * correct in nested-tile setups (e.g. a graph tile inside a question tile
 * that contains another graph), where a plain descendant query could match
 * the wrong announcer.
 */
function findAnnouncer(start: Element | null): HTMLElement | null {
  if (!start) return null;
  const wrapper = start.closest(".graph-wrapper");
  return wrapper?.querySelector<HTMLElement>(":scope > [data-graph-announcer]") ?? null;
}

interface IDotEntry {
  element: SVGGElement;
  caseData: CaseData;
  screenX: number;
  screenY: number;
}

/**
 * Reads the dot's current screen position from its `transform="translate(x y)"`
 * attribute (set by `setPointCoordinates`). Returns Infinity coordinates for dots
 * that don't have a transform yet so they sort to the end.
 */
function readDotPosition(g: SVGGElement): { x: number; y: number } {
  const transform = g.getAttribute("transform");
  if (!transform) return { x: Infinity, y: Infinity };
  // setPointCoordinates writes `translate(x y)` (space-separated, no comma).
  const match = /translate\(([-\d.]+)\s+([-\d.]+)\)/.exec(transform);
  if (!match) return { x: Infinity, y: Infinity };
  return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
}

/**
 * Roving-tabindex keyboard navigation over the data points in a single graph layer.
 *
 * Bind by passing a ref to the layer's dots-group surrogate (the `<svg ref={dotsRef}>`
 * element created by GraphLayer) and the layer's data configuration. The hook
 * attaches `focus` and `keydown` handlers that:
 * - On group focus: focus the previously-roved dot (by case ID), or the first dot.
 * - Arrow keys (Left/Right/Up/Down): move focus among dots in screen-reading order
 *   (screen X first, then screen Y, with case ID as a stability tiebreak).
 * - Home / End: jump to first / last dot.
 * - Enter / Space: toggle the case's selection (Shift extends the existing selection).
 *   Read-only graphs no-op selection silently.
 *
 * The hook tracks the focused dot by **case ID** (not array index) so that dot
 * drags or data updates that reorder the sorted list don't strand focus on the
 * wrong case.
 *
 * Selection-change announcements are routed to the nearest tile's `[data-graph-announcer]`
 * aria-live region (located via DOM walk from `dotsRef.current`) — debounced via
 * requestAnimationFrame so rapid arrow + Enter sequences don't overlap.
 *
 * @param props.dotsRef Layer's dots-group surrogate, where `.graph-dot` children live.
 * @param props.dataConfiguration Layer data configuration (for selection toggling
 *   and aria-label refresh).
 * @param props.readOnly When true, Enter / Space silently no-op on selection.
 */
export function useGraphDotsKeyboard(props: IUseGraphDotsKeyboardProps) {
  const { dotsRef, dataConfiguration, readOnly } = props;

  // Track the focused dot's case ID across re-renders. Tracking by ID rather than
  // index keeps focus stable when point positions shift.
  const focusedCaseIdRef = useRef<string | null>(null);

  // Dev-mode stability guard: warn if the dots-group container identity changes
  // between effect runs, which would invalidate D3-attached event handlers.
  const lastContainerRef = useRef<DotsElt>(null);

  /**
   * Collects dots in reading order (screen X first, then screen Y, then caseID).
   * Recomputed on every key event because dot positions can change between events.
   */
  const collectSortedDots = useCallback((): IDotEntry[] => {
    const container = dotsRef.current;
    if (!container) return [];
    const elements = Array.from(
      container.querySelectorAll<SVGGElement>(graphDotSelector)
    );
    const entries: IDotEntry[] = elements
      .map(element => {
        // D3 attaches the bound datum under __data__.
        const datum = (element as unknown as { __data__?: CaseData }).__data__;
        if (!datum) return undefined;
        const { x, y } = readDotPosition(element);
        return { element, caseData: datum, screenX: x, screenY: y };
      })
      .filter((entry): entry is IDotEntry => entry !== undefined);
    entries.sort((a, b) => {
      if (a.screenX !== b.screenX) return a.screenX - b.screenX;
      if (a.screenY !== b.screenY) return a.screenY - b.screenY;
      return a.caseData.caseID.localeCompare(b.caseData.caseID);
    });
    return entries;
  }, [dotsRef]);

  const focusEntry = useCallback((entry: IDotEntry | undefined) => {
    if (!entry) return;
    // `.keyboard-focused` is a fallback for Safari, whose `:focus-visible`
    // doesn't fire reliably on programmatically-focused SVG elements. Pair it
    // with `.focus()` so the focus ring appears across all supported browsers.
    const container = dotsRef.current;
    container?.querySelectorAll<SVGGElement>(".graph-dot.keyboard-focused")
      .forEach(el => el.classList.remove("keyboard-focused"));
    focusedCaseIdRef.current = entry.caseData.caseID;
    entry.element.classList.add("keyboard-focused");
    entry.element.focus();
  }, [dotsRef]);

  const announce = useCallback((message: string) => {
    const region = findAnnouncer(dotsRef.current);
    if (!region) return;
    // Debounce via requestAnimationFrame so rapid arrow-key + Enter sequences don't
    // produce overlapping announcements. Setting textContent to '' first forces
    // screen readers to re-announce identical messages.
    requestAnimationFrame(() => {
      region.textContent = "";
      requestAnimationFrame(() => {
        region.textContent = message;
      });
    });
  }, [dotsRef]);

  useEffect(() => {
    const container = dotsRef.current;
    if (!container) return;

    if (process.env.NODE_ENV !== "production"
        && lastContainerRef.current
        && lastContainerRef.current !== container) {
      console.warn(
        "[useGraphDotsKeyboard] dots-group container identity changed between renders; "
        + "this can break D3-attached event handlers."
      );
    }
    lastContainerRef.current = container;

    const handleFocus = (e: FocusEvent) => {
      // Only respond when the group surrogate itself receives focus (not a dot
      // bubbling up). When Tab enters the group, focus the previously-roved dot
      // or fall back to the first dot in reading order.
      if (e.target !== container) return;
      const entries = collectSortedDots();
      if (entries.length === 0) return;
      const remembered = focusedCaseIdRef.current
        ? entries.find(entry => entry.caseData.caseID === focusedCaseIdRef.current)
        : undefined;
      focusEntry(remembered ?? entries[0]);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const entries = collectSortedDots();
      if (entries.length === 0) return;
      const currentIndex = focusedCaseIdRef.current
        ? entries.findIndex(entry => entry.caseData.caseID === focusedCaseIdRef.current)
        : -1;
      const lastIndex = entries.length - 1;

      let nextIndex: number | undefined;
      let consume = false;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % entries.length;
          consume = true;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          nextIndex = currentIndex < 0 ? lastIndex : (currentIndex - 1 + entries.length) % entries.length;
          consume = true;
          break;
        case "Home":
          nextIndex = 0;
          consume = true;
          break;
        case "End":
          nextIndex = lastIndex;
          consume = true;
          break;
        case "Enter":
        case " ": {
          consume = true;
          if (readOnly) break;
          const focusedEntry = currentIndex >= 0 ? entries[currentIndex] : entries[0];
          if (!focusedEntry) break;
          activateDotSelection(focusedEntry.caseData, dataConfiguration, e.shiftKey);
          // Re-read the aria-label so the announcement reflects the post-activation state.
          const label = buildDotAriaLabel(focusedEntry.caseData, dataConfiguration);
          announce(label);
          break;
        }
        default:
          return;
      }

      if (consume) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (nextIndex !== undefined) {
        const nextEntry = entries[nextIndex];
        focusEntry(nextEntry);
        announce(buildDotAriaLabel(nextEntry.caseData, dataConfiguration));
      }
    };

    // Clear the `.keyboard-focused` ring fallback (see focusEntry) when focus
    // leaves the dots group entirely. focusout bubbles, so we get notified
    // whether the user tabs away from the group or from a focused child dot.
    const handleFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (next && container.contains(next)) return;
      container.querySelectorAll<SVGGElement>(".graph-dot.keyboard-focused")
        .forEach(el => el.classList.remove("keyboard-focused"));
    };

    container.addEventListener("focus", handleFocus);
    container.addEventListener("keydown", handleKeyDown);
    container.addEventListener("focusout", handleFocusOut);
    return () => {
      container.removeEventListener("focus", handleFocus);
      container.removeEventListener("keydown", handleKeyDown);
      container.removeEventListener("focusout", handleFocusOut);
    };
  }, [dotsRef, collectSortedDots, dataConfiguration, focusEntry, readOnly, announce]);
}
