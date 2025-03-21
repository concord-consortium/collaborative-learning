import React from "react";

import { TileTitleArea } from "./tile-title-area";
import { EditableTileTitle } from "./editable-tile-title";
import { measureText } from "./hooks/use-measure-text";
import { defaultTileTitleFont } from "../constants";

interface IBasicEditableTileTitleProps {
  titleKey?: string;
  readOnly?: boolean;
}
export function BasicEditableTileTitle({ titleKey, readOnly }: IBasicEditableTileTitleProps) {
  return (
    <TileTitleArea>
      <EditableTileTitle
        key={titleKey}
        readOnly={readOnly}
        measureText={(text) => measureText(text, defaultTileTitleFont)}
      />
    </TileTitleArea>
  );
}
