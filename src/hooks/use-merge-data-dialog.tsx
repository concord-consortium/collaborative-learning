import React, { useRef, useState } from "react";

import LinkGraphIcon from "../clue/assets/icons/table/link-graph-icon.svg";
import { useCustomModal } from "./use-custom-modal";
import { isLinkedToTile } from "../models/shared/shared-data-utils";
import { ITileLinkMetadata } from "../models/tiles/tile-link-types";
import { ITileModel } from "../models/tiles/tile-model";

import "./link-tile-dialog.scss";

interface IContentProps {
  linkedTiles: ITileLinkMetadata[];
  selectValue: string;
  tileTitle?: string;
  unlinkedTiles: ITileLinkMetadata[];
  setSelectValue: React.Dispatch<React.SetStateAction<string>>;
}
const Content: React.FC<IContentProps>
              = ({ linkedTiles, selectValue, tileTitle, unlinkedTiles, setSelectValue })=> {
  const displayTileTitle = tileTitle || "this tile";
  const selectElt = useRef<HTMLSelectElement>(null);

    return (
      <>
        <div className="prompt">
          To link {displayTileTitle} to another tile, select a tile from the link list.
          To unlink {displayTileTitle} from another tile, select a tile from the unlink list.
        </div>
        <select ref={selectElt} value={selectValue} data-test="link-tile-select"
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
  onLinkTile: (tileInfo: ITileLinkMetadata) => void;
  onUnlinkTile: (tileInfo: ITileLinkMetadata) => void;
}
export const useLinkConsumerTileDialog = ({ linkableTiles, model, onLinkTile, onUnlinkTile }: IProps) => {
  const tileTitle = model.title;
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
  const [showModal, hideModal] = useCustomModal({
    className: "link-tile",
    Icon: LinkGraphIcon,
    title: "Link or Unlink Tile",
    Content,
    contentProps: { linkedTiles, selectValue, tileTitle, unlinkedTiles, setSelectValue },
    buttons: [
      { label: "Cancel" },
      { label: !isLinkedToTile(model, selectValue) ? "Link" : "Unlink",
        isDefault: true,
        isDisabled: !selectValue,
        onClick: handleClick
      }
    ]
  }, [linkableTiles]);

  return [showModal, hideModal];
};
