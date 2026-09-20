import React, { useContext, useEffect, useRef } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { TileToolbarButton } from "../../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../../components/toolbar/toolbar-button-manager";
import { TileModelContext } from "../../../../components/tiles/tile-api";
import { useTouchHold } from "../../../../hooks/use-touch-hold";
import { DataflowReteManagerContext } from "../dataflow-rete-manager-context";
import { DataflowContentModelType, PanDirection } from "../../model/dataflow-content";
import { MIN_ZOOM, MAX_ZOOM, kPanStep } from "../../rete/rete-manager";

import ZoomInIcon from "../../../../clue/assets/icons/zoom-in-icon.svg";
import ZoomOutIcon from "../../../../clue/assets/icons/zoom-out-icon.svg";
import FitViewIcon from "../../../../clue/assets/icons/fit-view-icon.svg";
import NavigatorScrollIcon from "../../../../assets/icons/navigator-scroll-icon.svg";
import SmallCornerTriangle from "../../../../assets/icons/small-corner-triangle.svg";

import "./dataflow-pan-palette.scss";

// Zoom state is read from the observable MST mirror (liveProgramZoom) — area.transform is a plain
// field, so an observer would not re-render on it.
export const ZoomInButton = observer(function ZoomInButton({ name }: IToolbarButtonComponentProps) {
  const reteManager = useContext(DataflowReteManagerContext);
  const disabled = !reteManager || reteManager.mstContent.liveProgramZoom.scale >= MAX_ZOOM;

  function handleClick() {
    reteManager?.zoomIn();
  }

  return (
    <TileToolbarButton name={name} title="Zoom In" onClick={handleClick} disabled={disabled}>
      <ZoomInIcon />
    </TileToolbarButton>
  );
});

export const ZoomOutButton = observer(function ZoomOutButton({ name }: IToolbarButtonComponentProps) {
  const reteManager = useContext(DataflowReteManagerContext);
  const disabled = !reteManager || reteManager.mstContent.liveProgramZoom.scale <= MIN_ZOOM;

  function handleClick() {
    reteManager?.zoomOut();
  }

  return (
    <TileToolbarButton name={name} title="Zoom Out" onClick={handleClick} disabled={disabled}>
      <ZoomOutIcon />
    </TileToolbarButton>
  );
});

export const FitAllButton = observer(function FitAllButton({ name }: IToolbarButtonComponentProps) {
  const reteManager = useContext(DataflowReteManagerContext);
  const disabled = !reteManager || reteManager.mstContent.program.nodes.size === 0;

  function handleClick() {
    reteManager?.fitContent();
  }

  return (
    <TileToolbarButton name={name} title="Fit all" onClick={handleClick} disabled={disabled}>
      <FitViewIcon />
    </TileToolbarButton>
  );
});

// Deltas match the tile's own arrow-key panning (setupArrowKeyPan): pan() translates the content,
// so revealing content above ("pan up") moves it down by a positive dy.
const panDeltas: Record<PanDirection, { dx: number, dy: number }> = {
  up:    { dx: 0,         dy: kPanStep },
  down:  { dx: 0,         dy: -kPanStep },
  left:  { dx: kPanStep,  dy: 0 },
  right: { dx: -kPanStep, dy: 0 },
};

const panDirections: PanDirection[] = ["up", "down", "left", "right"];

const panLabel = (direction: PanDirection) => `Pan ${direction}`;

const arrowKeyDirections: Record<string, PanDirection> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right"
};

interface IPanPaletteProps {
  onSelect: (direction: PanDirection) => void;
  onClose: () => void;
}

