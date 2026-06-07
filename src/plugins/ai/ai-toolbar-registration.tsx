import React, { useContext } from "react";
import { observer } from "mobx-react";
import { TileModelContext } from "../../components/tiles/tile-api";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import {
  IToolbarButtonComponentProps, registerTileToolbarButtons
} from "../../components/toolbar/toolbar-button-manager";
import { AIContentModelType } from "./ai-content";

import RefreshIcon from "../wave-runner/assets/toolbar/clear-and-reset-icon.svg";

const RefreshButton = observer(function RefreshButton({ name }: IToolbarButtonComponentProps) {
  const model = useContext(TileModelContext);
  const content = model?.content as AIContentModelType | undefined;

  const handleClick = () => {
    content?.requestRefresh();
  };

  return (
    <TileToolbarButton
      name={name}
      title="Refresh AI analysis"
      onClick={handleClick}
    >
      <RefreshIcon />
    </TileToolbarButton>
  );
});

registerTileToolbarButtons("ai", [
  { name: "refresh", component: RefreshButton }
]);
