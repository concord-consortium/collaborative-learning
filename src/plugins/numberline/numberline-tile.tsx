import { observer } from "mobx-react";
import React from "react";
import { ITileProps } from "../../components/tiles/tile-component";

import "./numberline-tile.scss";

export const NumberlineToolComponent: React.FC<ITileProps> = observer((props) => {
  return (
    <div className="numberline-tool">
      <textarea />
    </div>
  );
});
NumberlineToolComponent.displayName = "NumberlineToolComponent";
