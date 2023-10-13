import React from "react";

import { TileTitleArea } from "./tile-title-area";
import { EditableTileTitle } from "./editable-tile-title";
import { measureText } from "./hooks/use-measure-text";
import { defaultTileTitleFont } from "../constants";

interface IBasicEditableTileTitleProps {
  readOnly?: boolean;
  titleKey?: string;
}
export function BasicEditableTileTitle({ readOnly, titleKey }: IBasicEditableTileTitleProps) {
  // console.log("\t🥩 readOnly:", readOnly);
  // console.log("\t🥩 titleKey:", titleKey);
  // console.log("📁 basic-editable-tile-title.tsx ------------------------");

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
