import React, { useRef, useState } from "react";
import LinkGraphIcon from "../../../clue/assets/icons/table/link-graph-icon.svg";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { TableContentModelType } from "../../../models/tiles/table/table-content";
import { ITileLinkMetadata } from "../../../models/tiles/tile-link-types";
import { ITileModel } from "../../../models/tiles/tile-model";

import "./link-tile-dialog.scss";

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
          To link this table to a graph, drag the table to a graph or select a graph from the link list.
          To unlink this table from a graph, select a graph from the unlink list.
        </div>
        <select ref={selectElt} value={selectValue} data-test="link-graph-select"
                                onChange={e => {
                                  setSelectValue(e.target.value);
                                  setTimeout(() => selectElt.current?.focus());
                                }}>
          <option key="prompt" value={""}>Select a graph</option>
            {unlinkedTiles.length > 0 &&
              <optgroup label="Link Graphs">
                {unlinkedTiles
                  .map(tileInfo => <option key={tileInfo.id} value={tileInfo.id}>{tileInfo.title}</option>)}
              </optgroup>
            }
            {(unlinkedTiles.length > 0) && (linkedTiles.length > 0) &&
              <option disabled>──────────────────────────────</option> }
            {linkedTiles.length > 0 &&
                <optgroup label="Unlink Graphs">
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
export const useLinkTileDialog = ({ linkableTiles, model, onLinkTile, onUnlinkTile }: IProps) => {
  const [selectValue, setSelectValue] = useState("");
  const handleClick = () => {
    const tileInfo = linkableTiles.find(tile => tile.id === selectValue);
    if (tileInfo) {
      if (content.linkedTiles.indexOf(tileInfo.id) < 0) {
        onLinkTile(tileInfo);
      } else {
        onUnlinkTile(tileInfo);
      }
    }
  };
  const content = model.content as TableContentModelType;
  const unlinkedTiles = linkableTiles
                                  .filter(tileInfo => content.linkedTiles.indexOf(tileInfo.id) < 0);
  const linkedTiles = linkableTiles
                                  .filter(tileInfo => content.linkedTiles.indexOf(tileInfo.id) >= 0);
  const [showModal, hideModal] = useCustomModal({
    className: "link-tile",
    Icon: LinkGraphIcon,
    title: "Link or Unlink Table to a Graph",
    Content,
    contentProps: { unlinkedTiles, linkedTiles, selectValue, setSelectValue },
    buttons: [
      { label: "Cancel" },
      { label: content.linkedTiles.indexOf(selectValue) < 0 ? "Link" : "Unlink",
        isDefault: true,
        isDisabled: !selectValue,
        onClick: handleClick
      }
    ]
  }, [linkableTiles]);

  return [showModal, hideModal];
};
