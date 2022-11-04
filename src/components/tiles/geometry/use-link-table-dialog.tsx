import React, { useRef, useState } from "react";
import LinkGraphIcon from "../../../clue/assets/icons/table/link-graph-icon.svg";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { GeometryContentModelType } from "../../../models/tiles/geometry/geometry-content";
import { ITileLinkMetadata } from "../../../models/tiles/table-link-types";
import { ToolTileModelType } from "../../../models/tiles/tile-model";

import "./link-table-dialog.scss";

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
          To link this graph to a table, drag the table to a graph or select a table from the link list.
          To unlink this graph from a table, select a table from the unlink list.
        </div>
        <select ref={selectElt} value={selectValue} data-test="link-table-select"
                                onChange={e => {
                                  setSelectValue(e.target.value);
                                  setTimeout(() => selectElt.current?.focus());
                                }}>
          <option key="prompt" value={""}>Select a table</option>
            {unlinkedTiles.length > 0 &&
              <optgroup label="Link Table">
                {unlinkedTiles
                  .map(tileInfo => <option key={tileInfo.id} value={tileInfo.id}>{tileInfo.title}</option>)}
              </optgroup>
            }
            {(unlinkedTiles.length > 0) && (linkedTiles.length > 0) &&
              <option disabled>──────────────────────────────</option> }
            {linkedTiles.length > 0 &&
                <optgroup label="Unlink Table">
                  {linkedTiles
                    .map(tileInfo => <option key={tileInfo.id} value={tileInfo.id}>{tileInfo.title}</option>)}
                </optgroup>
            }
        </select>
      </>
    );
};

interface IProps {
  tableTiles: ITileLinkMetadata[];
  model: ToolTileModelType;
  handleRequestTableLink: ((tableId: string) => void) | undefined;
  handleRequestTableUnlink: ((tableId: string) => void) | undefined;
}
export const useLinkTableDialog = ({ tableTiles, model, handleRequestTableLink, handleRequestTableUnlink }: IProps) => {
  const [selectValue, setSelectValue] = useState("");
  const handleClick = () => {
    const _content = model.content as GeometryContentModelType;
    const tileInfo = tableTiles.find(tile => tile.id === selectValue);
    if (tileInfo) {
      if (_content.isLinkedToTable(tileInfo.id)) {
        handleRequestTableUnlink?.(tileInfo.id);
      } else {
        handleRequestTableLink?.(tileInfo.id);
      }
    }
  };
  const content = model.content as GeometryContentModelType;
  const unlinkedTiles = tableTiles.filter(tileInfo => !content.isLinkedToTable(tileInfo.id));
  const linkedTiles = tableTiles.filter(tileInfo => content.isLinkedToTable(tileInfo.id));
  const [showModal, hideModal] = useCustomModal({
    className: "link-table",
    Icon: LinkGraphIcon,
    title: "Link or Unlink Table to a Graph",
    Content,
    contentProps: { unlinkedTiles, linkedTiles, selectValue, setSelectValue },
    buttons: [
      { label: "Cancel" },
      { label: !content.isLinkedToTable(selectValue) ? "Link" : "Unlink",
        isDefault: true,
        isDisabled: !selectValue,
        onClick: handleClick
      }
    ]
  }, [tableTiles]);

  return [showModal, hideModal];
};
