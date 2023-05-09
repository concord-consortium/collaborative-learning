import React, { useRef, useState } from "react";
import LinkGraphIcon from "../assets/icons/link-table-icon.svg"; //Leslie wants to change this to new icon
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { DataflowContentModelType } from "../model/dataflow-content";
import { ITileLinkMetadata } from "../../../models/tiles/tile-link-types";
import { ITileModel } from "../../../models/tiles/tile-model";

import "./use-link-table-dialog-dataflow.scss";

//TODO: this is generally a copy of use-link-table-dialog.tsx for Geometry Tile
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
          To link this program to a table, record data, then select a table from the link list.
          To unlink this program from a table, select a table from the unlink list.
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
  model: ITileModel;
  handleRequestTableLink: ((tableId: string) => void) | undefined;
  handleRequestTableUnlink: ((tableId: string) => void) | undefined;
}

export const useLinkTableDialogDataFlow = ({ tableTiles, model, handleRequestTableLink,
  handleRequestTableUnlink }: IProps) => {

  const [selectValue, setSelectValue] = useState("");
  const content = model.content as DataflowContentModelType;

  const handleClick = () => {
    const tileInfo = tableTiles.find(tile => tile.id === selectValue);
    if (tileInfo) {
      if (content.isLinkedToTable(tileInfo.id)) {
        handleRequestTableUnlink?.(tileInfo.id);
      } else {
        handleRequestTableLink?.(tileInfo.id);
      }
    }
  };
  const unlinkedTiles = tableTiles.filter(tileInfo => !content.isLinkedToTable(tileInfo.id));
  const linkedTiles = tableTiles.filter(tileInfo => content.isLinkedToTable(tileInfo.id));
  const [showModal, hideModal] = useCustomModal({
    className: "link-table",
    Icon: LinkGraphIcon,
    title: "Link or Unlink Program to a Table",
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
