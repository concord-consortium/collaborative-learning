import React, { useRef, useState } from "react";

import LinkGraphIcon from "../clue/assets/icons/table/link-graph-icon.svg";
import { IModalButton, useCustomModal } from "./use-custom-modal";
import { isLinkedToTile } from "../models/shared/shared-data-utils";
import { ITileLinkMetadata } from "../models/tiles/tile-link-types";
import { ITileModel } from "../models/tiles/tile-model";

import "./link-tile-dialog.scss";

// Defines a modal window that allows the user to select a tile
// to link with or unlinkn from the current tile's dataset.
// If a single tile type is supplied as an argument, an option to
// create a new tile of that type will be offered as well.

interface IContentProps {
  linkedTiles: ITileLinkMetadata[];
  selectValue: string;
  tileTitle?: string;
  unlinkedTiles: ITileLinkMetadata[];
  setSelectValue: React.Dispatch<React.SetStateAction<string>>;
  tileType?: string;
}
const Content: React.FC<IContentProps>
              = ({ linkedTiles, selectValue, tileTitle, unlinkedTiles, setSelectValue, tileType })=> {
  /**
   * Content for the link/unlink/create modal dialog.
   */
  const displayTileTitle = tileTitle || "this tile";
  const selectElt = useRef<HTMLSelectElement>(null);

  let instructions;
  if (tileType) {
    const lcTileType = tileType.toLowerCase();
    instructions = `To view data as a ${lcTileType}, select the ${lcTileType} from this list.
    To remove the view, select a ${lcTileType} from the Unlink list.`;
  } else {
    instructions = `To link ${displayTileTitle} to another tile, select a tile from the link list.
     To unlink ${displayTileTitle} from another tile, select a tile from the unlink list.`;
  }

    return (
      <>
        <div className="prompt">
          {instructions}
        </div>
        <select ref={selectElt} value={selectValue} data-testid="link-tile-select"
                                onChange={e => {
                                  setSelectValue(e.target.value);
                                  setTimeout(() => selectElt.current?.focus());
                                }}>
          <option key="prompt" value={""}>Select a tile</option>
            {unlinkedTiles.length > 0 &&
              <optgroup label="Link Tiles">
                {unlinkedTiles
                  .map(tileInfo => <option key={tileInfo.id} value={tileInfo.id}>{tileInfo.title}</option>)}
              </optgroup>
            }
            {(unlinkedTiles.length > 0) && (linkedTiles.length > 0) &&
              <option disabled>──────────────────────────────</option> }
            {linkedTiles.length > 0 &&
                <optgroup label="Unlink Tiles">
                  {linkedTiles
                    .map(tileInfo => <option key={tileInfo.id} value={tileInfo.id}>{tileInfo.title}</option>)}
                </optgroup>
            }
        </select>
      </>
    );
};

interface IProps {
  linkableTiles: ITileLinkMetadata[];
  model: ITileModel;
  tileType?: string;
  onLinkTile: (tileInfo: ITileLinkMetadata) => void;
  onUnlinkTile: (tileInfo: ITileLinkMetadata) => void;
  onCreateTile: () => void;
}
export const useLinkConsumerTileDialog =
    ({ linkableTiles, model, tileType, onLinkTile, onUnlinkTile, onCreateTile }: IProps) => {
  const tileTitle = model.computedTitle;
  const [selectValue, setSelectValue] = useState("");
  const handleClick = () => {
    const tileInfo = linkableTiles.find(tile => tile.id === selectValue);
    if (tileInfo) {
      if (isLinkedToTile(model, tileInfo.id)) {
        onUnlinkTile(tileInfo);
      } else {
        onLinkTile(tileInfo);
      }
    }
  };
  const unlinkedTiles = linkableTiles
    .filter(tileInfo => !isLinkedToTile(model, tileInfo.id));
  const linkedTiles = linkableTiles
    .filter(tileInfo => isLinkedToTile(model, tileInfo.id) && tileInfo.id !== model.id);

  const buttons: IModalButton[] = [
    { label: "Cancel" },
    {
      label: !isLinkedToTile(model, selectValue) ? "Link" : "Unlink",
      isDefault: true,
      isDisabled: !selectValue,
      onClick: handleClick
    }];
  if (onCreateTile && tileType) {
    buttons.splice(1, 0,
      {
        label: `Add new ${tileType}`,
        className: 'add-new-button',
        onClick: onCreateTile,
      }
    );
  }
  const [showModal, hideModal] = useCustomModal({
    className: "link-tile",
    Icon: LinkGraphIcon,
    title: tileType ? `View Data as ${tileType}` : "Link or Unlink Tile",
    Content,
    contentProps: { linkedTiles, selectValue, tileTitle, tileType, unlinkedTiles, setSelectValue },
    buttons
  }, [linkableTiles]);

  return [showModal, hideModal];
};
