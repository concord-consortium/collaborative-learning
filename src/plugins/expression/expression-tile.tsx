import { observer } from "mobx-react";
import React, { DOMAttributes, useRef, useEffect, FormEvent } from "react";
import { onSnapshot } from "mobx-state-tree";
import "mathlive"; // separate static import of library for initialization to run
// eslint-disable-next-line no-duplicate-imports
import type { MathfieldElementAttributes, MathfieldElement } from "mathlive";
import { ITileProps } from "../../components/tiles/tile-component";
import { ExpressionContentModelType } from "./expression-content";
import { CustomEditableTileTitle } from "../../components/tiles/custom-editable-tile-title";
import { replaceKeyBinding } from "./expression-tile-utils";
import { useUIStore } from "../../hooks/use-stores";
import { ITileApi } from "../../components/tiles/tile-api";
// import { useToolbarTileApi } from "../../components/tiles/hooks/use-toolbar-tile-api";
import { ExpressionToolbar } from "./expression-toolbar";

import "./expression-tile.scss";

type CustomElement<T> = Partial<T & DOMAttributes<T>>;
declare global {
  namespace JSX { // eslint-disable-line @typescript-eslint/no-namespace
    interface IntrinsicElements {
      ["math-field"]: CustomElement<MathfieldElementAttributes>;
    }
  }
}

const undoKeys = ["cmd+z", "[Undo]", "ctrl+z"];

export const ExpressionToolComponent: React.FC<ITileProps> = observer((props) => {
  const content = props.model.content as ExpressionContentModelType;
  const mf = useRef<MathfieldElement>(null);
  const trackedCursorPos = useRef<number>(0);
  const ui = useUIStore();

  if(mf.current && ui) {
    mf.current.addEventListener("focus", () => ui.setSelectedTileId(props.model.id));
  }

  if (mf.current?.keybindings){
    undoKeys.forEach((key: string) => {
      mf.current && replaceKeyBinding(mf.current.keybindings, key, "");
    });
  }

  const handleIsEnabled = () => {
    if (ui) {
      return ui.selectedTileIds.includes(props.model.id);
    } else {
      return false;
    }
  };

  useEffect(() => {
    // when we change model via undo button, we need to update mathfield
    const disposer = onSnapshot((content as any), () => {
      if (mf.current?.getValue() === content.latexStr) return;
      mf.current?.setValue(content.latexStr, {suppressChangeNotifications: true});
      if (mf.current?.position) mf.current.position = trackedCursorPos.current - 1;
    });
    return () => disposer();
  }, [content]);

  const handleChange = (e: FormEvent<MathfieldElementAttributes>) => {
    trackedCursorPos.current =  mf.current?.position || 0;
    content.setLatexStr((e.target as any).value);
  };

  return (
    <div className="expression-tool">
      <div className="expression-title-area">
        <CustomEditableTileTitle
          model={props.model}
          onRequestUniqueTitle={props.onRequestUniqueTitle}
          readOnly={props.readOnly}
        />
      </div>
      <div className="expression-math-area">
        <math-field
          ref={mf}
          value={content.latexStr}
          onInput={handleChange}
          // MathLive only interprets undefined as false
          readOnly={props.readOnly === true ? true : undefined}
        />
      </div>
      <ExpressionToolbar
        model={props.model}
        documentContent={props.documentContent}
        tileElt={props.tileElt}
        handleDeleteValue={() => console.log("| delete value func should be passed down?")}
        onIsEnabled={handleIsEnabled}
        onRegisterTileApi={(tileApi: ITileApi) => console.log("| register tileApi", tileApi)}
        onUnregisterTileApi={() => console.log("| unregister tileApi")}
      />
    </div>
  );
});
ExpressionToolComponent.displayName = "ExpressionToolComponent";