/** The four direction controls, modeled on geometry's color-palette. */
function PanPalette({ onSelect, onClose }: IPanPaletteProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyed by class rather than position so this and `panDirections` can't drift apart.
  const focusArrow = (direction: PanDirection) =>
    containerRef.current?.querySelector<HTMLElement>(`.dataflow-pan-button.${direction}`)?.focus();

  // The palette renders as the trigger's sibling (extraContent); closing removes the focused arrow,
  // so hand focus back to the trigger first.
  const refocusTrigger = () =>
    containerRef.current?.parentElement?.querySelector<HTMLButtonElement>("button.toolbar-button")?.focus();

  useEffect(() => {
    focusArrow(panDirections[0]);
    // Mount-only: re-running on re-render would yank focus back to the first arrow.
  }, []);

  // Capture phase is required for Escape: the toolbar's focus-trap exit is a native capture-phase
  // listener on the toolbar container (tile-toolbar.tsx), and React delegates above it, so only a
  // React capture handler runs first. Arrows are stopped here too — otherwise they reach both the
  // toolbar's roving tabindex (bubble) and the tile's window-level arrow-pan (rete-manager).
  function handleKeyDownCapture(e: React.KeyboardEvent) {
    const direction = arrowKeyDirections[e.key];
    if (e.key !== "Escape" && !direction) return;
    e.stopPropagation();
    e.preventDefault();
    if (e.key === "Escape") {
      refocusTrigger();
      onClose();
      return;
    }
    focusArrow(direction);
  }

  function handleSelect(e: React.SyntheticEvent, direction: PanDirection) {
    e.stopPropagation();
    if ("key" in e) (e as React.KeyboardEvent).preventDefault();
    onSelect(direction);
  }

  return (
    <div ref={containerRef} className="toolbar-palette dataflow-pan-palette"
        role="group" aria-label="Pan directions" onKeyDownCapture={handleKeyDownCapture}>
      <div className="palette-buttons">
        {panDirections.map((direction) => (
          // `div role="button"`, not a real button: the toolbar's roving tabindex sweeps
          // querySelectorAll("button"), which would pull the arrows into its Left/Right cycle.
          <div key={direction} role="button" tabIndex={0}
              aria-label={panLabel(direction)} title={panLabel(direction)}
              className={classNames("dataflow-pan-button", direction)}
              onClick={(e) => handleSelect(e, direction)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleSelect(e, direction);
              }}>
            <NavigatorScrollIcon />
          </div>
        ))}
      </div>
    </div>
  );
}

// Split button like drawing's AlignButton: the face shows and re-performs the last pan direction
// (default right); the corner triangle (or touch-hold) opens the palette to pick another.
export const PanButton = observer(function PanButton({ name }: IToolbarButtonComponentProps) {
  const reteManager = useContext(DataflowReteManagerContext);
  // Toolbar-only state lives on the real tile content: the active manager's mstContent is a snapshot
  // COPY during recorded-data playback, whose volatiles would reset the remembered direction on every
  // mode change. Pan operations still go to the active manager, which owns the visible canvas.
  const content = useContext(TileModelContext)?.content as DataflowContentModelType | undefined;
  const isOpen = !!content?.panPaletteOpen;
  const lastDirection = content?.lastPanDirection ?? "right";

  // Deselecting the tile unmounts the toolbar; the model volatile would otherwise stay open.
  useEffect(() => () => content?.setPanPaletteOpen(false), [content]);

  // Clicking anywhere outside the trigger or the palette closes the flyout (capture phase, so a
  // click that something else swallows still closes it).
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.(".toolbar-button.pan, .dataflow-pan-palette")) return;
      // Opening moved focus into the palette, and closing unmounts the focused arrow — without
      // handing focus back, it falls to <body> and the next Tab restarts at the top of the
      // document. Only matters when the palette actually holds focus; a press that lands on
      // something focusable still claims focus itself, since that happens after pointerdown.
      const focusedPalette = document.activeElement?.closest(".dataflow-pan-palette");
      focusedPalette?.parentElement?.querySelector<HTMLButtonElement>("button.toolbar-button")?.focus();
      content?.setPanPaletteOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isOpen, content]);

  const { onClick } = useTouchHold(toggleOpen, panLastDirection);

  function toggleOpen() {
    content?.setPanPaletteOpen(!isOpen);
  }

  function pan(direction: PanDirection) {
    const { dx, dy } = panDeltas[direction];
    void reteManager?.pan(dx, dy);
  }

  function panLastDirection() {
    content?.setPanPaletteOpen(false);
    pan(lastDirection);
  }

  function handleTriangleClick(e: React.MouseEvent) {
    e.stopPropagation();
    toggleOpen();
  }

  // Panning is repetitive, so selecting a direction pans and leaves the palette open for more
  // clicks; only Escape, the triangle, the face, or deselecting the tile closes it.
  function handleSelect(direction: PanDirection) {
    content?.setLastPanDirection(direction);
    pan(direction);
  }

  const palette = isOpen
    ? <PanPalette onSelect={handleSelect} onClose={() => content?.setPanPaletteOpen(false)} />
    : undefined;

  return (
    <TileToolbarButton name={name} title={panLabel(lastDirection)} disabled={!reteManager}
        onClick={onClick} onTouchHold={toggleOpen} extraContent={palette}>
      <span className={classNames("dataflow-pan-face", lastDirection)}>
        <NavigatorScrollIcon />
      </span>
      <SmallCornerTriangle
        onClick={handleTriangleClick}
        className="corner-triangle expand-collapse"
        data-testid="pan-expand-triangle"
      />
    </TileToolbarButton>
  );
});
