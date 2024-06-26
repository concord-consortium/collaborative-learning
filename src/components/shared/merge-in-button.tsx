import React, { useContext } from "react";
import { observer } from "mobx-react";
import { useTileDataMerging } from "../../hooks/use-tile-data-merging";
import { TileModelContext } from "../tiles/tile-api";
import { TileToolbarButton } from "./tile-toolbar-button";

import MergeInIcon from "../../assets/icons/dataset/merge-in-icon.svg";

interface IProps {
  isDisabled?: boolean;
}

/**
 * Deprecated; Tiles should move to the shared toolbar components in src/components/toolbar
 */
export const MergeInButton = observer(function MergeButton({ isDisabled }: IProps) {
  const model = useContext(TileModelContext)!;
  const { isMergeEnabled, showMergeTileDialog } = useTileDataMerging({model});

  const handleClick = () => {
    showMergeTileDialog && showMergeTileDialog();
  };

  return (
    <TileToolbarButton
      className="merge-data-button"
      onClick={handleClick}
      title="Add Data from..."
      isDisabled={isDisabled || !isMergeEnabled}
    >
      <MergeInIcon />
    </TileToolbarButton>
  );
});
