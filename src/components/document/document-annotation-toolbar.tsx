import React from "react";
import { observer } from "mobx-react-lite";
import classNames from "classnames";
import { useStores } from "../../hooks/use-stores";
import { LogEventName } from "../../lib/logger-types";
import { logSparrowShowHide } from "../../models/tiles/log/log-sparrow-event";
import { kSparrowAnnotationMode } from "../../models/stores/persistent-ui";

import HideAnnotationsIcon from "../../assets/icons/annotations/proportional-arrows-hide-icon.svg";
import ShowAnnotationsIcon from "../../assets/icons/annotations/proportional-arrows-show-icon.svg";
import CurvedSparrowIcon from "../../assets/icons/annotations/proportional-arrow-single-curved-mode-icon.svg";

export const DocumentAnnotationToolbar = observer(function DocumentAnnotationToolbar() {
  const stores = useStores();
  const { ui, persistentUI } = stores;
  const sparrowActive = ui.annotationMode === kSparrowAnnotationMode;

  // Toolbar is enabled by any setting of 'annotation' in the config other than 'none'
  // in the future there will be more options supported.
  let showToolbar = stores.appConfig.annotations && stores.appConfig.annotations !== 'none';
  // we also enable it, for back-compatibility, if the toolbar has a 'hide-annotations' button specified
  if (stores.appConfig.toolbar.find(item => item.id === 'hide-annotations')) showToolbar  = true;
  if (!showToolbar) return null;

  function handleSparrow() {
    if (sparrowActive) {
      ui.setAnnotationMode();
    } else {
      ui.setAnnotationMode("sparrow");
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
    <div className="button-set sparrow-buttons">
      <button onClick={handleSparrow} data-testid="curved-sparrow-button"
        title="Sparrow"
        className={classNames({active: sparrowActive})}>
        <CurvedSparrowIcon/>
      </button>
      <button onClick={handleAnnotationToggle} data-testid="hide-annotations-button"
        title={persistentUI.showAnnotations ? "Hide annotations" : "Show annotations" } >
        { persistentUI.showAnnotations ? <HideAnnotationsIcon/> : <ShowAnnotationsIcon/> }
      </button>
    </div>
  );
});
