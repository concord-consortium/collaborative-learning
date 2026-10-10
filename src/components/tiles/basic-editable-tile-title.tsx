import React from "react";

import { TileTitleArea } from "./tile-title-area";
import { EditableTileTitle, TitleTextInserter } from "./editable-tile-title";
import { measureText } from "./hooks/use-measure-text";
import { defaultTileTitleFont } from "../constants";

interface IBasicEditableTileTitleProps {
  titleKey?: string;
  className?: string;
  onBeginEdit?: () => void;
  onEndEdit?: (title?: string) => void;
  onBeforeClose?: () => void;
  onRegisterTextInserter?: (inserter: TitleTextInserter | null) => void;
  // rendered after the title, inside the title area
  children?: React.ReactNode;
}
export function BasicEditableTileTitle({
  titleKey, className, onBeginEdit, onEndEdit, onBeforeClose, onRegisterTextInserter, children
}: IBasicEditableTileTitleProps) {
  return (
    <TileTitleArea>
      <EditableTileTitle
        key={titleKey}
        className={className}
        measureText={(text) => measureText(text, defaultTileTitleFont)}
        onBeginEdit={onBeginEdit}
        onEndEdit={onEndEdit}
        onBeforeClose={onBeforeClose}
        onRegisterTextInserter={onRegisterTextInserter}
      />
      {children}
    </TileTitleArea>
  );
}
