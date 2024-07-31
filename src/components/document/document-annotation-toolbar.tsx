import React, { useEffect, useRef } from "react";
import { autoUpdate, FloatingPortal, useFloating, offset } from "@floating-ui/react";
import { observer } from "mobx-react-lite";
import classNames from "classnames";
import { useMemoOne } from "use-memo-one";
import { useStores } from "../../hooks/use-stores";
import { LogEventName } from "../../lib/logger-types";
import { logSparrowShowHide } from "../../models/tiles/log/log-sparrow-event";
import { ArrowShape } from "../../models/annotations/arrow-annotation";
import { HotKeys } from "../../utilities/hot-keys";
import { useTouchHold } from "../../hooks/use-touch-hold";

import HideAnnotationsIcon from "../../assets/icons/annotations/proportional-arrows-hide-icon.svg";
import ShowAnnotationsIcon from "../../assets/icons/annotations/proportional-arrows-show-icon.svg";
import CurvedSparrowIcon from "../../assets/icons/annotations/proportional-arrow-single-curved-mode-icon.svg";
import StraightSparrowIcon from "../../assets/icons/annotations/proportional-arrow-single-straight-mode-icon.svg";
import SmallCornerTriangle from "../../assets/icons/small-corner-triangle.svg";

const icons = new Map<string, React.FC>();
icons.set(ArrowShape.curved, CurvedSparrowIcon);
icons.set(ArrowShape.straight, StraightSparrowIcon);

const tooltips = new Map<string, string>();
tooltips.set(ArrowShape.curved, "Sparrow: curved");
tooltips.set(ArrowShape.straight, "Sparrow: straight");

export const DocumentAnnotationToolbar = observer(function DocumentAnnotationToolbar() {
  const { ui, persistentUI, appConfig } = useStores();
  const hotKeys = useMemoOne(() => new HotKeys(), []);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [ menuOpen, setMenuOpen ] = React.useState(false);
  const [ recentAnnotationMode, setRecentAnnotationMode ] = React.useState<ArrowShape>(ArrowShape.curved);


  // Make sure ESC cancels annotation mode,
  // even if the user just clicked on the annotation button so it, rather than the annotation layer, has focus.
  useEffect(() => {
    hotKeys.register({
      "escape": () => ui.setAnnotationMode()
    });
    return () => {
      hotKeys.unregister(["escape"]);
    };
  }, [hotKeys, ui]);

  function handleKeyDown(event: React.KeyboardEvent) {
    hotKeys.dispatch(event);
  }

  // Simple click of the menu button toggles annotation mode off or the most recently used mode back on
  function handleMenuButtonClick() {
    selectAnnotationMode(recentAnnotationMode);
    setMenuOpen(false);
  }

  // Touch-hold on the menu button opens the menu.
  function toggleMenu() {
    setMenuOpen(!menuOpen);
  }

  const { onTouchStart, onTouchEnd, onMouseDown, onMouseUp, onClick }
    = useTouchHold(toggleMenu, handleMenuButtonClick );

  if (!appConfig.showAnnotationControls) return null;

  /**
   * Switches to the given annotation mode, or toggles it off if already selected.
   */
  function selectAnnotationMode(mode: ArrowShape) {
    if (ui.annotationMode === mode) {
      ui.setAnnotationMode();
    } else {
      ui.setAnnotationMode(mode);
      setRecentAnnotationMode(mode);
      persistentUI.setShowAnnotations(true);
      ui.setSelectedTile();
    }
  }

  function handleAnnotationToggle() {
    ui.setAnnotationMode();
    persistentUI.setShowAnnotations(!persistentUI.showAnnotations);
    const showOrHideAnnotations = persistentUI.showAnnotations ? "Show" : "Hide";
    logSparrowShowHide(LogEventName.SPARROW_SHOW_HIDE, showOrHideAnnotations);
  }

  const displayMode = ui.annotationMode || recentAnnotationMode || ArrowShape.curved;
  const MenuIcon = icons.get(displayMode) || CurvedSparrowIcon;
  const menuTooltip = tooltips.get(displayMode);

  return (
    <div className="button-set sparrow-buttons" onKeyDown={handleKeyDown}>
      <button ref={menuButton}
        data-testid="mode-menu-button"
        title={menuTooltip}
        className={classNames({active: ui.annotationMode })}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onClick={onClick}
      >
        <MenuIcon/>
        <SmallCornerTriangle className="corner-triangle" onClick={(e) => { toggleMenu(); e.stopPropagation(); }} />
      </button>

      <button onClick={handleAnnotationToggle} data-testid="hide-annotations-button"
        title={persistentUI.showAnnotations ? "Hide annotations" : "Show annotations" } >
        { persistentUI.showAnnotations ? <HideAnnotationsIcon/> : <ShowAnnotationsIcon/> }
      </button>

      { menuOpen &&
        <AnnotationModeSelection trigger={menuButton} select={selectAnnotationMode} close={ ()=>setMenuOpen(false) } />
      }
    </div>
  );
});

interface IAnnotationModeSelectionProps {
  trigger: React.RefObject<HTMLButtonElement>;
  select: (mode: ArrowShape) => void;
  close: () => void;
}

export function AnnotationModeSelection ({ trigger, select , close }: IAnnotationModeSelectionProps) {
  const { ui } = useStores();
  const docElement: HTMLElement|undefined = trigger.current?.closest('.document') || undefined;

  const { refs, placement, floatingStyles, middlewareData } = useFloating({
    open: true,
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    // "offset" middleware gives a slight adjustment to align the borders.
    middleware: [ offset({ mainAxis: 0.5}) ],
    elements: {
      reference: trigger.current
    }
  });

  function handleButton(mode: ArrowShape) {
    return (event: React.MouseEvent) => {
      event.stopPropagation();
      select(mode);
      close();
    };
  }

  return (
    <FloatingPortal root={docElement || document.body}>
      <div
        ref={refs.setFloating}
        style={floatingStyles}
        data-testid="annotation-mode-selection"
        className={classNames("annotation-mode-selection", placement)}
      >
        <button data-testid="curved-sparrow-button"
          title="Sparrow: curved"
          onClick={handleButton(ArrowShape.curved)}
          className={classNames({ active: ui.annotationMode === ArrowShape.curved })}>
          <CurvedSparrowIcon/>
        </button>
        <button data-testid="straight-sparrow-button"
          title="Sparrow: straight"
          onClick={handleButton(ArrowShape.straight)}
          className={classNames({ active: ui.annotationMode === ArrowShape.straight })}>
          <StraightSparrowIcon />
        </button>
      </div>
    </FloatingPortal>
  );

}

export default DocumentAnnotationToolbar;
