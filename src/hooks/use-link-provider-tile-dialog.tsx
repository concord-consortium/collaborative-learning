import React, { useRef, useState } from "react";

import LinkGraphIcon from "../clue/assets/icons/table/link-graph-icon.svg";
import { useCustomModal } from "./use-custom-modal";
import { isLinkedToTile } from "../models/shared/shared-data-utils";
import { ITileLinkMetadata, ITypedTileLinkMetadata } from "../models/tiles/tile-link-types";
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
          To link {displayTileTitle} to a data provider, select a data provider from the link list.
          To unlink {displayTileTitle} from a data provider, select a data provider from the unlink list.
        </div>
        <select ref={selectElt} value={selectValue} data-test="link-tile-select"
                                onChange={e => {
                                  setSelectValue(e.target.value);
                                  setTimeout(() => selectElt.current?.focus());
                                }}>
          <option key="prompt" value={""}>Select a data provider</option>
            {unlinkedTiles.length > 0 &&
              <optgroup label="Link Tile">
                {unlinkedTiles
                  .map(tileInfo => <option key={tileInfo.id} value={tileInfo.id}>{tileInfo.title}</option>)}
              </optgroup>
            }
            {(unlinkedTiles.length > 0) && (linkedTiles.length > 0) &&
              <option disabled>──────────────────────────────</option> }
            {linkedTiles.length > 0 &&
                <optgroup label="Unlink Tile">
                  {linkedTiles
                    .map(tileInfo => <option key={tileInfo.id} value={tileInfo.id}>{tileInfo.title}</option>)}
                </optgroup>
            }
        </select>
      </>
    );
};

interface IProps {
  linkableTiles: ITypedTileLinkMetadata[];
  model: ITileModel;
  onLinkTile: (tileInfo: ITileLinkMetadata) => void;
  onUnlinkTile: (tileInfo: ITileLinkMetadata) => void;
}
export const useLinkProviderTileDialog = ({
  linkableTiles, model, onLinkTile, onUnlinkTile
}: IProps) => {
  const tileTitle = model.computedTitle;
  const [selectValue, setSelectValue] = useState("");
  const selectedTileInfo = linkableTiles.find(tile => tile.id === selectValue);

  const handleClick = () => {
    const tileInfo = linkableTiles.find(tile => tile.id === selectValue);
    if (tileInfo) {
      if (isLinkedToTile(model, tileInfo.id, tileInfo.type)) {
        onUnlinkTile?.(tileInfo);
      } else {
        onLinkTile?.(tileInfo);
      }
    }
  };
  const unlinkedTiles = linkableTiles.filter(tileInfo => !isLinkedToTile(model, tileInfo.id, tileInfo.type));
  const linkedTiles =
    linkableTiles.filter(tileInfo => isLinkedToTile(model, tileInfo.id, tileInfo.type) && tileInfo.id !== model.id);
  const [showModal, hideModal] = useCustomModal({
    className: "link-tile",
    Icon: LinkGraphIcon,
    title: "Link or Unlink Data Provider",
    Content,
    contentProps: { unlinkedTiles, linkedTiles, selectValue, tileTitle, setSelectValue },
    buttons: [
      { label: "Cancel" },
      { label: !isLinkedToTile(model, selectValue, selectedTileInfo?.type) ? "Link" : "Unlink",
        isDefault: true,
        isDisabled: !selectValue,
        onClick: handleClick
      }
    ]
  }, [linkableTiles]);

  return [showModal, hideModal];
};
