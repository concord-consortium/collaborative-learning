import React, { useContext } from "react";
import { observer } from "mobx-react";
import { useTileDataMerging } from "../../hooks/use-tile-data-merging";
import { TileModelContext } from "../tiles/tile-api";
import { TileToolbarButton } from "./tile-toolbar-button";

import MergeInIcon from "../../assets/icons/dataset/merge-in-icon.svg";

interface IProps {
  name: string;
  isDisabled?: boolean;
}

export const MergeInButton = observer(function MergeButton({ name, isDisabled }: IProps) {
  const model = useContext(TileModelContext)!;
  const { isMergeEnabled, showMergeTileDialog } = useTileDataMerging({model});

  const handleClick = () => {
    showMergeTileDialog && showMergeTileDialog();
  };

  return (
    <TileToolbarButton
      name={name}
      onClick={handleClick}
      disabled={isDisabled || !isMergeEnabled}
    >
      <MergeInIcon />
    </TileToolbarButton>
  );
});
