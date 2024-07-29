import React, { useEffect } from "react";
import { observer } from "mobx-react-lite";
import classNames from "classnames";
import { useMemoOne } from "use-memo-one";
import { useStores } from "../../hooks/use-stores";
import { LogEventName } from "../../lib/logger-types";
import { logSparrowShowHide } from "../../models/tiles/log/log-sparrow-event";
import { ArrowShape } from "../../models/annotations/arrow-annotation";
import { HotKeys } from "../../utilities/hot-keys";

import HideAnnotationsIcon from "../../assets/icons/annotations/proportional-arrows-hide-icon.svg";
import ShowAnnotationsIcon from "../../assets/icons/annotations/proportional-arrows-show-icon.svg";
import CurvedSparrowIcon from "../../assets/icons/annotations/proportional-arrow-single-curved-mode-icon.svg";
import StraightSparrowIcon from "../../assets/icons/annotations/proportional-arrow-single-straight-mode-icon.svg";

export const DocumentAnnotationToolbar = observer(function DocumentAnnotationToolbar() {
  const stores = useStores();
  const { ui, persistentUI } = stores;
  const hotKeys = useMemoOne(() => new HotKeys(), []);

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

  if (!stores.appConfig.showAnnotationControls) return null;

  /**
   * Switches to the given annotation mode, or toggles it off if already selected.
   * @param mode
   */
  function handleSparrow(mode: ArrowShape) {
    if (ui.annotationMode === mode) {
      ui.setAnnotationMode();
    } else {
      ui.setAnnotationMode(mode);
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

  return (
    <div className="button-set sparrow-buttons" onKeyDown={handleKeyDown}>
      <button onClick={() => handleSparrow(ArrowShape.curved)} data-testid="curved-sparrow-button"
        title="Sparrow: curved"
        className={classNames({active: ui.annotationMode === ArrowShape.curved})}>
        <CurvedSparrowIcon/>
      </button>
      <button onClick={() => handleSparrow(ArrowShape.straight)} data-testid="straight-sparrow-button"
        title="Sparrow: straight"
        className={classNames({active: ui.annotationMode === ArrowShape.straight})}>
        <StraightSparrowIcon/>
      </button>
      <button onClick={handleAnnotationToggle} data-testid="hide-annotations-button"
        title={persistentUI.showAnnotations ? "Hide annotations" : "Show annotations" } >
        { persistentUI.showAnnotations ? <HideAnnotationsIcon/> : <ShowAnnotationsIcon/> }
      </button>
    </div>
  );
});
