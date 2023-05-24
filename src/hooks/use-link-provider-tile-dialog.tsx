import React, { useRef, useState } from "react";
import LinkGraphIcon from "../clue/assets/icons/table/link-graph-icon.svg";
import { useCustomModal } from "./use-custom-modal";
import { ITileLinkMetadata } from "../models/tiles/tile-link-types";
import { ITileModel } from "../models/tiles/tile-model";
import { isLinkedToTile } from "../utilities/shared-data-utils";

import "./link-tile-dialog.scss";

//TODO: use-link-table-dialog-dataflow.tsx is very similar
//consider refactoring -> https://www.pivotaltracker.com/n/projects/2441242/stories/184992684

interface IContentProps {
  unlinkedTiles: ITileLinkMetadata[];
  linkedTiles: ITileLinkMetadata[];
  selectValue: string;
  setSelectValue: React.Dispatch<React.SetStateAction<string>>;
}
const Content: React.FC<IContentProps>
              = ({ unlinkedTiles, linkedTiles, selectValue, setSelectValue })=> {
  const selectElt = useRef<HTMLSelectElement>(null);

    return (
      <>
        <div className="prompt">
          To link this graph to a data provider, select a data provider from the link list.
          To unlink this graph from a data provider, select a data provider from the unlink list.
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
  linkableTiles: ITileLinkMetadata[];
  model: ITileModel;
  handleRequestTileLink: ((tableId: string) => void) | undefined;
  handleRequestTileUnlink: ((tableId: string) => void) | undefined;
}
export const useLinkProviderTileDialog = ({
  linkableTiles, model, handleRequestTileLink, handleRequestTileUnlink
}: IProps) => {
  const [selectValue, setSelectValue] = useState("");
  const handleClick = () => {
    const tileInfo = linkableTiles.find(tile => tile.id === selectValue);
    if (tileInfo) {
      if (isLinkedToTile(model, tileInfo.id)) {
        handleRequestTileUnlink?.(tileInfo.id);
      } else {
        handleRequestTileLink?.(tileInfo.id);
      }
    }
  };
  const unlinkedTiles = linkableTiles.filter(tileInfo => !isLinkedToTile(model, tileInfo.id));
  const linkedTiles = linkableTiles.filter(tileInfo => isLinkedToTile(model, tileInfo.id));
  const [showModal, hideModal] = useCustomModal({
    className: "link-tile",
    Icon: LinkGraphIcon,
    title: "Link or Unlink Data Provider to a Graph",
    Content,
    contentProps: { unlinkedTiles, linkedTiles, selectValue, setSelectValue },
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
